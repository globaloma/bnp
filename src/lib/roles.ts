import type { PartnerRole } from "@/types/db";

export function roleHome(role: PartnerRole | null | undefined): string {
  switch (role) {
    case "fulfillment_center":
      return "/fc";
    case "admin":
      return "/admin";
    default:
      return "/dashboard";
  }
}
