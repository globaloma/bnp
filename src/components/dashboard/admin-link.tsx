import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function AdminLink() {
  return (
    <Link
      href="/admin"
      className="m-3 flex items-center gap-2 rounded-lg border-l-2 border-teal bg-teal/10 p-3 text-[12px] font-semibold text-teal-300 transition-colors hover:bg-teal/20"
    >
      <ShieldCheck className="size-4" />
      Admin console
    </Link>
  );
}
