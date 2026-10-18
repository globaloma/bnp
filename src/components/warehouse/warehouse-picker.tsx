"use client";

import { useCallback, useSyncExternalStore } from "react";
import { LOCATIONS, type WarehouseLocation } from "@/types/db";
import { cn } from "@/lib/utils";

// Which warehouse the scan screens work in. Fulfillment center accounts aren't
// tied to one location, so each device remembers the one it's used in.

const KEY = "bnp:warehouse";
const EVENT = "bnp:warehouse-change";

function read(): WarehouseLocation {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (LOCATIONS as string[]).includes(saved)) return saved as WarehouseLocation;
  } catch {
    // Storage blocked: fall back to the main hub.
  }
  return "Abuja";
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useWarehouseLocation(): [WarehouseLocation, (next: WarehouseLocation) => void] {
  const value = useSyncExternalStore(subscribe, read, () => "Abuja" as WarehouseLocation);
  const set = useCallback((next: WarehouseLocation) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered on this device; still switches for now.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, set];
}

export function WarehousePicker({
  value,
  onChange,
  counts,
}: {
  value: WarehouseLocation;
  onChange: (next: WarehouseLocation) => void;
  counts?: Partial<Record<WarehouseLocation, number>>;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Warehouse">
      {LOCATIONS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
            value === l
              ? "border-navy bg-navy text-white"
              : "border-stone bg-card text-graphite hover:border-teal/40",
          )}
        >
          {l}
          {counts?.[l] ? ` (${counts[l]})` : ""}
        </button>
      ))}
    </div>
  );
}
