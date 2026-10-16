"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setIssueResolved } from "./actions";

export function ResolveButton({ id, resolved }: { id: string; resolved: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={resolved ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setIssueResolved(id, !resolved);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {resolved ? "Reopen" : "Mark resolved"}
    </Button>
  );
}
