/**
 * Single source of truth for all marketing copy.
 * Content is lifted from the original PRD (reference/index.html) and lightly
 * rewritten for a cleaner voice. No em dashes, no en dashes used as separators.
 */

export const company = {
  name: "BNP Fulfillment",
  legalName: "BNP Fulfillment, BoxNPick Global",
  tagline: "No branch. No staff. No operational stress.",
  phone: "+2348054666346",
  phoneDisplay: "(+234) 805 466 6346",
  email: "bnpfulfillment@gmail.com",
  website: "bnpfulfillment.com",
  whatsapp: "https://wa.me/2348054666346",
  locations: ["Abuja", "Lagos", "USA"],
  primaryHub: {
    city: "Abuja, Nigeria",
    area: "Jabi, heart of the FCT",
  },
} as const;

export const hero = {
  eyebrow: "Abuja, Lagos and USA",
  titleLines: ["No branch.", "No staff.", "No operational stress."],
  subtitle:
    "BNP Fulfillment is your Abuja operations partner. We store your inventory, fulfil your orders and deliver to your customers, so you stay focused on growing your business.",
  primaryCta: { label: "Become a partner", href: "#apply" },
  secondaryCta: { label: "See how it works", href: "#how" },
  stats: [
    { value: 2400, suffix: "+", label: "Orders fulfilled" },
    { value: 80, suffix: "+", label: "Active partners" },
    { value: 7, suffix: " days", label: "Average launch time" },
    { value: 98, suffix: "%", label: "On time delivery" },
  ],
} as const;

export const services = {
  label: "What we do",
  title: "Everything after the sale, handled.",
  description:
    "From the moment an order is placed to the moment it reaches your customer, BNP manages the entire fulfillment chain on your behalf.",
  items: [
    {
      icon: "Warehouse",
      title: "Warehousing and storage",
      body: "Your products are received, labelled, photographed and stored securely in our Abuja facility. Every unit is tracked by SKU and fully insured in our care.",
    },
    {
      icon: "PackageCheck",
      title: "Pick, pack and dispatch",
      body: "When an order comes in, our team picks the exact item from your shelf, packs it professionally and dispatches it to your customer, same day or next day.",
    },
    {
      icon: "Bike",
      title: "Last mile delivery",
      body: "BNP riders cover Abuja and surrounding areas. You can also add your own riders to the platform with custom delivery fees for full flexibility on dispatch.",
    },
    {
      icon: "BarChart3",
      title: "Inventory management",
      body: "Upload products with photos, pricing and SKUs through your partner dashboard. Receive automatic alerts when stock runs low, before it becomes a problem.",
    },
    {
      icon: "Wallet",
      title: "Payments and settlement",
      body: "We handle payment collection for walk in and on site transactions. Monthly sales reports and settlement summaries are available on your dashboard at any time.",
    },
    {
      icon: "Store",
      title: "Walk in and brand presence",
      body: "Our Jabi hub acts as your Abuja address. Customers can walk in to collect orders, interact with your products and experience your brand without you opening a store.",
    },
    {
      icon: "Undo2",
      title: "Returns and claims",
      body: "Returns are processed through the partner portal with photo documentation. Claims are handled transparently with a full audit trail and a written outcome for every case.",
    },
    {
      icon: "TrendingUp",
      title: "Reporting and insights",
      body: "Access monthly inventory and financial reports from your dashboard. Export to CSV or PDF at any time. Your data is always yours, with no need to request it from us.",
    },
  ],
} as const;

export const steps = {
  label: "How it works",
  title: "From application to delivery in seven steps.",
  description:
    "A straightforward process built for Nigerian businesses. No logistics expertise required. Most partners go live within five to seven days of approval.",
  items: [
    {
      icon: "Truck",
      title: "Send your stock",
      body: "Ship or drop off your inventory at our Jabi hub. We receive and log every unit.",
    },
    {
      icon: "ClipboardList",
      title: "We onboard it",
      body: "Your items are photographed, shelved and uploaded to your partner dashboard.",
    },
    {
      icon: "MonitorSmartphone",
      title: "You control orders",
      body: "You create, approve and manage every order from your dashboard, from anywhere in the world, and track them in real time.",
    },
    {
      icon: "PackageCheck",
      title: "Pick, pack and deliver",
      body: "BNP picks, packs and dispatches. Same day or next day within Abuja.",
    },
    {
      icon: "CreditCard",
      title: "Payments handled",
      body: "Walk in and on site payments are collected and logged against your account.",
    },
    {
      icon: "FileBarChart",
      title: "Reports and settlement",
      body: "Monthly sales and inventory reports are ready in your dashboard to download anytime.",
    },
    {
      icon: "Rocket",
      title: "You scale",
      body: "You focus on marketing and growth. We keep the operations running smoothly.",
    },
  ],
} as const;

