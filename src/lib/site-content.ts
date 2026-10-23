/**
 * Single source of truth for all marketing copy.
 * The public site speaks to merchants only: brands that want BNP to store,
 * pack and deliver for them. No em dashes, no en dashes used as separators.
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
    address: "Suite 207, Alba Plaza, Jabi, Abuja",
  },
  hours: "Monday to Friday, 8am to 6pm",
  // Shown on receipt PDFs under "Payment details". Null until the account
  // details are confirmed; the section stays hidden while it is.
  bankAccount: null as { bankName: string; accountNumber: string; accountName: string } | null,
} as const;

export const nav = {
  links: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "How it works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ],
  signIn: { label: "Sign in", href: "/login" },
  signUp: { label: "Start selling", href: "/signup" },
  quote: { label: "Get a quote", href: "/get-a-quote" },
} as const;

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export const hero = {
  title: "Your stock on our shelves. Your orders at their door.",
  subtitle:
    "BNP stores your inventory in Abuja, packs every order the day it comes in and delivers it to your customer. You keep selling. We handle everything after the sale.",
  primaryCta: { label: "Get a free quote", href: "/get-a-quote" },
  secondaryCta: { label: "See how it works", href: "/how-it-works" },
  stats: [
    { value: 2400, suffix: "+", label: "Orders fulfilled" },
    { value: 80, suffix: "+", label: "Brands on board" },
    { value: 98, suffix: "%", label: "Delivered on time" },
  ],
} as const;

export const highlights = [
  {
    icon: "Warehouse",
    title: "Secure, insured storage",
    body: "CCTV monitored shelves in Jabi. Every unit is counted, labelled and insured.",
  },
  {
    icon: "Zap",
    title: "Same day dispatch",
    body: "Orders in before noon leave the same day to customers across the FCT.",
  },
  {
    icon: "MonitorSmartphone",
    title: "Live from your phone",
    body: "See stock, orders and deliveries in real time from your dashboard.",
  },
] as const;

export const aboutTeaser = {
  label: "About BNP",
  title: "Your operations team in Abuja, without hiring one.",
  body: [
    "Most growing brands hit the same wall: more orders than they can pack, customers in cities they can't reach quickly, and no time left to actually sell.",
    "BNP Fulfillment is the team that takes that work off your hands. Send us your stock once. From then on we receive it, store it, pick and pack every order, and get it to your customer, while you watch it all from your dashboard.",
  ],
  points: [
    "Live in five to seven days",
    "No rent, no staff, no long contracts",
    "One dashboard for Abuja, Lagos and the USA",
    "Pay a share of sales only when you sell",
  ],
  cta: { label: "More about us", href: "/about" },
  badge: { value: "7", label: "days to go live" },
} as const;

export const whyUs = {
  label: "Why merchants choose BNP",
  title: "Built for brands that would rather sell than pack.",
  description:
    "You didn't start a business to tape boxes and chase riders. Here is what changes when BNP runs your operations.",
  points: [
    {
      title: "An Abuja address without a branch",
      body: "Our Jabi hub becomes your physical presence in the capital. Customers can walk in to collect, and you never sign a lease.",
    },
    {
      title: "Faster delivery, better reviews",
      body: "With your stock already in Abuja, FCT customers get their orders the same day or the next, not after a week in transit.",
    },
    {
      title: "Every unit accounted for",
      body: "Products are labelled with their own barcode and tracked from the moment they arrive. You always know what's on the shelf.",
    },
    {
      title: "Costs that follow your sales",
      body: "A yearly registration fee, refunded if you're not happy after your first month, storage by the space you use and a share of sales. No sales, no fulfillment fee.",
    },
  ],
} as const;

export const testimonials = {
  label: "Merchant stories",
  title: "Brands that handed us the busy work.",
  // Real testimonials from merchants, as posted on our Instagram.
  instagram: "https://www.instagram.com/bnp_fulfillment/",
  items: [
    {
      quote:
        "I had previously worked with another company and did not have a good experience. I agreed to partner and sell my PachaMama Foods products with BNP Fulfillment because their agent was very clear about its benefits: the website they provide, pick up at their office, or delivery within and outside Abuja. More importantly, they supported us by creating awareness of our products on their social media, which for me showed a true partnership. I have been with them for months and their professionalism is on point, their customer care always available, and payment and reconciliation has always been flawless.",
      name: "Tamara Egbedi",
      role: "CEO, PachaMama Foods",
    },
    {
      quote:
        "Partnering with BNP Fulfillment has allowed us to focus on what we do best: creating and curating top-tier shoe care solutions that keep your footwear looking its best. With BNP Fulfillment by our side, expect excellence in every box.",
      name: "Pariola Boluwatife",
      role: "Founder, Sneaklin",
    },
    {
      quote:
        "Thanks to BNP Fulfillment, we no longer worry about the backend. Our focus stays on creating skincare innovations that our customers love. Their reliable service ensures Beauty Realm products are delivered smoothly and on time, so every order reflects the same standard of quality we promise in our brand.",
      name: "Queen of Face",
      role: "M.D., Beauty Realm Cosmetics & Skincare Ltd.",
    },
    {
      quote:
        "I no get office for Abuja, my goods dey for BNP Fulfillment center. Now I don get branch in Abuja for free.",
      name: "Min Accessories",
      role: "@min_accessories",
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const services = {
  label: "What we do",
  title: "Everything after the sale, handled.",
  description:
    "From the moment your stock arrives to the moment your customer opens the parcel, BNP runs the whole chain for you.",
  items: [
    {
      slug: "warehousing",
      icon: "Warehouse",
      image: "/images/marketing/warehouse-floor.jpg",
      title: "Warehousing and storage",
      body: "Your products are received, counted, labelled and stored on secure shelves in our Abuja facility. Every unit is tracked by SKU and insured while in our care.",
      bullets: [
        "Counted and checked on arrival",
        "Barcode label on every product",
        "CCTV monitored, fully insured",
      ],
    },
    {
      slug: "pick-and-pack",
      icon: "PackageCheck",
      image: "/images/marketing/packing-order.jpg",
      title: "Pick, pack and dispatch",
      body: "When an order comes in, our team picks the exact item from your shelf, packs it properly and sends it out the same day or the next.",
      bullets: [
        "Same day dispatch before noon",
        "Careful packing for fragile items",
        "Every order scanned and checked",
      ],
    },
    {
      slug: "delivery",
      icon: "Bike",
      image: "/images/marketing/parcel-handover.jpg",
      title: "Last mile delivery",
      body: "BNP riders cover Abuja and its surroundings. Prefer your own riders? Add them to your account with their own delivery fees.",
      bullets: [
        "BNP riders on the ground daily",
        "Use your own riders if you like",
        "Customers confirm delivery on WhatsApp",
      ],
    },
    {
      slug: "storefront",
      icon: "Store",
      image: "/images/marketing/online-store.jpg",
      title: "Your own online store",
      body: "Every merchant gets a store link to share on Instagram, WhatsApp and anywhere else. Customers order and pay online, and the order lands straight in our warehouse.",
      bullets: [
        "Online card and transfer payments",
        "Order tracking for your customers",
        "Receipts sent automatically",
      ],
    },
    {
      slug: "inventory",
      icon: "BarChart3",
      image: "/images/marketing/stock-check.jpg",
      title: "Inventory management",
      body: "Add products with photos, prices and variants from your dashboard. See exactly what's on hand, what's reserved for orders and what's still available to sell.",
      bullets: [
        "Colours and sizes as separate SKUs",
        "Low stock alerts before you run out",
        "Bulk upload by CSV",
      ],
    },
    {
      slug: "walk-in",
      icon: "Footprints",
      image: "/images/marketing/boxes-trolley.jpg",
      title: "Walk in collection",
      body: "Our Jabi hub works as your Abuja address. Customers can walk in to collect their orders, so your brand has a real touchpoint in the capital.",
      bullets: [
        "Pickup option at checkout",
        "Your brand's Abuja presence",
        "No shop rent to pay",
      ],
    },
    {
      slug: "returns",
      icon: "Undo2",
      image: "/images/marketing/warehouse-staff.jpg",
      title: "Returns and claims",
      body: "Returned items are checked and put back on the shelf or set aside. Damage claims come with photos, a full record and a written outcome.",
      bullets: [
        "Returns checked before restocking",
        "Photo documentation",
        "Written outcome on every claim",
      ],
    },
    {
      slug: "reports",
      icon: "TrendingUp",
      image: "/images/marketing/merchant-laptop.jpg",
      title: "Reports and settlement",
      body: "Sales, stock and payment reports are always on your dashboard. Export them whenever you want. Your data is yours.",
      bullets: [
        "Monthly sales and stock reports",
        "Every charge visible in your wallet",
        "Export any time",
      ],
    },
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
  fitList: [
    "You sell online, on social media or through WhatsApp",
    "You ship to Abuja and deal with delivery complaints",
    "You want same day or next day delivery in the FCT",
    "You need a local Abuja presence without a store",
    "Your time is better spent on sales than packing",
    "You want to test Abuja demand with low risk",
  ],
} as const;

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

export const steps = {
  label: "How it works",
  title: "From sign up to delivered, in a few simple steps.",
  description:
    "No logistics experience needed. Most merchants are live within five to seven days of approval.",
  items: [
    {
      icon: "ClipboardList",
      title: "Create your account",
      body: "Sign up in a few minutes and tell us about your business. Our team reviews and approves most merchants within 48 hours.",
    },
    {
      icon: "Truck",
      title: "Send us your stock",
      body: "Ship or drop off your products at our Jabi hub. Tell us what's coming on your dashboard so we can check it in.",
    },
    {
      icon: "Boxes",
      title: "We receive and label it",
      body: "Every unit is counted, labelled with its own barcode and put on a shelf. Your stock appears on your dashboard.",
    },
    {
      icon: "ShoppingBag",
      title: "Orders come in",
      body: "Create orders from your dashboard, or let customers buy from your online store link. Stock is reserved the moment an order is placed.",
    },
    {
      icon: "PackageCheck",
      title: "We pick, pack and deliver",
      body: "Our team picks the right items, packs them and sends them out the same day or the next. Your customer confirms delivery.",
    },
    {
      icon: "FileBarChart",
      title: "You track and grow",
      body: "Watch every order, every unit and every naira from your dashboard, and spend your time on selling.",
    },
  ],
  needs: [
    "Your business name and contact details",
    "A list of the products you want to store",
    "Your stock, delivered to our Jabi hub",
    "Your registration fee, refunded if you're not happy after the first month",
  ],
} as const;

// ---------------------------------------------------------------------------
// Pricing and quotes
// ---------------------------------------------------------------------------

export const pricing = {
  label: "Pricing",
  title: "Two plans. Pick the one that fits.",
  description:
    "Start on Standard and move up when you grow. No long term lock in, and if you don't sell, your fulfillment fee is zero.",
  registration: {
    amount: "₦50,000",
    label: "registration fee, per year",
    detail: "Covers your account setup, inventory onboarding, dashboard, online store and training. On both plans.",
  },
  plans: [
    {
      id: "standard",
      name: "Standard",
      tagline: "For growing Nigerian brands",
      audience: "SME sellers with under 5,000 products, selling in Nigeria.",
      fee: "7%",
      feeUnit: "of monthly sales, all-inclusive",
      features: [
        "Storage at ₦10,000 per m² per month",
        "No separate insurance charge",
        "One monthly invoice, with 3 days to pay",
        "Self-serve dashboard and email support",
        "BNP riders, your own riders or customer pickup",
        "Your own online store",
      ],
      cta: { label: "Get started on Standard", href: "/signup?plan=standard" },
      highlighted: false,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      tagline: "For high-volume and international brands",
      audience: "Brands with 5,000+ products or selling outside Nigeria.",
      fee: "9%",
      feeUnit: "of monthly sales",
      features: [
        "Storage at ₦10,000 per m², negotiable at volume",
        "Goods insured at 0.25% of month-end stock value",
        "Pre-funded wallet, charges deducted automatically",
        "A dedicated account manager",
        "BNP riders, your own riders or customer pickup",
        "Add-on services, tailored to your brand",
      ],
      cta: { label: "Get started on Enterprise", href: "/signup?plan=enterprise" },
      highlighted: true,
    },
  ],
  example:
    "On Standard, if your brand sells ₦500,000 in a month, the fulfillment fee is ₦35,000. No rent, no salaries, no overhead.",
  note: "Standard merchants pay one invoice at the end of each month. Enterprise merchants keep a funded wallet and every charge is deducted and listed on the dashboard. Delivery fees are charged per order and shown at checkout.",
} as const;

/** Side-by-side comparison on the pricing page (Technical Specification v2, section 2.1). */
export const planComparison = [
  { feature: "Best for", standard: "SME sellers, under 5,000 products, selling in Nigeria", enterprise: "High-volume and international brands, 5,000+ products" },
  { feature: "Fulfillment fee", standard: "7% of monthly sales, all-inclusive", enterprise: "9% of monthly sales" },
  { feature: "Storage", standard: "₦10,000 per m² per month", enterprise: "₦10,000 per m² per month, negotiable at volume" },
  { feature: "Insurance", standard: "No separate charge", enterprise: "0.25% of month-end stock value" },
  { feature: "How you pay", standard: "One invoice at the end of each month", enterprise: "Pre-funded wallet, charges deducted automatically" },
  { feature: "Time to pay", standard: "3 days after the invoice", enterprise: "Keep your wallet above an agreed minimum" },
  { feature: "Support", standard: "Self-serve dashboard and email support", enterprise: "A dedicated account manager" },
  { feature: "Delivery options", standard: "BNP riders, your own riders or customer pickup", enterprise: "BNP riders, your own riders or customer pickup" },
  { feature: "Add-on services", standard: "Core services included", enterprise: "Tailored add-ons for your brand" },
  { feature: "Registration fee", standard: "₦50,000 a year, refundable after month one", enterprise: "₦50,000 a year, refundable after month one" },
] as const;

