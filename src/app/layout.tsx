import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { company } from "@/lib/site-content";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${company.name}, your Abuja operations partner`,
    template: `%s | ${company.name}`,
  },
  description:
    "BNP Fulfillment stores your inventory, fulfils your orders and delivers to your customers across Abuja, Lagos and the USA. No branch, no staff, no operational stress.",
  keywords: [
    "fulfillment Nigeria",
    "Abuja warehousing",
    "third party logistics",
    "ecommerce fulfillment",
    "order fulfillment Abuja",
    "Jabi warehouse",
  ],
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: siteUrl,
    siteName: company.name,
    title: `${company.name}, your Abuja operations partner`,
    description:
      "Store your inventory, fulfil your orders and deliver to your customers across Abuja, Lagos and the USA.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${company.name}, your Abuja operations partner`,
    description:
      "Store your inventory, fulfil your orders and deliver to your customers across Abuja, Lagos and the USA.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
