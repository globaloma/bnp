import { Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

// Display face for marketing headings. Loaded here, not in the root layout,
// so the dashboards keep their own type.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`${jakarta.variable} flex min-h-dvh flex-col bg-cream`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
