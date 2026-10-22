"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { gigConfigured, gigStations } from "@/lib/gig";
import { liveGigFee } from "@/lib/delivery-pricing";

// Delivery rates (migration 0029). Admins write these tables directly; the
// row-level policies only let admins change them.

type Result = { ok: true; message?: string } | { ok: false; error: string };

const hub = z.enum(["Abuja", "Lagos", "USA"]);

const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  hub,
  name: z.string().trim().min(1, "Give the zone a name").max(80),
  coverage: z.string().trim().max(300),
  rate: z.coerce.number().min(0, "Enter a rate of 0 or more").max(10_000_000),
  note: z.string().trim().max(200),
  active: z.boolean(),
});

export async function saveDispatchZone(input: z.input<typeof zoneSchema>): Promise<Result> {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const z0 = parsed.data;
  const supabase = await createClient();
  const row = {
    hub: z0.hub,
    name: z0.name,
    coverage: z0.coverage || null,
    rate: z0.rate,
    note: z0.note || null,
    active: z0.active,
  };
  const { error } = z0.id
    ? await supabase.from("dispatch_zones").update(row).eq("id", z0.id)
    : await supabase.from("dispatch_zones").insert({ ...row, sort: 99 });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "There's already a zone with that name." : error.message };
  }
  revalidatePath("/admin/delivery");
  return { ok: true };
}

const rateRow = z
  .object({
    origin_hub: hub,
    destination_zone: z.string().trim().min(1, "destination_zone is empty").max(120),
    weight_min_kg: z.coerce.number().min(0),
    weight_max_kg: z.coerce.number().positive(),
    rate_ngn: z.coerce.number().min(0),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effective_from must look like 2026-11-01"),
    effective_to: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  })
  .refine((r) => r.weight_max_kg > r.weight_min_kg, "weight_max_kg must be more than weight_min_kg");

/**
 * Replaces a carrier's rate card: the rows in the file become the live rates
 * and that carrier's previous rates are switched off (kept for history).
 */
export async function uploadRateCard(carrier: "UPS" | "GIG", rows: Record<string, string>[]): Promise<Result> {
  if (carrier !== "UPS" && carrier !== "GIG") return { ok: false, error: "Pick UPS or GIG." };
  if (rows.length === 0) return { ok: false, error: "The file has no rows." };
  if (rows.length > 5000) return { ok: false, error: "Keep the file under 5,000 rows." };

  const clean = [];
  for (const [i, raw] of rows.entries()) {
    const r = rateRow.safeParse({
      origin_hub: raw.origin_hub?.trim(),
      destination_zone: raw.destination_zone,
      weight_min_kg: raw.weight_min_kg,
      weight_max_kg: raw.weight_max_kg,
      rate_ngn: raw.rate_ngn?.replace(/[,₦\s]/g, ""),
      effective_from: raw.effective_from?.trim() || new Date().toISOString().slice(0, 10),
      effective_to: raw.effective_to?.trim() ?? "",
    });
    if (!r.success) {
      const issue = r.error.issues[0];
      const field = issue.path[0] ? `${String(issue.path[0])}: ` : "";
      return { ok: false, error: `Row ${i + 2}: ${field}${issue.message}` };
    }
    clean.push(r.data);
  }

  const supabase = await createClient();
  const batch = crypto.randomUUID();
  const { error: insertError } = await supabase.from("delivery_rate_cards").insert(
    clean.map((r) => ({
      carrier,
      origin_hub: r.origin_hub,
      destination_zone: r.destination_zone,
      weight_min_kg: r.weight_min_kg,
      weight_max_kg: r.weight_max_kg,
      rate: r.rate_ngn,
      effective_from: r.effective_from,
      effective_to: r.effective_to || null,
      upload_batch: batch,
    })),
  );
  if (insertError) return { ok: false, error: insertError.message };

  const { error: offError } = await supabase
    .from("delivery_rate_cards")
    .update({ is_active: false })
    .eq("carrier", carrier)
    .eq("is_active", true)
    .neq("upload_batch", batch);
  if (offError) return { ok: false, error: offError.message };

  revalidatePath("/admin/delivery");
  return { ok: true, message: `${clean.length} ${carrier} rate${clean.length === 1 ? "" : "s"} are now live.` };
}

export async function switchOffCarrier(carrier: "UPS" | "GIG"): Promise<Result> {
  if (carrier !== "UPS" && carrier !== "GIG") return { ok: false, error: "Pick UPS or GIG." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_rate_cards")
    .update({ is_active: false })
    .eq("carrier", carrier)
    .eq("is_active", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/delivery");
  return { ok: true, message: `${carrier} is no longer offered.` };
}

const settingsSchema = z.object({
  markupPercent: z.coerce.number().min(0, "Markup can't be negative").max(200),
  abujaLat: z.coerce.number().min(-90).max(90),
  abujaLng: z.coerce.number().min(-180).max(180),
  lagosLat: z.coerce.number().min(-90).max(90),
  lagosLng: z.coerce.number().min(-180).max(180),
});

export async function saveDeliverySettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_settings")
    .update({
      gig_markup: Math.round(d.markupPercent * 100) / 10000,
      abuja_lat: d.abujaLat,
      abuja_lng: d.abujaLng,
      lagos_lat: d.lagosLat,
      lagos_lng: d.lagosLng,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/delivery");
  return { ok: true, message: "Saved." };
}

/** Asks GIG for one Abuja to Lagos price, to check the connection works. */
export async function testGig(): Promise<Result> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { ok: false, error: "Admins only." };
  if (!gigConfigured()) return { ok: false, error: "GIG isn't connected yet: GIG_EMAIL and GIG_PASSWORD aren't set." };
  try {
    const stations = await gigStations();
    const lagos = stations.find((s) => s.name === "Lagos")?.name ?? stations[0]?.name;
    if (!lagos) return { ok: false, error: "GIG returned no destinations." };
    const fee = await liveGigFee("Abuja", lagos, 1);
    if (fee === null) return { ok: false, error: `Signed in to GIG (${stations.length} destinations) but couldn't get a price. Check the server log.` };
    return { ok: true, message: `GIG works: 1 kg Abuja to ${lagos} costs customers ₦${fee.toLocaleString("en-NG")} (with markup).` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "GIG didn't respond." };
  }
}
