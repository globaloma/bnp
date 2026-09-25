-- "Own Rider" orders need a merchant-entered delivery price (BNP Fleet
-- delivery has no separate per-order charge today; Own Rider does, since
-- the merchant is arranging and paying their own courier).

alter table orders
  add column if not exists delivery_fee numeric(14, 2) not null default 0;