/** The money-back promise on the registration fee, shown across the site. */
export const guarantee = {
  title: "Try us for a month, risk-free.",
  body: "If after your first month you feel a fulfillment partner isn't right for you, or you didn't get value for your money, we'll refund your ₦50,000 registration fee in full. Just tell us.",
  short: "Full refund of your ₦50,000 registration fee if you're not happy after your first month.",
  badge: "First-month money-back guarantee",
} as const;

/** Numbers the quote calculator uses. Keep in line with `pricing` above. */
export const quote = {
  subscriptionPerYear: 50_000,
  storagePerSqmPerMonth: 10_000,
  fulfillmentRate: 0.07,
  enterpriseFulfillmentRate: 0.09,
  /** Enterprise insurance: share of month-end stock value, charged monthly. */
  enterpriseInsuranceRate: 0.0025,
  maxStockValue: 5_000_000_000,
  // A medium carton is about 60 x 40 x 40 cm. Stacked two high on a shelf,
  // roughly eight of them fit on one square metre of floor space.
  cartonsPerSqm: 8,
  minSqm: 1,
  maxSqm: 100,
  maxCartons: 800,
  maxMonthlySales: 50_000_000,
} as const;

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

export const about = {
  intro: {
    label: "Who we are",
    title: "The operations partner behind growing Nigerian brands.",
    body: [
      "BNP Fulfillment, part of BoxNPick Global, exists for one reason: to let merchants grow without building a warehouse, hiring a packing team or opening a branch in every city.",
      "We run the physical side of your business from our hub in Jabi, Abuja, with Lagos and our Texas facility on the same account. You sell. We store, pack, deliver and keep the records.",
    ],
  },
  values: [
    {
      icon: "ShieldCheck",
      title: "Care",
      body: "We treat your stock as if it were ours. Every unit is counted, labelled, insured and accounted for.",
    },
    {
      icon: "Zap",
      title: "Speed",
      body: "Orders in before noon go out the same day. Fast delivery is how your brand earns repeat customers.",
    },
    {
      icon: "MonitorSmartphone",
      title: "Openness",
      body: "Every unit, order and charge is on your dashboard. No guessing, no waiting for us to send a report.",
    },
  ],
  mission:
    "To give every Nigerian brand the operations of a big company, without the cost of building one.",
  vision:
    "A Nigeria where a brand in any city can sell to customers in every city, quickly and reliably.",
} as const;

