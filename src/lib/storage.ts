// Standard-plan storage pricing.
//
// Storage space is recorded as crates and pallets (see migration 0035). A crate
// is a 530 × 290 × 370mm box. Standard bills a flat rate per crate — ₦5,000,
// i.e. ₦10,000 per 2 crates — while any pallet space keeps billing on the per-m²
// storage_rate. Enterprise storage is billed separately (per pallet / m³).
//
// This mirrors run_monthly_billing's Standard branch (migration 0042). Keep the
// two in step: both bill crates at std_crate_rate and pallets on storage_rate.

export const STANDARD_CRATE_DIMENSIONS = "530 × 290 × 370mm";

/** Fallback per-crate rate (₦) when billing_settings.std_crate_rate is absent. */
export const STANDARD_CRATE_RATE = 5_000;

/**
 * Monthly Standard storage charge: crates at a flat per-crate rate, plus the
 * pallet share of the space on the per-m² rate.
 *
 * The pallet share is the recorded m² (which already folds in pallet stack
 * height) minus the crates' m²-equivalent, floored at zero.
 */
export function standardStorageAmount(opts: {
  crates: number;
  sqm: number;
  crateRate: number;
  crateM2: number;
  storageRate: number;
}): number {
  const palletSqm = Math.max(0, opts.sqm - opts.crates * opts.crateM2);
  return Math.round((opts.crates * opts.crateRate + palletSqm * opts.storageRate) * 100) / 100;
}
