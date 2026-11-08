#!/usr/bin/env node
// Create (or top up) a ready-to-use Enterprise demo merchant account.
//
// Runs the whole Enterprise onboarding in one shot, using the service-role
// admin client so it bypasses RLS and needs no signed-in session:
//   1. Create a confirmed auth user (no email verification step), carrying
//      the role=merchant / plan_type=enterprise metadata the handle_new_user
//      trigger reads to spin up the partners row.
//   2. Activate the partner (status -> active) and set the Enterprise terms
//      (wallet minimum / buffer + account manager).
//   3. Fund the wallet (wallet_credit, which is granted to service_role) so
//      the account can actually place and bill test orders.
//   4. Print the credentials to hand to the client.
//
// It is safe to re-run: an existing user is reused, the terms are re-applied
// (idempotent), and the wallet is only funded on first creation so re-runs
// never double-credit.
//
// Usage:
//   node scripts/create-demo-enterprise.mjs
//   DEMO_EMAIL=client-demo@bnpfulfillment.com DEMO_FUND=1000000 \
//     node scripts/create-demo-enterprise.mjs
//
// Requires in the environment (or in a local .env.local / .env file):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   <- the secret service role key, NOT the anon key
//
// Optional overrides (all have sensible defaults):
//   DEMO_EMAIL      login email            (default demo.enterprise@bnpfulfillment.com)
//   DEMO_PASSWORD   login password         (default: a strong one is generated & printed)
//   DEMO_BUSINESS   business name          (default "Demo Enterprise Co.")
//   DEMO_CONTACT    contact person         (default "Demo Enterprise")
//   DEMO_PHONE      phone                  (default "+2348000000000")
//   DEMO_CATEGORY   merchant category      (default "General merchandise")
//   DEMO_MIN        wallet minimum (NGN)   (default 50000)
//   DEMO_FUND       opening balance (NGN)  (default 500000)
//   DEMO_MANAGER    account manager name   (default "BNP Team")

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- tiny .env loader (no dependency); real env always wins ------------------
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* file not present — fine */
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\nMissing config. Set these before running:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=...   (the secret service role key)\n\n" +
      "Either export them, put them in .env.local, or prefix the command:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-demo-enterprise.mjs\n",
  );
  process.exit(1);
}

// --- config ------------------------------------------------------------------
const generatedPassword = `Demo-${randomChunk()}-${randomChunk()}`;
const cfg = {
  email: (process.env.DEMO_EMAIL || "demo.enterprise@bnpfulfillment.com").toLowerCase().trim(),
  password: process.env.DEMO_PASSWORD || generatedPassword,
  business: process.env.DEMO_BUSINESS || "Demo Enterprise Co.",
  contact: process.env.DEMO_CONTACT || "Demo Enterprise",
  phone: process.env.DEMO_PHONE || "+2348000000000",
  category: process.env.DEMO_CATEGORY || "General merchandise",
  minimum: num(process.env.DEMO_MIN, 50000),
  fund: num(process.env.DEMO_FUND, 500000),
  manager: process.env.DEMO_MANAGER || "BNP Team",
};
const passwordWasGenerated = !process.env.DEMO_PASSWORD;

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const naira = (n) =>
  "₦" + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  // 1. Create the confirmed auth user (or find it if it already exists).
  let userId;
  let created = false;

  const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
    email: cfg.email,
    password: cfg.password,
    email_confirm: true, // skip the verification email — ready to log in
    user_metadata: {
      role: "merchant",
      plan_type: "enterprise",
      business_name: cfg.business,
      contact_name: cfg.contact,
      phone: cfg.phone,
      category: cfg.category,
    },
  });

  if (createErr) {
    const already = /already|exists|registered/i.test(createErr.message || "");
    if (!already) throw createErr;
    userId = await findUserIdByEmail(cfg.email);
    if (!userId) throw new Error(`User ${cfg.email} seems to exist but could not be found.`);
    console.log(`• User already exists — reusing ${cfg.email}`);
  } else {
    userId = createData.user.id;
    created = true;
    console.log(`• Created auth user ${cfg.email}`);
  }

  // 2. The handle_new_user trigger creates the partners row on insert.
  //    Give it a moment on a fresh user, then confirm it exists.
  const partner = await waitForPartner(userId);
  if (!partner) {
    throw new Error(
      "Partner row was not created by the handle_new_user trigger. " +
        "Check that migrations are applied on this database.",
    );
  }

  // 3. Activate + set Enterprise terms. Service role bypasses RLS, so we
  //    update the row directly (the admin_* RPCs need an is_admin() session,
  //    which the service role key does not have).
  const { error: updErr } = await supabase
    .from("partners")
    .update({
      status: "active",
      role: "merchant",
      plan_type: "enterprise",
      wallet_buffer: cfg.minimum, // Enterprise "minimum balance"
      account_manager: cfg.manager,
      category: cfg.category,
    })
    .eq("id", userId);
  if (updErr) throw updErr;
  console.log(`• Activated + set Enterprise terms (minimum ${naira(cfg.minimum)}, manager "${cfg.manager}")`);

  // 4. Fund the wallet — only on first creation, so re-runs never double-fund.
  let balance = Number(partner.wallet_balance) || 0;
  if (created && cfg.fund > 0) {
    const { error: fundErr } = await supabase.rpc("wallet_credit", {
      p_partner_id: userId,
      p_amount: cfg.fund,
      p_type: "Top-up",
      p_note: "Demo account opening balance",
    });
    if (fundErr) throw fundErr;
    balance += cfg.fund;
    console.log(`• Funded wallet with ${naira(cfg.fund)}`);
  } else if (!created) {
    const { data: fresh } = await supabase
      .from("partners")
      .select("wallet_balance")
      .eq("id", userId)
      .single();
    balance = Number(fresh?.wallet_balance) || balance;
    console.log("• Existing account — wallet left untouched (re-run safe)");
  }

  // 5. Credentials to hand over.
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://bnpfulfillment.com").replace(/\/$/, "");
  const line = "=".repeat(58);
  console.log(`\n${line}\n  ENTERPRISE DEMO ACCOUNT READY\n${line}`);
  console.log(`  Login URL       ${site}/login`);
  console.log(`  Email           ${cfg.email}`);
  if (created || passwordWasGenerated) {
    console.log(`  Password        ${cfg.password}`);
  } else {
    console.log(`  Password        (set earlier — use the one you chose, or reset it)`);
  }
  console.log(`  Business        ${cfg.business}`);
  console.log(`  Plan            Enterprise`);
  console.log(`  Wallet balance  ${naira(balance)}`);
  console.log(`  Wallet minimum  ${naira(cfg.minimum)}`);
  console.log(`  Account manager ${cfg.manager}`);
  console.log(line);
  if (created) {
    console.log("  Status: new account, active, email pre-confirmed.");
  } else {
    console.log("  Status: existing account re-applied (active, Enterprise).");
  }
  console.log("");
}

// --- helpers -----------------------------------------------------------------
function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

function randomChunk() {
  // Readable-ish: no ambiguous chars, mixed case + digits.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function waitForPartner(userId) {
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from("partners")
      .select("id, wallet_balance, status, plan_type")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

async function findUserIdByEmail(email) {
  // listUsers is paginated; walk a few pages looking for the address.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

main().catch((err) => {
  console.error("\nFailed:", err?.message || err);
  process.exit(1);
});
