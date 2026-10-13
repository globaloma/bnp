import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

// Any URL that doesn't exist, and any notFound() that isn't caught by a
// closer not-found file (e.g. a store slug that doesn't exist).
export default function NotFound() {
  return (
    <StatusPage
      kind="not-found"
      title="We couldn't find that page"
      message="The link may be broken, or the page may have been moved or removed. If you followed a store link, the store may no longer be active."
      actions={
        <>
          <Button render={<Link href="/" />}>Go to homepage</Button>
          <Button render={<Link href="/login" />} variant="outline">
            Sign in
          </Button>
        </>
      }
    />
  );
}
