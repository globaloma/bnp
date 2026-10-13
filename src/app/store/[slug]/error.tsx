"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StatusPanel } from "@/components/status-page";
import { Button } from "@/components/ui/button";

export default function StoreError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPanel
      kind="error"
      title="Something went wrong"
      message="This page didn't load properly. Your cart is safe. Please try again."
      digest={error.digest}
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <Button render={<Link href={`/store/${slug}`} />} variant="outline">
            Back to store
          </Button>
        </>
      }
    />
  );
}
