"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";
import "./globals.css";

// Only shown if the root layout itself fails, so it has to bring its own
// <html>, <body> and styles.
export default function GlobalError({
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
    <html lang="en">
      <body className="antialiased">
        <title>Something went wrong | BNP Fulfillment</title>
        <StatusPage
          kind="error"
          title="Something went wrong"
          message="Sorry, BNP Fulfillment didn't load properly. Please try again in a moment."
          digest={error.digest}
          actions={
            <>
              <Button onClick={() => retry()}>Try again</Button>
              {/* A full page load on purpose: the app shell is what failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <Button render={<a href="/" />} variant="outline">
                Go to homepage
              </Button>
            </>
          }
        />
      </body>
    </html>
  );
}
