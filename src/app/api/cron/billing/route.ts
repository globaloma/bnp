import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendQueuedBillingNotices } from "@/lib/billing-email";
import { reportError } from "@/lib/report-error";

// Daily billing job (vercel.json crons). On the 1st it bills the month just
// ended; every day it pauses Standard accounts with overdue invoices; then it
// sends any queued billing emails. Safe to run more than once a day.
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>" when the
// CRON_SECRET environment variable is set; without it the job refuses to run.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_daily");
  if (error) {
    reportError(new Error(`billing_daily failed: ${error.message}`));
    return NextResponse.json({ error: "Billing run failed" }, { status: 500 });
  }
  const emailed = await sendQueuedBillingNotices();
  return NextResponse.json({ ok: true, result: data, emailed });
}
