import { LOCATIONS, type Product } from "@/types/db";

export function WarehouseSplit({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <p className="text-xs text-graphite">
        Add products to see how your stock is spread across warehouses.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {LOCATIONS.map((loc) => {
        const count = products.filter((p) => p.location === loc).length;
        const pct = products.length ? (count / products.length) * 100 : 0;
        return (
          <div key={loc}>
            <div className="mb-1 flex justify-between text-xs font-medium text-graphite">
              <span>{loc}</span>
              <span>{count} SKUs</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
