import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { company } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that apply when you use ${company.name} as a merchant, fulfillment center or customer.`,
};

const email = <a href={`mailto:${company.email}`}>{company.email}</a>;

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          {company.name} is operated by BoxNPick Global (&ldquo;BNP&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;). These terms apply to everyone who uses {company.website}: merchants
          who store and sell products with us, fulfillment centers that work on our network, and
          customers who buy from a merchant&apos;s storefront.
        </p>
        <p>
          By creating an account, placing an order or otherwise using the platform, you agree to
          these terms and to our <Link href="/privacy">Privacy Policy</Link>. If you don&apos;t
          agree, please don&apos;t use the platform.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <ul>
        <li>
          Merchant and fulfillment center accounts are for businesses. You must be at least 18 and
          able to enter into a contract on behalf of the business you register.
        </li>
        <li>
          Give us accurate details and keep them up to date from your account Settings. You need
          to confirm your email address before you can sign in.
        </li>
        <li>
          Every new account is reviewed before it gets dashboard access. We may decline an
          application, for example if the products or business aren&apos;t a fit for our
          facilities.
        </li>
        <li>
          Keep your password private. You&apos;re responsible for activity on your account, and
          should tell us straight away at {email} if you think someone else has accessed it.
        </li>
      </ul>
    ),
  },
  {
    id: "services",
    title: "What we provide to merchants",
    body: (
      <>
        <p>Depending on what you use, our services include:</p>
        <ul>
          <li>receiving, labelling, photographing and storing your stock in our facilities;</li>
          <li>picking, packing and dispatching your orders;</li>
          <li>last mile delivery by BNP riders, or by your own riders that you add to the platform;</li>
          <li>a public storefront where customers can browse and buy your products;</li>
          <li>a dashboard for inventory, orders, wallet, returns and claims, and reports.</li>
        </ul>
        <p>
          Delivery times we show are estimates. We aim to meet them but can&apos;t guarantee them,
          particularly where delays are caused by things outside our control, such as weather,
          road closures, strikes or a customer being unavailable.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees and your wallet",
    body: (
      <>
        <p>Our standard fees for merchants are:</p>
        <ul>
          <li>
            <strong>Annual subscription:</strong> ₦50,000, paid once a year, covering account
            setup, onboarding and dashboard access.
          </li>
          <li>
            <strong>Storage:</strong> ₦10,000 per square metre of space used, per month.
          </li>
          <li>
            <strong>Fulfillment:</strong> 7% of the total value of items sold in a month. If you
            sell nothing, this fee is zero.
          </li>
        </ul>
        <p>
          Fees are deducted from your partner wallet, and every charge is shown in your dashboard.
          You top up your wallet by card or bank payment through Paystack, and can withdraw your
          available balance to a bank account in your business&apos;s name that you have verified
          in the dashboard. If your wallet balance reaches zero, we may pause fulfillment of new
          orders until it is topped up.
        </p>
        <p>
          We&apos;ll give you at least 30 days&apos; notice by email before changing our fees.
          Any agreed custom pricing in writing takes priority over the standard fees above.
        </p>
      </>
    ),
  },
  {
    id: "products",
    title: "Your products",
    body: (
      <>
        <p>
          You remain the owner of your stock and the seller of your products. You&apos;re
          responsible for making sure your products, descriptions, photos and prices are accurate,
          lawful and that you have the right to sell them.
        </p>
        <p>We don&apos;t store or deliver:</p>
        <ul>
          <li>anything illegal to sell or possess in Nigeria, or counterfeit goods;</li>
          <li>weapons, ammunition, explosives, or flammable or hazardous materials;</li>
          <li>drugs, prescription medicines or controlled substances;</li>
          <li>perishable or temperature-sensitive goods, unless we have agreed in writing;</li>
          <li>live animals, cash, or items of exceptional value without prior agreement.</li>
        </ul>
        <p>
          We may refuse, return or remove from your storefront any item that breaks these rules
          or that we reasonably believe is unsafe.
        </p>
      </>
    ),
  },
  {
    id: "care",
    title: "Storage, damage and claims",
    body: (
      <>
        <p>
          Goods in our facilities are monitored and insured while in our care. If an item is lost
          or damaged while we hold or handle it, raise a claim from <strong>Returns and
          claims</strong> in your dashboard with photos and details as soon as you notice.
        </p>
        <p>
          We review every claim and give you a written outcome. Where we are responsible, we will
          compensate you for the documented cost value of the affected items, or replace or
          repair them where that&apos;s possible. We aren&apos;t responsible for damage caused by
          how an item was packaged before it reached us, by defects in the product itself, or by
          normal wear and tear.
        </p>
      </>
    ),
  },
  {
    id: "storefront",
    title: "Storefronts and customer orders",
    body: (
      <>
        <p>
          When a customer buys from a merchant&apos;s storefront, the sale is between the customer
          and the merchant. BNP provides the storefront, takes payment on the merchant&apos;s behalf
          through Paystack and fulfils the order. The merchant sets the products, prices, VAT and
          delivery fees.
        </p>
        <p>As a customer:</p>
        <ul>
          <li>
            give a correct phone number and delivery address, as we use them to deliver and to
            confirm delivery with you, including by WhatsApp;
          </li>
          <li>
            your order is confirmed once Paystack confirms your payment. If an item sells out
            before then, the merchant will contact you to offer a replacement or a refund;
          </li>
          <li>
            you can follow your order with your order number and phone number on the
            merchant&apos;s tracking page;
          </li>
          <li>
            if something is wrong with your order, report it from the link in your delivery
            message or contact the merchant. Returns and refunds follow the merchant&apos;s policy
            and your rights under Nigerian consumer protection law.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>Don&apos;t use the platform to:</p>
        <ul>
          <li>break the law or help anyone else break it;</li>
          <li>access accounts, orders or data that aren&apos;t yours;</li>
          <li>interfere with, overload or try to find weaknesses in the platform without our written permission;</li>
          <li>copy or scrape the platform or other merchants&apos; content in bulk;</li>
          <li>send spam, or mislead customers about your products or business.</li>
        </ul>
      </>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and closing your account",
    body: (
      <>
        <p>
          We may suspend or close an account that breaks these terms, puts customers or our
          facilities at risk, or has unpaid fees. Except where that would be unsafe or unlawful, we
          will tell you why and give you a chance to fix the problem first.
        </p>
        <p>
          You can close your account at any time by contacting us. We&apos;ll arrange for you to
          collect or receive any remaining stock once outstanding fees are settled, and pay out any
          remaining wallet balance to your verified bank account.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility to you",
    body: (
      <>
        <p>
          We provide the platform with reasonable care and skill. As far as the law allows, we
          aren&apos;t liable for indirect or consequential losses such as lost profits, lost sales
          or damage to reputation. Apart from claims for goods in our care (which are handled under
          section 6), our total liability to a merchant in any 12 month period is limited to the
          fees that merchant paid us in that period.
        </p>
        <p>
          Nothing in these terms limits any liability, or any right you have, that cannot be
          limited or excluded under Nigerian law.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms as the platform changes. We&apos;ll change the date at the top of
        this page, and for significant changes we&apos;ll email merchants and fulfillment centers at
        least 14 days before they take effect. Continuing to use the platform after that means you
        accept the updated terms.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. If you have a
        problem, please contact us first and we&apos;ll try to resolve it. Disputes that can&apos;t
        be resolved informally will be handled by the courts of the Federal Capital Territory,
        Abuja.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        {company.name}, {company.primaryHub.city}. Email {email}, call or WhatsApp{" "}
        <a href={`tel:${company.phone}`}>{company.phoneDisplay}</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="13 October 2026"
      intro={
        <p>
          These terms explain how {company.name} works, what we provide, what we expect from you
          and what each of us is responsible for. We&apos;ve kept them as plain as we can.
        </p>
      }
      sections={sections}
      related={{ href: "/privacy", label: "Privacy Policy" }}
    />
  );
}