export const hub = {
  label: "Our locations",
  title: "One account. Three locations.",
  description:
    "Start in Abuja and add Lagos or the USA when you're ready, all from the same dashboard. No new application, no new contract.",
  locations: [
    {
      city: "Abuja",
      area: "Jabi, FCT",
      status: "Primary hub",
      image: "/images/marketing/warehouse-aisle.jpg",
      points: [
        "Secure, organised warehouse",
        "BNP riders on the ground daily",
        "Walk in collection for customers",
        "Same day dispatch cutoff at noon",
      ],
    },
    {
      city: "Lagos",
      area: "Lagos State",
      status: "Expanding",
      image: "/images/marketing/delivery-van.jpg",
      points: [
        "Reach Lagos customers faster",
        "Same dashboard, same account",
        "Assign stock per location",
      ],
    },
    {
      city: "USA",
      area: "Texas",
      status: "Operational",
      image: "/images/marketing/warehouse-staff.jpg",
      points: [
        "Serve diaspora customers",
        "Ideal for African export goods",
        "Managed from the same dashboard",
      ],
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const faq = {
  label: "FAQ",
  title: "Questions merchants ask us.",
  groups: [
    {
      title: "Getting started",
      items: [
        {
          q: "How do I get started with BNP?",
          a: "Create a merchant account, tell us about your business and our team will review it, usually within 48 hours. Once approved, you send us your stock and you're ready to take orders. Most merchants are live within five to seven days.",
        },
        {
          q: "How do I get my products into your warehouse?",
          a: "Ship your stock to our Jabi hub or drop it off in person. Let us know what's coming on your dashboard. We count every unit, label it and shelve it, and it appears on your dashboard once it's checked in.",
        },
        {
          q: "What kinds of products can I store with you?",
          a: "Fashion, beauty, hair, gadgets, homeware, non perishable foods, supplements, gifts and more. If you sell something unusual, such as very large, fragile or temperature sensitive items, talk to us first and we'll confirm whether we can handle it.",
        },
        {
          q: "Do I need to sign a long contract?",
          a: "No. The subscription is yearly, storage is monthly and the fulfillment fee only applies when you sell. There is no long term lock in.",
        },
      ],
    },
    {
      title: "Pricing and payments",
      items: [
        {
          q: "Which plan is right for me, Standard or Enterprise?",
          a: "Standard suits most growing Nigerian brands: under 5,000 products, selling within Nigeria, paying one invoice a month. Enterprise is for high-volume and international brands that want a dedicated account manager, insured stock and a pre-funded wallet. You can start on Standard and move up later.",
        },
        {
          q: "Can I get my registration fee back?",
          a: "Yes. If after your first month you feel a fulfillment partner isn't right for you, or you didn't get value for your money, tell us and we'll refund your ₦50,000 registration fee in full.",
        },
        {
          q: "How does the fulfillment fee work?",
          a: "It's a share of the total value of goods you sell in a month: 7% on Standard and 9% on Enterprise. On Standard, if you sell ₦200,000 worth of goods, the fee is ₦14,000. If you sell nothing, the fulfillment fee is zero and only storage applies.",
        },
        {
          q: "How is storage measured?",
          a: "By the floor space your stock takes up on our shelves, in square metres. As a rough guide, about eight medium cartons fit in one square metre. Our quote calculator can estimate it for you.",
        },
        {
          q: "How accurate is the online quote?",
          a: "It uses our standard prices, so it's a close estimate. Your final storage cost depends on the actual space your stock uses once it's on our shelves. Delivery fees are separate and charged per order.",
        },
        {
          q: "How do I pay the fees?",
          a: "On Standard, you get one invoice at the start of each month for the month before, and have 3 days to pay it online. On Enterprise, you keep a funded wallet and charges are deducted automatically. Either way, every charge is listed on your dashboard.",
        },
      ],
    },
    {
      title: "Orders and delivery",
      items: [
        {
          q: "How fast do orders go out?",
          a: "Orders received before noon are dispatched the same day to customers in the FCT. Later orders go out the next day.",
        },
        {
          q: "Can I use my own delivery riders?",
          a: "Yes. Add your own riders to your account, set their delivery fees and assign orders to them. You can switch between BNP riders and your own at any time.",
        },
        {
          q: "Can my customers order online?",
          a: "Yes. Every merchant gets an online store link to share anywhere. Customers order and pay online, can track their order, and the order comes straight to our warehouse to be packed.",
        },
        {
          q: "Can customers collect orders in person?",
          a: "Yes. Our Jabi hub works as a collection point. Customers choose pickup, come in with their order number and collect it.",
        },
      ],
    },
    {
      title: "Your stock",
      items: [
        {
          q: "What happens if a product is damaged in your care?",
          a: "All stock in our facility is insured. Report it from your dashboard with photos and a description, and we resolve every claim with full documentation and a written outcome.",
        },
        {
          q: "How do I know how much stock I have?",
          a: "Your dashboard shows, for every product, how many units are on our shelves, how many are reserved for open orders and how many are still available to sell. You also get alerts when stock runs low.",
        },
        {
          q: "Can I store stock in Lagos or the USA?",
          a: "Yes. Assign stock to Lagos or our Texas facility from the same dashboard. No new application and no new contract.",
        },
      ],
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Contact and footer
// ---------------------------------------------------------------------------

export const contact = {
  label: "Contact us",
  title: "Talk to a real person on our team.",
  description:
    "Questions about storage, pricing or whether BNP is right for your brand? Send us a message and we'll get back to you within 48 hours.",
  mapQuery: "Alba Plaza, Jabi, Abuja, Nigeria",
} as const;

export const ctaBand = {
  title: "Ready to stop packing orders yourself?",
  body: "See what BNP would cost for your brand in under a minute, or create your account and start sending stock this week. Not happy after your first month? We refund your registration fee.",
} as const;

export const footer = {
  description:
    "BNP Fulfillment stores, packs and delivers for Nigerian brands from our hub in Jabi, Abuja, with Lagos and the USA on the same account.",
  columns: [
    {
      title: "Company",
      links: [
        { label: "About us", href: "/about" },
        { label: "How it works", href: "/how-it-works" },
        { label: "Pricing", href: "/pricing" },
        { label: "FAQ", href: "/faq" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Services",
      links: [
        { label: "Warehousing", href: "/services#warehousing" },
        { label: "Pick and pack", href: "/services#pick-and-pack" },
        { label: "Last mile delivery", href: "/services#delivery" },
        { label: "Online store", href: "/services#storefront" },
        { label: "Returns and claims", href: "/services#returns" },
      ],
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Merchant enquiry form (contact page and quote page). `categories` is also
// used by sign up and dashboard settings.
// ---------------------------------------------------------------------------

export const apply = {
  form: {
    title: "Tell us about your business",
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
    disclaimer: "No payment required. We confirm fit before any fees are discussed.",
    success: "Message received. Our team will be in touch within 48 hours.",
  },
} as const;
