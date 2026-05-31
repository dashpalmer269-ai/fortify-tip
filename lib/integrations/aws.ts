/**
 * AWS integration client + evidence collectors.
 *
 * Five checks shipped on day one — covering the highest-yield AWS
 * cybersecurity signals for a healthcare practice running EHR / billing
 * /analytics on AWS:
 *
 *   aws_cloudtrail_multi_region       audit log coverage
 *   aws_iam_root_mfa                  root account MFA
 *   aws_iam_user_mfa_enforced         every IAM user has an MFA device
 *   aws_s3_no_public_buckets          no buckets readable by the world
 *   aws_s3_default_encryption         every bucket has SSE enabled
 *
 * Credentials shape: { access_key_id, secret_access_key, region }. Encrypted
 * at rest via writeCredentials() — never stored in plaintext. Region is the
 * default for client constructors; IAM + S3 are global services but the SDK
 * requires a region for the signer.
 *
 * NO PHI: this module reads infrastructure metadata only — bucket names,
 * IAM user names, trail configurations. Never reads object contents.
 */

import { CloudTrailClient, DescribeTrailsCommand, GetTrailStatusCommand } from "@aws-sdk/client-cloudtrail";
import {
  IAMClient,
  GetAccountSummaryCommand,
  ListUsersCommand,
  ListMFADevicesCommand,
} from "@aws-sdk/client-iam";
import {
  S3Client,
  ListBucketsCommand,
  GetBucketEncryptionCommand,
  GetPublicAccessBlockCommand,
  GetBucketAclCommand,
  GetBucketPolicyStatusCommand,
} from "@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import type { CheckResult } from "@/lib/compliance/runner";

export interface AwsCreds {
  access_key_id: string;
  secret_access_key: string;
  region: string;
}

function clientConfig(creds: AwsCreds) {
  return {
    region: creds.region,
    credentials: {
      accessKeyId: creds.access_key_id,
      secretAccessKey: creds.secret_access_key,
    },
  };
}

/**
 * Validate credentials at connect-time. Returns the account_id on success,
 * a descriptive error on failure. Cheapest possible call (STS GetCallerIdentity).
 */
