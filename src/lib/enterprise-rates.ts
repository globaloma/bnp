import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EnterpriseDefaults } from "@/types/db";

// The public Enterprise calculator prefills from admin-set default rates
// (spec Part 4.3: no hardcoded front-end defaults). billing_settings is not
// readable by anonymous visitors (RLS), so we read the rate columns — which
// hold no personal data — with the service-role client on the server and pass
// them to the client calculator. Amounts are null until the CEO confirms them.

const EMPTY: EnterpriseDefaults = {
  ent_annual_subscription: null,
  ent_storage_pallet_rate: null,
  ent_storage_m3_rate: null,
  ent_pickpack_first: null,
  ent_pickpack_additional: null,
  ent_kitting_simple: null,
  ent_kitting_standard: null,
  ent_kitting_complex: null,
  ent_returns_processing: null,
  ent_returns_disposal: null,
  ent_cod_rate: null,
  ent_special_projects_hr: null,
  ent_insurance_rate: 0.0025,
  ent_intake_free_max: 200,
  ent_intake_b1: null,
  ent_intake_b2: null,
  ent_intake_b3: null,
  ent_intake_b4: null,
  ent_restock_b0: null,
  ent_restock_b1: null,
  ent_restock_b2: null,
  ent_restock_b3: null,
  ent_restock_b4: null,
  ent_handling_container: null,
};

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function getEnterpriseDefaults(): Promise<EnterpriseDefaults> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("billing_settings")
      .select(
        "ent_annual_subscription, ent_storage_pallet_rate, ent_storage_m3_rate, ent_pickpack_first, ent_pickpack_additional, ent_kitting_simple, ent_kitting_standard, ent_kitting_complex, ent_returns_processing, ent_returns_disposal, ent_cod_rate, ent_special_projects_hr, ent_insurance_rate, ent_intake_free_max, ent_intake_b1, ent_intake_b2, ent_intake_b3, ent_intake_b4, ent_restock_b0, ent_restock_b1, ent_restock_b2, ent_restock_b3, ent_restock_b4, ent_handling_container",
      )
      .single();
    if (!data) return EMPTY;
    return {
      ent_annual_subscription: num(data.ent_annual_subscription),
      ent_storage_pallet_rate: num(data.ent_storage_pallet_rate),
      ent_storage_m3_rate: num(data.ent_storage_m3_rate),
      ent_pickpack_first: num(data.ent_pickpack_first),
      ent_pickpack_additional: num(data.ent_pickpack_additional),
      ent_kitting_simple: num(data.ent_kitting_simple),
      ent_kitting_standard: num(data.ent_kitting_standard),
      ent_kitting_complex: num(data.ent_kitting_complex),
      ent_returns_processing: num(data.ent_returns_processing),
      ent_returns_disposal: num(data.ent_returns_disposal),
      ent_cod_rate: num(data.ent_cod_rate),
      ent_special_projects_hr: num(data.ent_special_projects_hr),
      ent_insurance_rate: num(data.ent_insurance_rate) ?? 0.0025,
      ent_intake_free_max: num(data.ent_intake_free_max) ?? 200,
      ent_intake_b1: num(data.ent_intake_b1),
      ent_intake_b2: num(data.ent_intake_b2),
      ent_intake_b3: num(data.ent_intake_b3),
      ent_intake_b4: num(data.ent_intake_b4),
      ent_restock_b0: num(data.ent_restock_b0),
      ent_restock_b1: num(data.ent_restock_b1),
      ent_restock_b2: num(data.ent_restock_b2),
      ent_restock_b3: num(data.ent_restock_b3),
      ent_restock_b4: num(data.ent_restock_b4),
      ent_handling_container: num(data.ent_handling_container),
    };
  } catch {
    return EMPTY;
  }
}
