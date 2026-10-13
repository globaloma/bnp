"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import Link from "next/link";
import { StatusPage } from "@/components/status-page";
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
    <StatusPage
      kind="error"
      title="Something went wrong"
      message="Sorry, this page didn't load properly. Please try again. If it keeps happening, let us know."
      digest={error.digest}
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <Button render={<Link href="/" />} variant="outline">
            Go to homepage
          </Button>
        </>
      }
    />
  );
}