export const audience = {
  label: "Who it is for",
  title: "Built for product businesses ready to grow.",
  description:
    "BNP is the right fit for brands that are already selling and want to reach Abuja customers faster, more reliably and without the overhead of a physical operation.",
  fitList: [
    "You sell online, on social media or through WhatsApp",
    "You ship to Abuja and deal with delivery complaints",
    "You want same day or next day delivery in the FCT",
    "You need a local Abuja presence without a store",
    "You want to be seen as a multi city brand",
    "Your time is better spent on sales, not packing",
    "You want to test and build Abuja demand with low risk",
  ],
  industries: [
    "Fashion and accessories",
    "Skincare and beauty",
    "Hair and grooming",
    "Gadgets and electronics",
    "Homeware",
    "Non perishable foods",
    "Health and supplements",
    "Gifts and subscriptions",
    "African export goods",
    "Diaspora brands",
  ],
} as const;

export const hub = {
  label: "Our hub",
  title: "Your new Abuja address.",
  description:
    "The BNP primary facility is in Jabi, one of the most accessible commercial areas in Abuja. It is your brand's physical presence in the FCT without the cost of a branch.",
  points: [
    {
      icon: "Zap",
      title: "Same day and next day delivery",
      body: "With your stock already in Abuja, we dispatch fast. Orders placed before noon go out the same day to FCT customers.",
    },
    {
      icon: "Footprints",
      title: "Customer walk ins welcome",
      body: "Customers can visit our Jabi hub in person to collect orders or browse products, giving your brand a real world touchpoint in the capital.",
    },
    {
      icon: "ShieldCheck",
      title: "Secure, insured storage",
      body: "All products in our facility are monitored by CCTV and fully insured. Damage claims are handled with complete documentation and transparency.",
    },
    {
      icon: "Globe",
      title: "Expanding to Lagos and the USA",
      body: "Partners can assign inventory to Lagos or our Texas facility on the same account. One dashboard, multiple cities, no new contracts.",
    },
  ],
  card: {
    eyebrow: "Primary hub",
    city: "Abuja, Nigeria",
    area: "Jabi, heart of the FCT",
    items: [
      "Secure, organised warehouse facility",
      "BNP riders on ground daily",
      "Partner drop off and walk in enabled",
      "Same day dispatch cutoff at noon",
      "CCTV monitored storage bays",
      "Lagos expansion active",
      "USA facility in Texas, operational",
    ],
  },
} as const;

export const pricing = {
  label: "Pricing",
  title: "Simple, transparent costs.",
  description:
    "Three straightforward fees. No hidden charges, no long term lock in. If you do not sell, your fulfillment fee is zero.",
  tiers: [
    {
      label: "Onboarding",
      name: "Annual subscription",
      amount: "₦50,000",
      qualifier: "Paid once per year, not monthly",
      detail:
        "Covers your full account setup, inventory onboarding and photography, partner dashboard access, WhatsApp integration and staff training.",
      highlighted: false,
    },
    {
      label: "Monthly",
      name: "Storage fee",
      amount: "₦10,000",
      qualifier: "Per square metre of space used, per month",
      detail:
        "Covers secure shelved storage, real time inventory tracking, low stock alerts and full insurance on all goods in our facility.",
      highlighted: true,
    },
    {
      label: "Performance",
      name: "Fulfillment fee",
      amount: "7%",
      qualifier: "Of total sales value per month. No sale, no charge.",
      detail:
        "Covers pick, pack and dispatch per order. If your brand sells ₦500,000 in a month, the fulfillment fee is ₦35,000, and you paid no rent, no salaries and no overhead.",
      highlighted: false,
    },
  ],
  note: "All fees are deducted automatically from your partner wallet. You keep full visibility of every charge through your dashboard. No surprise invoices, no manual follow ups.",
} as const;

