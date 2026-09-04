import Link from "next/link";
import { Logo } from "@/components/marketing/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-navy">
      <div className="container-page flex h-16 items-center">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </div>
      <div className="container-page pb-8 text-center text-xs text-mist">
        <Link href="/" className="hover:text-teal-300">
          Back to bnpfulfillment.com
        </Link>
      </div>
    </div>
  );
}
