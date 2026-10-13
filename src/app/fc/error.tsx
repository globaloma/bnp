"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import Link from "next/link";
import { StatusPanel } from "@/components/status-page";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <StatusPanel
      kind="error"
      title="This page didn't load"
      message="Something went wrong while loading this page. Your data is safe. Try again, or go back and continue from there."
      digest={error.digest}
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <Button render={<Link href="/fc" />} variant="outline">
            Back to overview
          </Button>
        </>
      }
    />
  );
}
