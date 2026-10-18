"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ScanLine, XCircle } from "lucide-react";
import type { ScanResult } from "@/types/db";
import { cn } from "@/lib/utils";

// The scan field every warehouse screen uses. A keyboard-mode scanner types
// the code and presses Enter, so the field acts on Enter with no button, and
// keeps focus so the next scan always lands in it. Typing a code and
// pressing Enter works the same way, for testing without a scanner.

type Tone = ScanResult["tone"];

let audio: AudioContext | null = null;

/** Short beeps so staff don't need to read the screen: high = good, low buzz = wrong. */
function beep(tone: Tone) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const pattern: [number, number, OscillatorType][] =
      tone === "success"
        ? [[1046, 0.12, "sine"]]
        : tone === "warning"
          ? [[740, 0.1, "triangle"], [740, 0.1, "triangle"]]
          : [[196, 0.45, "square"]];
    let at = ctx.currentTime;
    for (const [freq, length, type] of pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + length);
      at += length + 0.06;
    }
    if (tone !== "success") navigator.vibrate?.(tone === "error" ? [120, 60, 120] : 80);
  } catch {
    // No audio (blocked or unsupported): the colours still show.
  }
}

type HistoryEntry = { id: number; code: string; qty: number; result: ScanResult };

export function ScanStation({
  onScan,
  prompt,
  idleTitle,
  idleBody,
  allowQuantity = true,
  disabled,
  children,
}: {
  /** Handles one scan; return what to show. */
  onScan: (code: string, qty: number) => Promise<ScanResult>;
  /** Label above the field, e.g. "Scan an item". */
  prompt: string;
  idleTitle: string;
  idleBody?: string;
  allowQuantity?: boolean;
  disabled?: boolean;
  /** Extra controls under the field (bin badge, etc.). */
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const counter = useRef(0);

  const refocus = useCallback(() => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true });
  }, [disabled]);

  // Take focus back whenever nothing else useful has it (a stray click on the
  // page), but leave it alone while someone is typing in another field.
  useEffect(() => {
    refocus();
    const timer = window.setInterval(() => {
      const active = document.activeElement;
      if (!active || active === document.body) refocus();
    }, 800);
    return () => window.clearInterval(timer);
  }, [refocus]);

  async function submit() {
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    setCode("");
    let result: ScanResult;
    try {
      result = await onScan(value, allowQuantity ? qty : 1);
    } catch {
      result = { ok: false, tone: "error", message: "Couldn't reach the server. Scan again." };
    }
    beep(result.tone);
    setLast(result);
    setHistory((h) => [{ id: ++counter.current, code: value, qty, result }, ...h].slice(0, 12));
    // A larger quantity is for one bulk scan; go back to 1 afterwards.
    if (result.ok) setQty(1);
    setBusy(false);
    refocus();
  }

  const tone: Tone | "idle" = last ? last.tone : "idle";
  const ToneIcon =
    tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : tone === "error" ? XCircle : ScanLine;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="status"
        aria-live="assertive"
        className={cn(
          "flex min-h-36 items-center gap-5 rounded-2xl p-6 text-white transition-colors duration-150 sm:p-8",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-gold text-navy",
          tone === "error" && "bg-destructive",
          tone === "idle" && "bg-navy",
        )}
      >
        <ToneIcon className="size-14 shrink-0 sm:size-16" strokeWidth={1.8} />
        <div className="min-w-0">
          <p className="text-2xl leading-tight font-bold sm:text-3xl">
            {last ? last.message : idleTitle}
          </p>
          {!last && idleBody ? <p className="mt-1.5 text-base opacity-80">{idleBody}</p> : null}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="scan-field" className="mb-1.5 block text-sm font-semibold text-navy">
            {prompt}
          </label>
          <input
            ref={inputRef}
            id="scan-field"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              // Handled here rather than by form submission: a form with two
              // fields and no submit button doesn't submit on Enter.
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            disabled={disabled}
            placeholder={busy ? "Checking…" : "Scan or type a code, then press Enter"}
            className="h-16 w-full rounded-xl border-2 border-navy/20 bg-white px-5 font-mono text-2xl tracking-wide text-navy uppercase outline-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:normal-case focus:border-teal focus:ring-4 focus:ring-teal/20 disabled:opacity-50"
          />
        </div>
        {allowQuantity ? (
          <div className="sm:w-32">
            <label htmlFor="scan-qty" className="mb-1.5 block text-sm font-semibold text-navy">
              Quantity
            </label>
            <input
              id="scan-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(10000, Math.floor(Number(e.target.value) || 1))))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  refocus();
                }
              }}
              className={cn(
                "h-16 w-full rounded-xl border-2 bg-white px-4 text-center font-mono text-2xl text-navy outline-none focus:border-teal",
                qty > 1 ? "border-gold" : "border-navy/20",
              )}
            />
          </div>
        ) : null}
      </form>
      {allowQuantity && qty > 1 ? (
        <p className="-mt-1 text-sm font-semibold text-gold-300">
          The next scan counts as {qty} units.
        </p>
      ) : null}

      {children}

      {history.length > 0 ? (
        <div className="rounded-xl border border-stone bg-white">
          <p className="border-b border-stone px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-graphite">
            Recent scans
          </p>
          <ul className="divide-y divide-stone">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    h.result.tone === "success" && "bg-success",
                    h.result.tone === "warning" && "bg-gold",
                    h.result.tone === "error" && "bg-destructive",
                  )}
                />
                <span className="w-36 shrink-0 truncate font-mono text-xs text-graphite">
                  {h.code}
                  {h.qty > 1 ? ` x${h.qty}` : ""}
                </span>
                <span className="min-w-0 truncate text-navy">{h.result.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
