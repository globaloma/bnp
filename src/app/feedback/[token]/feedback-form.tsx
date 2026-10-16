"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, LifeBuoy, Star, ThumbsUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback, type FeedbackResult } from "./actions";

export function FeedbackForm({ token }: { token: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [rating, setRating] = useState(0);
  const [state, formAction, pending] = useActionState<FeedbackResult | null, FormData>(
    submitFeedback.bind(null, token),
    null,
  );

  if (state?.ok) {
    return (
      <div className="mt-8 flex flex-col items-center text-center">
        {state.receivedOk ? (
          <CheckCircle2 className="size-12 text-success" />
        ) : (
          <LifeBuoy className="size-12 text-teal-700" />
        )}
        <h2 className="mt-4 text-lg font-semibold text-navy">
          {state.receivedOk ? "Thank you for your review" : "We're on it"}
        </h2>
        <p className="mt-2 text-sm text-graphite">
          {state.receivedOk
            ? "Glad your order arrived well."
            : "Our operations team has been notified and will reach out to you shortly."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="receivedOk" value={answer ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <ChoiceButton
          selected={answer === "yes"}
          onClick={() => setAnswer("yes")}
          icon={<ThumbsUp className="size-5" />}
          label="Yes, all good"
        />
        <ChoiceButton
          selected={answer === "no"}
          onClick={() => setAnswer("no")}
          icon={<TriangleAlert className="size-5" />}
          label="There's a problem"
          tone="warning"
        />
      </div>

      {answer === "yes" ? (
        <>
          <div>
            <Label>How would you rate your order?</Label>
            <input type="hidden" name="rating" value={rating || ""} />
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setRating(n)}
                  className="rounded p-1 text-gold transition-transform hover:scale-110"
                >
                  <Star className={cn("size-8", n <= rating ? "fill-current" : "fill-none text-stone")} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="review">Leave a review (optional)</Label>
            <Textarea
              id="review"
              name="review"
              rows={4}
              maxLength={1000}
              placeholder="What did you like about the product or the delivery?"
              className="mt-2 bg-white"
            />
          </div>
        </>
      ) : null}

      {answer === "no" ? (
        <div>
          <Label htmlFor="issue">What went wrong?</Label>
          <Textarea
            id="issue"
            name="issue"
            rows={5}
            required
            maxLength={2000}
            placeholder="For example: wrong item, damaged package, missing items, not received"
            className="mt-2 bg-white"
          />
        </div>
      ) : null}

      {state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {answer ? (
        <Button type="submit" disabled={pending || (answer === "yes" && rating === 0)}>
          {pending ? "Sending..." : answer === "yes" ? "Submit review" : "Report problem"}
        </Button>
      ) : null}
    </form>
  );
}

function ChoiceButton({
  selected,
  onClick,
  icon,
  label,
  tone = "default",
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "warning";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border bg-white px-3 py-4 text-sm font-semibold transition-colors",
        selected
          ? tone === "warning"
            ? "border-destructive text-destructive"
            : "border-teal-700 text-teal-700"
          : "border-stone text-navy hover:border-mist",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
