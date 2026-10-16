import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { company } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${company.name} collects, uses and protects personal information.`,
};

const email = <a href={`mailto:${company.email}`}>{company.email}</a>;

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>
        {company.name} is operated by BoxNPick Global, based in {company.primaryHub.city}. We are
        responsible for the personal information described in this policy and handle it in line
        with the Nigeria Data Protection Act 2023. Questions about your information can be sent to{" "}
        {email}.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>
          <strong>Merchants and fulfillment centers.</strong> Business name, contact person, email,
          phone number and product category when you sign up; your logo and any public storefront
          details you add (description, WhatsApp number, Instagram); your products, stock and
          orders; wallet transactions; and, if you withdraw funds, your bank name, account number
          and account name.
        </p>
        <p>
          <strong>Customers.</strong> When you order from a storefront: your name, phone number,
          delivery address, email address if you give one, and what you ordered. If you respond to
          a delivery message, we also keep your rating, review or problem report and any WhatsApp
          replies you send us.
        </p>
        <p>
          <strong>Automatically.</strong> Sign-in cookies that keep you logged in, the contents of
          your storefront cart and the order number and phone you last tracked (both stored only in
          your own browser), and standard server logs such as
          IP address and browser type, which we use to keep the platform secure and working.
          To stop spam and password guessing, our forms also keep a scrambled code made from
          your connection for up to an hour; it can&apos;t be turned back into your IP address.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>to create and run your account, and to review new applications;</li>
        <li>to store, pick, pack and deliver orders, and to let customers track them;</li>
        <li>to take payments, charge fees and process wallet top-ups and withdrawals;</li>
        <li>
          to send service messages, such as order and restock alerts, order confirmations,
          password resets, and a WhatsApp message asking customers to confirm delivery;
        </li>
        <li>to handle returns, claims and problems reported after delivery;</li>
        <li>to prevent fraud, keep the platform secure and meet our legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "basis",
    title: "Our legal basis",
    body: (
      <p>
        We use your information because we need it to provide the service you signed up for or the
        order you placed (performance of a contract); because we have a legitimate interest in
        running a secure, reliable platform; because the law requires it, for example tax and
        accounting records; or, where we ask for it, with your consent, which you can withdraw at
        any time.
      </p>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <p>We don&apos;t sell personal information. We share it only where needed:</p>
        <ul>
          <li>
            <strong>The merchant you bought from</strong> sees your name, phone number, address and
            order, so they can fulfil it and contact you about it.
          </li>
          <li>
            <strong>Fulfillment centers and riders</strong> on our network see the order details
            needed to pack and deliver it.
          </li>
          <li>
            <strong>Service providers</strong> that run parts of the platform for us: Supabase
            (database and accounts), Vercel (website hosting), Paystack (payments and bank
            transfers), Resend (email), Twilio (WhatsApp messages) and Sentry (error reports, which record what went wrong and on which page, without your personal details).
          </li>
          <li>
            <strong>Authorities</strong>, when the law requires it or to protect people from harm
            or fraud.
          </li>
        </ul>
        <p>
          Some of these providers store data outside Nigeria. When that happens we rely on their
          contractual commitments to protect it to the standard required by Nigerian law.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments",
    body: (
      <p>
        Card and bank payments are processed by Paystack. Your card details go directly to
        Paystack and are never seen or stored by BNP. For withdrawals, we pass your bank account
        details to Paystack to verify the account and send the transfer.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    body: (
      <p>
        We only use what the platform needs to work: cookies that keep you signed in, and your
        browser&apos;s local storage to remember your storefront cart and the order you last tracked,
        which you can clear from the tracking page. We don&apos;t use
        advertising or tracking cookies, and we don&apos;t run third-party analytics.
      </p>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <p>
        We keep account information while your account is open. Order, payment and wallet records
        are kept for as long as Nigerian tax and accounting law requires, even after an account is
        closed. Other information is deleted or anonymised when we no longer need it for the
        purposes above.
      </p>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        Information is encrypted in transit, and access is restricted so that each merchant and
        fulfillment center can only see the data they need. Passwords are stored securely by our
        account provider and are never visible to BNP staff. No system is perfectly secure, but if
        a breach affects your information we will tell you and the regulator as the law requires.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>
        <ul>
          <li>give you a copy of the personal information we hold about you;</li>
          <li>correct information that is wrong or incomplete;</li>
          <li>delete your information, where we don&apos;t need to keep it by law;</li>
          <li>stop or limit how we use it, or object to a particular use;</li>
          <li>send your information to you or another provider in a usable format.</li>
        </ul>
        <p>
          Email {email} to make a request. We&apos;ll respond within 30 days. You can also
          complain to the Nigeria Data Protection Commission.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        BNP isn&apos;t intended for children. Business accounts must be opened by adults, and we
        don&apos;t knowingly collect information from anyone under 18.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We&apos;ll update the date at the top of this page when this policy changes, and email
        account holders about significant changes.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="13 October 2026"
      intro={
        <p>
          This policy explains what personal information {company.name} collects from merchants,
          fulfillment centers and customers, why, who we share it with and the choices you have.
        </p>
      }
      sections={sections}
      related={{ href: "/terms", label: "Terms of Service" }}
    />
  );
}
