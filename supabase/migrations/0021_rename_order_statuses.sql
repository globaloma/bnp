-- Order status names: Packaging -> Packaged, Shipping -> Shipped.
-- RENAME VALUE changes the label in place, so existing orders and the
-- column default ('Packaging' -> 'Packaged') follow automatically.
alter type order_status rename value 'Packaging' to 'Packaged';
alter type order_status rename value 'Shipping' to 'Shipped';
