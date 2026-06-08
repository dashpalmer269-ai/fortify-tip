import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/schemas/api";
import { AwsConnectSchema } from "@/lib/schemas/integrations";
import { validateConnection } from "@/lib/integrations/aws";
import { writeCredentials } from "@/lib/security/credentials";
import { isAdmin } from "@/lib/auth/permissions";
import { requirePracticeAccess } from "@/lib/billing/require-access";

/**
 * Connect AWS via IAM access key + secret + default region.
 *
 * Validates the credentials with STS GetCallerIdentity before persisting,
 * then encrypts via writeCredentials (sole storage path — migration 028
 * dropped the legacy column and added a CHECK enforcing the invariant).
 *
 * Recommended IAM policy for the access key — read-only, scoped:
 *   cloudtrail:DescribeTrails, cloudtrail:GetTrailStatus
 *   iam:GetAccountSummary, iam:ListUsers, iam:ListMFADevices
 *   s3:ListAllMyBuckets, s3:GetBucketEncryption,
 *   s3:GetBucketPublicAccessBlock, s3:GetBucketAcl,
 *   s3:GetBucketPolicyStatus
 *   sts:GetCallerIdentity
 */
export async function POST(req: NextRequest) {
  const authed = await createAuthedServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseBody(AwsConnectSchema, req);
  if (!parsed.ok) return parsed.response;
  const { access_key_id, secret_access_key, region } = parsed.data;

  const { data: membership } = await db
    .from("practice_users")
    .select("practice_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No practice membership" }, { status: 400 });
  if (!isAdmin(membership.role)) {
    return NextResponse.json({ error: "Only admins can connect integrations" }, { status: 403 });
  }

  const guard = await requirePracticeAccess(db, membership.practice_id);
  if (!guard.ok) return guard.response;

  // 1. Validate against AWS before persisting
  const check = await validateConnection({ access_key_id, secret_access_key, region });
  if (!check.ok) {
    return NextResponse.json({ error: `AWS connection failed: ${check.error}` }, { status: 400 });
  }

  // 2. Upsert as disconnected (CHECK constraint prevents 'connected' without
  //    encrypted blob — we'll flip to connected after writeCredentials).
  const { data: integ, error: upErr } = await db
    .from("integrations")
    .upsert(
      {
        practice_id: membership.practice_id,
        integration_type: "aws",
        status: "disconnected" as const,
        display_name: "AWS",
        external_account_id: check.account_id,
        scopes: [
          "cloudtrail:Describe",
          "iam:GetAccountSummary",
          "iam:ListUsers",
          "iam:ListMFADevices",
          "s3:ListAllMyBuckets",
          "s3:GetBucketEncryption",
          "s3:GetBucketPublicAccessBlock",
          "s3:GetBucketAcl",
          "s3:GetBucketPolicyStatus",
          "sts:GetCallerIdentity",
        ],
        last_synced_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "practice_id,integration_type" }
    )
    .select("id")
    .single();
  if (upErr || !integ) {
    return NextResponse.json({ error: upErr?.message ?? "upsert failed" }, { status: 500 });
  }

  // 3. Encrypt the credentials — sole write path
  const { error: credErr } = await writeCredentials(db, integ.id, {
    access_key_id,
    secret_access_key,
    region,
  });
  if (credErr) {
    return NextResponse.json({ error: `credential_encrypt_failed: ${credErr}` }, { status: 500 });
  }

  // 4. Flip to connected (CHECK constraint now passes)
  await db
    .from("integrations")
    .update({ status: "connected", last_error: null })
    .eq("id", integ.id);

  await db.from("audit_logs").insert({
    practice_id: membership.practice_id,
    actor_user_id: user.id,
    action: "integration.connected",
    resource_type: "integration",
    resource_id: integ.id,
    metadata: { type: "aws", account_id: check.account_id, region },
  });

  return NextResponse.json({
    ok: true,
    integration_id: integ.id,
    account_id: check.account_id,
  });
}
