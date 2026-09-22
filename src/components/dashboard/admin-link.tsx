import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck, ArrowLeftRight } from "lucide-react";

function SidebarShortcutLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="m-3 flex items-center gap-2 rounded-lg border-l-2 border-teal bg-teal/10 p-3 text-[12px] font-semibold text-teal-300 transition-colors hover:bg-teal/20"
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function AdminLink() {
  return <SidebarShortcutLink href="/admin" label="Admin console" icon={ShieldCheck} />;
}

export function BackToDashboardLink({ href }: { href: string }) {
  return (
    <SidebarShortcutLink href={href} label="Back to my dashboard" icon={ArrowLeftRight} />
  );
}
