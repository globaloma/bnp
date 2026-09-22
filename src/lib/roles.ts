import type { PartnerRole } from "@/types/db";

export function roleHome(role: PartnerRole | null | undefined): string {
  return role === "fulfillment_center" ? "/fc" : "/dashboard";
}
