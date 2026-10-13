"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { StatusPanel } from "@/components/status-page";
import { Button } from "@/components/ui/button";

// A missing product or page inside a store that does exist. The store
// header stays, so customers can carry on shopping.
export default function StoreNotFound() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <StatusPanel
      kind="not-found"
      title="This item isn't available"
      message="It may have sold out, been removed by the seller, or the link may be wrong."
      actions={
        <Button render={<Link href={`/store/${slug}`} />}>See everything in this store</Button>
      }
    />
  );
}
