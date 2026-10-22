import "server-only";

// GIG Logistics live prices (GIG third-party API, the "Agility" system).
// Docs: https://dev-thirdpartynode.theagilitysystems.com/docs/
//
// Every call needs BNP's GIG merchant login. Until GIG_EMAIL and
// GIG_PASSWORD are set, gigConfigured() is false and GIG falls back to any
// uploaded rate card (or isn't offered at all).
//
// GIG's docs don't explain ShipmentType, VehicleType or PickUpOptions; the
// values below are the ones in GIG's own price example. Check them against
// a real quote once the account is live.

const BASE_URL = (process.env.GIG_API_BASE_URL || "https://thirdpartynode.theagilitysystems.com").replace(/\/$/, "");
const SHIPMENT_TYPE = 1;
const VEHICLE_TYPE = 2;
const PICKUP_OPTION = 1;
const DAY = 24 * 60 * 60 * 1000;

export function gigConfigured(): boolean {
  return Boolean(process.env.GIG_EMAIL && process.env.GIG_PASSWORD);
}

type Envelope<T> = { message?: string; status?: number; data?: T };

let token: { value: string; expires: number } | null = null;

async function login(): Promise<string> {
  if (token && token.expires > Date.now()) return token.value;
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.GIG_EMAIL, password: process.env.GIG_PASSWORD }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as Envelope<Record<string, unknown>>;
  const value = body.data?.["access-token"];
  if (!res.ok || typeof value !== "string") {
    throw new Error(`GIG sign-in failed: ${body.message ?? res.status}`);
  }
  // GIG tokens last weeks; refresh daily to be safe.
  token = { value, expires: Date.now() + DAY };
  return value;
}

async function gigFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const call = async (accessToken: string) =>
    fetch(`${BASE_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json", "access-token": accessToken },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  let res = await call(await login());
  if (res.status === 401) {
    token = null;
    res = await call(await login());
  }
  const body = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || body.data === undefined) {
    throw new Error(`GIG ${path} failed: ${body.message ?? res.status}`);
  }
  return body.data;
}

export type GigStation = { id: number; name: string; state: string };

let stations: { list: GigStation[]; expires: number } | null = null;

/** GIG's Nigerian stations (cities), cached for a day. */
export async function gigStations(): Promise<GigStation[]> {
  if (stations && stations.expires > Date.now()) return stations.list;
  const rows = await gigFetch<{ StationId: number; StationName: string; StateName: string; IsDeleted?: boolean; IsPublic?: boolean }[]>(
    "/localstations/get",
  );
  const list = rows
    .filter((r) => !r.IsDeleted && r.IsPublic !== false)
    .map((r) => ({ id: r.StationId, name: titleCase(r.StationName), state: titleCase(r.StateName) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  stations = { list, expires: Date.now() + DAY };
  return list;
}

const centres = new Map<number, { lat: number; lng: number; expires: number }>();

/** Where GIG delivers to in a station: its first service centre. */
async function stationPoint(stationId: number): Promise<{ lat: number; lng: number }> {
  const hit = centres.get(stationId);
  if (hit && hit.expires > Date.now()) return hit;
  const rows = await gigFetch<{ Latitude: number; Longitude: number }[]>(
    `/serviceCentresByStation?StationId=${stationId}`,
  );
  const first = rows.find((r) => Number(r.Latitude) && Number(r.Longitude));
  if (!first) throw new Error("GIG has no service centre for that destination.");
  const point = { lat: Number(first.Latitude), lng: Number(first.Longitude), expires: Date.now() + DAY };
  centres.set(stationId, point);
  return point;
}

/** GIG's own price (before BNP's markup) for one parcel. */
export async function gigPrice(input: {
  from: { lat: number; lng: number };
  fromStation: string;
  to: string;
  weightKg: number;
}): Promise<number> {
  const list = await gigStations();
  const dest = list.find((s) => s.name === input.to);
  if (!dest) throw new Error("Unknown GIG destination.");
  const origin = list.find((s) => s.name.toLowerCase() === input.fromStation.toLowerCase());
  const point = await stationPoint(dest.id);
  const data = await gigFetch<{ GrandTotal?: number }>("/price/v3", {
    method: "POST",
    body: {
      ...(origin ? { SenderStationId: origin.id } : {}),
      ReceiverStationId: dest.id,
      VehicleType: VEHICLE_TYPE,
      SenderLocation: { Latitude: input.from.lat, Longitude: input.from.lng },
      ReceiverLocation: { Latitude: point.lat, Longitude: point.lng },
      IsPriorityShipment: false,
      PickUpOptions: PICKUP_OPTION,
      ShipmentItems: [
        {
          ItemName: "Parcel",
          Description: "Merchant order",
          Quantity: 1,
          Weight: input.weightKg,
          IsVolumetric: false,
          ShipmentType: SHIPMENT_TYPE,
        },
      ],
    },
  });
  const total = Number(data.GrandTotal);
  if (!Number.isFinite(total) || total <= 0) throw new Error("GIG returned no price.");
  return total;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