export async function validateConnection(
  creds: AwsCreds
): Promise<{ ok: true; account_id: string; arn: string } | { ok: false; error: string }> {
  try {
    const sts = new STSClient(clientConfig(creds));
    const id = await sts.send(new GetCallerIdentityCommand({}));
    if (!id.Account) return { ok: false, error: "STS returned no account id" };
    return { ok: true, account_id: id.Account, arn: id.Arn ?? "" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── 1. CloudTrail multi-region ──────────────────────────────────────────────
export async function checkCloudTrailMultiRegion(creds: AwsCreds): Promise<CheckResult> {
  try {
    const ct = new CloudTrailClient(clientConfig(creds));
    const { trailList = [] } = await ct.send(new DescribeTrailsCommand({}));
    const multiRegion = trailList.filter((t) => t.IsMultiRegionTrail);
    let loggingCount = 0;
    for (const t of multiRegion) {
      if (!t.TrailARN) continue;
      try {
        const status = await ct.send(new GetTrailStatusCommand({ Name: t.TrailARN }));
        if (status.IsLogging) loggingCount++;
      } catch {
        // a trail in another region we don't have permission to query: count as not-logging
      }
    }
    return {
      status: loggingCount > 0 ? "pass" : "fail",
      observed_value: {
        total_trails: trailList.length,
        multi_region_trails: multiRegion.length,
        actively_logging: loggingCount,
      },
      raw: { trail_names: multiRegion.map((t) => t.Name) },
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}

// ─── 2. Root account MFA ─────────────────────────────────────────────────────
export async function checkRootAccountMfa(creds: AwsCreds): Promise<CheckResult> {
  try {
    const iam = new IAMClient(clientConfig(creds));
    const summary = await iam.send(new GetAccountSummaryCommand({}));
    const map = summary.SummaryMap ?? {};
    const rootMfa = Number(map.AccountMFAEnabled ?? 0) === 1;
    return {
      status: rootMfa ? "pass" : "fail",
      observed_value: {
        root_mfa_enabled: rootMfa,
        account_access_keys_present: Number(map.AccountAccessKeysPresent ?? 0) === 1,
      },
      raw: null,
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}

// ─── 3. Every IAM user has MFA ──────────────────────────────────────────────
export async function checkIamUserMfa(creds: AwsCreds): Promise<CheckResult> {
  try {
    const iam = new IAMClient(clientConfig(creds));
    const users: string[] = [];
    let marker: string | undefined;
    do {
      const page = await iam.send(new ListUsersCommand({ Marker: marker }));
      for (const u of page.Users ?? []) if (u.UserName) users.push(u.UserName);
      marker = page.IsTruncated ? page.Marker : undefined;
    } while (marker);

    if (users.length === 0) {
      return {
        status: "pass",
        observed_value: { total_users: 0, with_mfa: 0, without_mfa: 0 },
        raw: { note: "no IAM users (root-only)" },
      };
    }

    const withoutMfa: string[] = [];
    for (const user of users) {
      const { MFADevices = [] } = await iam.send(new ListMFADevicesCommand({ UserName: user }));
      if (MFADevices.length === 0) withoutMfa.push(user);
    }

    return {
      status: withoutMfa.length === 0 ? "pass" : "fail",
      observed_value: {
        total_users: users.length,
        with_mfa: users.length - withoutMfa.length,
        without_mfa: withoutMfa.length,
      },
      raw: { without_mfa_users: withoutMfa },
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}

// ─── 4. No public S3 buckets ─────────────────────────────────────────────────
export async function checkS3NoPublicBuckets(creds: AwsCreds): Promise<CheckResult> {
  try {
    const s3 = new S3Client(clientConfig(creds));
    const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));
    if (Buckets.length === 0) {
      return { status: "pass", observed_value: { total_buckets: 0, public_buckets: 0 }, raw: null };
    }

    const publicBuckets: string[] = [];
    for (const b of Buckets) {
      if (!b.Name) continue;
      // Combination: public-access-block (preferred) + policy-status fallback
      let isPublic = false;
      try {
        const block = await s3.send(new GetPublicAccessBlockCommand({ Bucket: b.Name }));
        const cfg = block.PublicAccessBlockConfiguration;
        const fullyBlocked =
          cfg?.BlockPublicAcls &&
          cfg?.BlockPublicPolicy &&
          cfg?.IgnorePublicAcls &&
          cfg?.RestrictPublicBuckets;
        if (!fullyBlocked) {
          try {
            const status = await s3.send(new GetBucketPolicyStatusCommand({ Bucket: b.Name }));
            if (status.PolicyStatus?.IsPublic) isPublic = true;
          } catch {
            // No bucket policy → fall back to ACL check
            try {
              const acl = await s3.send(new GetBucketAclCommand({ Bucket: b.Name }));
              const allUsers = (acl.Grants ?? []).some(
                (g) => g.Grantee?.URI === "http://acs.amazonaws.com/groups/global/AllUsers"
              );
              if (allUsers) isPublic = true;
            } catch {
              /* read failure on the ACL — be conservative, treat as unknown not public */
            }
          }
        }
      } catch {
        // No PublicAccessBlock configured → check ACL
        try {
          const acl = await s3.send(new GetBucketAclCommand({ Bucket: b.Name }));
          const allUsers = (acl.Grants ?? []).some(
            (g) => g.Grantee?.URI === "http://acs.amazonaws.com/groups/global/AllUsers"
          );
          if (allUsers) isPublic = true;
        } catch {
          /* skip */
        }
      }
      if (isPublic) publicBuckets.push(b.Name);
    }

    return {
      status: publicBuckets.length === 0 ? "pass" : "fail",
      observed_value: {
        total_buckets: Buckets.length,
        public_buckets: publicBuckets.length,
      },
      raw: { public_bucket_names: publicBuckets },
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}

// ─── 5. Default encryption on every S3 bucket ────────────────────────────────
export async function checkS3DefaultEncryption(creds: AwsCreds): Promise<CheckResult> {
  try {
    const s3 = new S3Client(clientConfig(creds));
    const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));
    if (Buckets.length === 0) {
      return {
        status: "pass",
        observed_value: { total_buckets: 0, unencrypted_buckets: 0 },
        raw: null,
      };
    }

    const unencrypted: string[] = [];
    for (const b of Buckets) {
      if (!b.Name) continue;
      try {
        const enc = await s3.send(new GetBucketEncryptionCommand({ Bucket: b.Name }));
        const hasRule = (enc.ServerSideEncryptionConfiguration?.Rules ?? []).length > 0;
        if (!hasRule) unencrypted.push(b.Name);
      } catch (err) {
        // "ServerSideEncryptionConfigurationNotFoundError" → no encryption set
        if ((err as { name?: string }).name === "ServerSideEncryptionConfigurationNotFoundError") {
          unencrypted.push(b.Name);
        }
        // Other errors (access denied to this bucket): leave out, don't lie
      }
    }

    return {
      status: unencrypted.length === 0 ? "pass" : "fail",
      observed_value: {
        total_buckets: Buckets.length,
        unencrypted_buckets: unencrypted.length,
        encrypted_buckets: Buckets.length - unencrypted.length,
      },
      raw: { unencrypted_bucket_names: unencrypted },
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}
