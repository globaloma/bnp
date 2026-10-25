"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitReview } from "@/app/marketplace/actions";

export function ReviewForm({
  productId,
  existing,
}: {
  productId: string;
  existing: { rating: number; body: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md border border-teal px-3 py-1.5 text-sm font-semibold text-teal-700 hover:bg-teal/5"
      >
        {existing ? "Edit your review" : "Write a review"}
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex max-w-lg flex-col gap-3 rounded-lg border border-stone p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (rating < 1) {
          toast.error("Choose 1 to 5 stars.");
          return;
        }
        start(async () => {
          const result = await submitReview(productId, rating, body);
          if (result.ok) {
            toast.success(result.message ?? "Saved");
            setOpen(false);
          } else toast.error(result.error);
        });
      }}
    >
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
          >
            <Star className={cn("size-6", (hover || rating) >= n ? "fill-gold text-gold" : "text-stone")} />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="What did you like or not like? (optional)"
        className="rounded-md border border-stone px-3 py-2 text-sm text-navy outline-none focus-visible:border-teal"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Saving" : "Post review"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-graphite hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
