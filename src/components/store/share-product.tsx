"use client";

import { Check, Link2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Copy-link and WhatsApp share buttons, so merchants and customers can pass a product on. */
export function ShareProduct({
  url,
  name,
  className,
}: {
  url: string;
  name: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link. Copy it from the address bar instead.");
    }
  }

  const button =
    "inline-flex h-9 items-center gap-2 rounded-md border border-stone px-3 text-xs font-semibold text-navy transition-colors hover:border-teal hover:text-teal-700";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs text-mist">Share:</span>
      <button type="button" onClick={copy} className={button}>
        {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${name} ${url}`)}`}
        target="_blank"
        rel="noreferrer"
        className={button}
      >
        <MessageCircle className="size-3.5" />
        WhatsApp
      </a>
    </div>
  );
}
