import type { ReactNode } from "react";
import { AlertTriangle, Compass } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { cn } from "@/lib/utils";

// Shared UI for "page not found" and "something went wrong". No hooks, so it
// works from both server not-found files and client error boundaries.

type Kind = "not-found" | "error";

function Icon({ kind }: { kind: Kind }) {
  return (
    <span
      className={cn(
        "mx-auto flex size-12 items-center justify-center rounded-full",
        kind === "error" ? "bg-destructive/10 text-destructive" : "bg-teal/10 text-teal",
      )}
    >
      {kind === "error" ? <AlertTriangle className="size-6" /> : <Compass className="size-6" />}
    </span>
  );
}

function Reference({ digest }: { digest?: string }) {
  if (!digest) return null;
  return (
    <p className="mt-4 text-xs text-mist">
      If this keeps happening, contact us and quote reference{" "}
      <span className="font-mono text-graphite">{digest}</span>.
    </p>
  );
}

/** Whole-screen version, for when there's no surrounding layout to keep. */
export function StatusPage({
  kind,
  title,
  message,
  actions,
  digest,
}: {
  kind: Kind;
  title: string;
  message: string;
  actions: ReactNode;
  digest?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-navy px-4 py-12 text-center">
      <Logo />
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,42,68,0.5)]">
        {kind === "not-found" ? (
          <p className="text-5xl font-semibold tracking-tight text-navy">404</p>
        ) : (
          <Icon kind={kind} />
        )}
        <h1 className="mt-4 text-xl font-semibold text-navy">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-graphite">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div>
        <Reference digest={digest} />
      </div>
    </div>
  );
}

/** In-page version, shown inside the dashboard or a store so the navigation stays. */
export function StatusPanel({
  kind,
  title,
  message,
  actions,
  digest,
}: {
  kind: Kind;
  title: string;
  message: string;
  actions: ReactNode;
  digest?: string;
}) {
  return (
    <div className="mx-auto my-10 max-w-md rounded-2xl border border-stone bg-white p-8 text-center">
      <Icon kind={kind} />
      <h1 className="mt-4 text-lg font-semibold text-navy">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-graphite">{message}</p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div>
      <Reference digest={digest} />
    </div>
  );
}