export const testimonials = {
  label: "Partner stories",
  title: "What our partners say.",
  items: [
    {
      quote:
        "I used to dread Abuja orders. The interstate complaints were endless. Since moving my stock to the BNP Jabi hub, my FCT customers get next day delivery and my reviews improved instantly.",
      name: "Amara Chukwu",
      business: "Amara Skincare, Lagos based and Abuja active",
    },
    {
      quote:
        "My customers kept asking if I had a branch in Abuja. Now I tell them yes, because I do. The BNP hub is my Abuja address. Conversions from the FCT went up significantly within two months.",
      name: "Tunde Akinwale",
      business: "TechWear Nigeria, gadgets and accessories",
    },
    {
      quote:
        "Opening a physical store would have cost me over ₦8 million upfront. BNP let me test the Abuja market in seven days at a fraction of the cost. There really is no comparison.",
      name: "Fatima Musa",
      business: "Fatima's Organics, health and supplements",
    },
  ],
} as const;

export const apply = {
  label: "Partner application",
  title: "Ready to get started?",
  description:
    "Most partners go live within five to seven days of approval. No payment is required at application stage. We confirm the fit first.",
  perks: [
    {
      icon: "Zap",
      title: "Live in five to seven days",
      body: "Apply, get approved, send your stock and start selling in Abuja.",
    },
    {
      icon: "Smartphone",
      title: "Manage from your phone",
      body: "Your dashboard works fully on mobile. Create orders on WhatsApp.",
    },
    {
      icon: "Package",
      title: "Full service operations",
      body: "We handle storage, packing, dispatch, returns and reporting.",
    },
    {
      icon: "Globe",
      title: "Scale beyond Abuja when ready",
      body: "Add Lagos or the USA on the same account with no new application.",
    },
  ],
  form: {
    title: "Apply to become a partner",
    subtitle: "Takes three minutes. We respond within 48 hours.",
    categories: [
      "Fashion and accessories",
      "Skincare and beauty",
      "Hair and grooming",
      "Gadgets and electronics",
      "Homeware",
      "Non perishable foods",
      "Health and supplements",
      "Gifts and subscriptions",
      "African export goods",
      "Other",
    ],
    locations: ["Abuja (Jabi hub)", "Lagos", "USA, Texas", "Multiple locations"],
    volumes: [
      "Under 50 orders per month",
      "50 to 200 orders per month",
      "200 to 500 orders per month",
      "Over 500 orders per month",
    ],
    disclaimer:
      "No payment required at this stage. We confirm fit before any fees are discussed.",
    success:
      "Application received. Our team will be in touch within 48 hours.",
  },
} as const;

export const faq = {
  label: "FAQ",
  title: "Common questions.",
  items: [
    {
      q: "How do I get my products into your facility?",
      a: "Once approved, ship your inventory to our Jabi hub or drop it off in person. We receive, count, photograph and shelf your stock, and you confirm it in your dashboard within 24 hours.",
    },
    {
      q: "How does the 7 percent fulfillment fee work exactly?",
      a: "It applies to the total value of items sold in that month. If you sell ₦200,000 worth of goods, the fee is ₦14,000. If sales are zero, the fulfillment fee is zero and only storage applies.",
    },
    {
      q: "Can my Abuja customers walk in to collect orders?",
      a: "Yes. Our Jabi hub functions as a collection point. Customers walk in, reference their order and collect directly, giving your brand a genuine physical touchpoint in Abuja.",
    },
    {
      q: "What happens if a product is damaged in your care?",
      a: "All stock is fully insured. File a claim through the partner portal with photos and a description. BNP processes and resolves every claim with full documentation and a written outcome.",
    },
    {
      q: "Can I use my own delivery riders?",
      a: "Yes. You can add your own riders to the platform, set their delivery fees independently and assign orders to them. You can also switch between BNP riders and your own at any time.",
    },
    {
      q: "Can I expand to Lagos or the USA later?",
      a: "Yes. Assign new inventory to the Lagos or USA warehouse directly from your existing dashboard. No new application and no new contract. Everything stays on one account.",
    },
  ],
} as const;

export const nav = {
  links: [
    { label: "Services", href: "#services" },
    { label: "How it works", href: "#how" },
    { label: "Pricing", href: "#pricing" },
    { label: "Our hub", href: "#hub" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: { label: "Become a partner", href: "#apply" },
} as const;

export const footer = {
  description:
    "The partner first fulfillment network of Nigeria, storing and shipping your products across Abuja, Lagos and the USA.",
  columns: [
    {
      title: "Services",
      links: [
        { label: "Warehousing", href: "#services" },
        { label: "Pick and pack", href: "#services" },
        { label: "Last mile delivery", href: "#services" },
        { label: "Returns and claims", href: "#services" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "How it works", href: "#how" },
        { label: "Pricing", href: "#pricing" },
        { label: "Our hub in Jabi", href: "#hub" },
        { label: "Partner application", href: "#apply" },
      ],
    },
  ],
} as const;
