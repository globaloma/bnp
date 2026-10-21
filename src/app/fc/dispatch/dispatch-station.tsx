"use client";

import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import type { OrderRider, ScanResult, WarehouseLocation } from "@/types/db";
import { ScanStation } from "@/components/warehouse/scan-station";
import { useWarehouseLocation, WarehousePicker } from "@/components/warehouse/warehouse-picker";
import { dispatchScan } from "../picking/actions";

export type Parcel = {
  key: string;
  packageCode: string;
  orderRef: string;
  merchant: string;
  customer: string;
  rider: OrderRider;
  location: WarehouseLocation;
  units: number;
  updatedAt: string;
};

export function DispatchStation({ packed, sentToday }: { packed: Parcel[]; sentToday: Parcel[] }) {
  const [location, setLocation] = useWarehouseLocation();
  const [sentCodes, setSentCodes] = useState<string[]>([]);

  const waiting = useMemo(
    () => packed.filter((p) => p.location === location && !sentCodes.includes(p.packageCode)),
    [packed, location, sentCodes],
  );
  const sent = useMemo(() => {
    const justSent = packed.filter((p) => sentCodes.includes(p.packageCode));
    return [...justSent, ...sentToday].filter((p) => p.location === location);
  }, [packed, sentToday, sentCodes, location]);

  async function handleScan(code: string): Promise<ScanResult> {
    const result = await dispatchScan(code);
    if (result.ok) setSentCodes((c) => [...c, code.trim().toUpperCase()]);
    return result;
  }

  return (
    <div className="flex flex-col gap-6">
      <WarehousePicker value={location} onChange={setLocation} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <ScanStation
          onScan={handleScan}
          allowQuantity={false}
          prompt="Scan the package label"
          idleTitle="Ready to dispatch"
          idleBody="Scan each parcel as it leaves with the rider or customer."
        />

        <div className="flex flex-col gap-4 xl:self-start">
          <ParcelList title="Packed, waiting for a rider" parcels={waiting} empty="No parcels waiting." />
          <ParcelList title="Dispatched today" parcels={sent} empty="Nothing dispatched yet today." muted />
        </div>
      </div>
    </div>
  );
}

function ParcelList({
  title,
  parcels,
  empty,
  muted,
}: {
  title: string;
  parcels: Parcel[];
  empty: string;
  muted?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone bg-card">
      <div className="flex items-center justify-between border-b border-stone px-4 py-3">
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        <span className="text-sm font-semibold text-navy">{parcels.length}</span>
      </div>
      {parcels.length === 0 ? (
        <p className="px-4 py-5 text-sm text-mist">{empty}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-stone overflow-y-auto">
          {parcels.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-2.5">
              <Truck className={muted ? "size-4 shrink-0 text-mist" : "size-4 shrink-0 text-teal"} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs font-semibold text-navy">{p.packageCode}</div>
                <div className="truncate text-[11px] text-graphite">
                  {p.customer} · {p.merchant} · {p.units} item{p.units === 1 ? "" : "s"}
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-graphite">{p.rider}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
