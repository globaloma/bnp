-- Fulfillment centers could not see stock_events at all (only the owning
-- merchant and admins could), so a restock never reached them even though
-- they're the ones who need to know stock is available to dispatch.

drop policy if exists "stock events read all for fc" on stock_events;
create policy "stock events read all for fc" on stock_events
  for select using (is_fulfillment_center());
