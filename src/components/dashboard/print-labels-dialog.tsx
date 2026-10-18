"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DEFAULT_LABEL_SIZE,
  LABEL_SIZES,
  MAX_LABELS_PER_PRINT,
  countLabels,
  printLabels,
  type LabelItem,
  type LabelSizeId,
} from "@/lib/labels-pdf";

export type PrintableLabel = Omit<LabelItem, "copies"> & {
  /** Units physically in the warehouse, offered as "one label per unit". */
  onHand?: number;
};

const SIZE_KEY = "bnp:label-size";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

function readSavedSize(): LabelSizeId {
  try {
    const saved = localStorage.getItem(SIZE_KEY);
    if (saved && saved in LABEL_SIZES) return saved as LabelSizeId;
  } catch {
    // Storage blocked (private window): fall back to the default size.
  }
  return DEFAULT_LABEL_SIZE;
}

export function PrintLabelsDialog({
  title,
  labels,
  fileName,
  trigger,
  children,
}: {
  title: string;
  labels: PrintableLabel[];
  fileName: string;
  /** The element that opens the dialog; `children` go inside it. */
  trigger: ReactElement;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <PrintLabelsForm labels={labels} fileName={fileName} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Rendered only while the dialog is open, so reading the saved size from
// localStorage here never runs on the server.
function PrintLabelsForm({
  labels,
  fileName,
  onDone,
}: {
  labels: PrintableLabel[];
  fileName: string;
  onDone: () => void;
}) {
  const single = labels.length === 1;
  const hasOnHand = labels.some((l) => (l.onHand ?? 0) > 0);
  const [size, setSize] = useState<LabelSizeId>(readSavedSize);
  const [copies, setCopies] = useState(1);
  const [perUnit, setPerUnit] = useState(false);

  const items: LabelItem[] = labels.map((l) => ({
    barcode: l.barcode,
    heading: l.heading,
    details: l.details,
    copies: perUnit ? (l.onHand ?? 0) : copies,
  }));
  const total = countLabels(items);
  const tooMany = total > MAX_LABELS_PER_PRINT;

  function handlePrint() {
    if (total === 0) return;
    try {
      localStorage.setItem(SIZE_KEY, size);
    } catch {
      // Not remembering the size is fine.
    }
    try {
      printLabels(items, size, fileName);
      onDone();
    } catch {
      toast.error("Couldn't build the labels. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="label-size">
          Label size
        </label>
        <select
          id="label-size"
          value={size}
          onChange={(e) => setSize(e.target.value as LabelSizeId)}
          className={cn(fieldClass, "appearance-none")}
        >
          {(Object.keys(LABEL_SIZES) as LabelSizeId[]).map((id) => (
            <option key={id} value={id}>
              {LABEL_SIZES[id].name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-mist">
          Pick the size of the label roll in your printer. We remember it on this device.
        </p>
      </div>

      {hasOnHand ? (
        <div className="flex flex-col gap-2 text-sm text-navy">
          <label className="flex items-center gap-2">
            <input type="radio" checked={!perUnit} onChange={() => setPerUnit(false)} />
            {single ? "A set number of labels" : "The same number for each"}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={perUnit} onChange={() => setPerUnit(true)} />
            One per unit on hand
          </label>
        </div>
      ) : null}

      {!perUnit ? (
        <div>
          <label className={labelClass} htmlFor="label-copies">
            {single ? "Number of labels" : "Labels for each"}
          </label>
          <input
            id="label-copies"
            type="number"
            min={1}
            max={MAX_LABELS_PER_PRINT}
            value={copies}
            onChange={(e) => setCopies(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className={fieldClass}
          />
        </div>
      ) : null}

      <p className={cn("text-xs", tooMany ? "text-destructive" : "text-graphite")}>
        {tooMany
          ? `That's ${total.toLocaleString()} labels. Print at most ${MAX_LABELS_PER_PRINT.toLocaleString()} at a time.`
          : `${total.toLocaleString()} label${total === 1 ? "" : "s"} will open in a new tab, ready to print.`}
      </p>

      <Button size="lg" onClick={handlePrint} disabled={total === 0 || tooMany}>
        <Printer className="size-4" />
        Print labels
      </Button>
    </div>
  );
}
