"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StorefrontLink({ slug, siteUrl }: { slug: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${siteUrl}/store/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied - the link is still visible to copy by hand.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[240px] truncate rounded-md border border-stone bg-white px-3 py-1.5 text-xs text-graphite md:inline-block">
        {url}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button
        render={<Link href={`/store/${slug}`} target="_blank" />}
        variant="secondary"
        size="sm"
      >
        <ExternalLink className="size-3.5" />
        View storefront
      </Button>
    </div>
  );
}
