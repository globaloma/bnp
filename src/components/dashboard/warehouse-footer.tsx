import { LOCATIONS } from "@/types/db";

export function WarehouseFooter() {
  return (
    <div className="m-3 rounded-lg border-l-2 border-gold bg-gold/10 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mist">
        Warehouses
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {LOCATIONS.map((loc) => (
          <li key={loc} className="flex items-center gap-1.5 text-[12px] text-gold">
            <span className="size-1.5 rounded-full bg-gold" />
            {loc}
          </li>
        ))}
      </ul>
    </div>
  );
}
