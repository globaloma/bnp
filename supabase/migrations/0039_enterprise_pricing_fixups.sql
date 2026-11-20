-- Enterprise pricing fix-ups for 0038.
--
-- On databases where an EARLIER 0038 had already created `enterprise_rates` and
-- the `billing_settings.ent_*` columns, 0038's own `create table if not exists`
-- / `add column if not exists` guards skipped two later changes:
--   1. enterprise_rates.handling_container (added inside the create-table block).
--   2. billing_settings.ent_intake_free_max default 300 -> 200.
-- Without (1), admin_set_enterprise_rates() errors when saving a rate card.
--
-- This migration applies just those deltas as idempotent ALTER/UPDATEs. It is
-- a no-op on a fresh database that ran the current 0038. Safe to re-run.

begin;

-- 1. Per-merchant container-handling override + 20% introductory default.
alter table enterprise_rates add column if not exists handling_container numeric(14,2);
alter table enterprise_rates alter column month1_discount_pct set default 20;
-- Bring seeded cards still on the old 50% introductory default down to 20%,
-- only where the month-1 discount has not been consumed yet.
update enterprise_rates set month1_discount_pct = 20
  where month1_discount_pct = 50 and month1_done = false;

-- 2. Intake free threshold: fee schedule §3a is "free up to 200 units".
alter table billing_settings alter column ent_intake_free_max set default 200;
update billing_settings set ent_intake_free_max = 200 where ent_intake_free_max = 300;

commit;
