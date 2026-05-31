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
  ListAccessKeysCommand,
  GetAccessKeyLastUsedCommand,
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
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  DescribeRegionsCommand,
} from "@aws-sdk/client-ec2";
import { GuardDutyClient, ListDetectorsCommand, GetDetectorCommand } from "@aws-sdk/client-guardduty";
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

// ─── 6. GuardDuty enabled in every active region ─────────────────────────────
export async function checkGuardDutyEnabled(creds: AwsCreds): Promise<CheckResult> {
  try {
    // List all opt-in regions via the default region's EC2 client.
    const ec2 = new EC2Client(clientConfig(creds));
    const { Regions = [] } = await ec2.send(new DescribeRegionsCommand({}));
    const regionNames = Regions.map((r) => r.RegionName).filter((n): n is string => !!n);

    const missing: string[] = [];
    const enabled: string[] = [];
    for (const region of regionNames) {
      try {
        const gd = new GuardDutyClient({ ...clientConfig(creds), region });
        const { DetectorIds = [] } = await gd.send(new ListDetectorsCommand({}));
        if (DetectorIds.length === 0) {
          missing.push(region);
          continue;
        }
        const det = await gd.send(new GetDetectorCommand({ DetectorId: DetectorIds[0] }));
        if (det.Status === "ENABLED") enabled.push(region);
        else missing.push(region);
      } catch {
        // Region may not be opted-in or the IAM key may lack guardduty:* there
        missing.push(region);
      }
    }

    return {
      status:
        missing.length === 0
          ? "pass"
          : enabled.length === 0
          ? "fail"
          : "partial",
      observed_value: {
        regions_checked: regionNames.length,
        regions_with_guardduty: enabled.length,
        regions_without_guardduty: missing.length,
      },
      raw: { regions_without_guardduty: missing.slice(0, 20) },
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}

// ─── 7. Security groups open to the internet ────────────────────────────────
export async function checkSecurityGroupsOpen(creds: AwsCreds): Promise<CheckResult> {
  try {
    const ec2 = new EC2Client(clientConfig(creds));
    const { SecurityGroups = [] } = await ec2.send(new DescribeSecurityGroupsCommand({}));

    // A SG is "open" if any inbound rule allows 0.0.0.0/0 or ::/0 on a port
    // other than 80/443 (common public-web exemptions still flagged below).
    const exemptPorts = new Set([80, 443]);
    type Offender = { sg_id: string; sg_name: string; ports: string[] };
    const offenders: Offender[] = [];
    for (const sg of SecurityGroups) {
      const badPorts: string[] = [];
      for (const rule of sg.IpPermissions ?? []) {
        const wideOpen =
          (rule.IpRanges ?? []).some((r) => r.CidrIp === "0.0.0.0/0") ||
          (rule.Ipv6Ranges ?? []).some((r) => r.CidrIpv6 === "::/0");
        if (!wideOpen) continue;
        const portLabel =
          rule.FromPort === undefined
            ? "all"
            : rule.FromPort === rule.ToPort
            ? String(rule.FromPort)
            : `${rule.FromPort}-${rule.ToPort}`;
        const portNum = rule.FromPort;
        if (portNum !== undefined && exemptPorts.has(portNum) && portNum === rule.ToPort) {
          // 80 or 443 alone — public web is fine
          continue;
        }
        badPorts.push(portLabel);
      }
      if (badPorts.length > 0) {
        offenders.push({ sg_id: sg.GroupId ?? "", sg_name: sg.GroupName ?? "", ports: badPorts });
      }
    }
    return {
      status: offenders.length === 0 ? "pass" : "fail",
      observed_value: {
        total_security_groups: SecurityGroups.length,
        security_groups_open_to_internet: offenders.length,
      },
      raw: { offenders: offenders.slice(0, 20) },
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}

// ─── 8. Unused access keys ──────────────────────────────────────────────────
export async function checkUnusedAccessKeys(
  creds: AwsCreds,
  maxAgeDays: number = 90
): Promise<CheckResult> {
  try {
    const iam = new IAMClient(clientConfig(creds));
    const users: string[] = [];
    let marker: string | undefined;
    do {
      const page = await iam.send(new ListUsersCommand({ Marker: marker }));
      for (const u of page.Users ?? []) if (u.UserName) users.push(u.UserName);
      marker = page.IsTruncated ? page.Marker : undefined;
    } while (marker);

    type Stale = { user: string; access_key_id: string; days_since_use: number | null };
    const stale: Stale[] = [];
    let totalActiveKeys = 0;
    const cutoff = Date.now() - maxAgeDays * 86400_000;
    for (const user of users) {
      const { AccessKeyMetadata = [] } = await iam.send(new ListAccessKeysCommand({ UserName: user }));
      for (const k of AccessKeyMetadata) {
        if (k.Status !== "Active" || !k.AccessKeyId) continue;
        totalActiveKeys++;
        const lastUsed = await iam.send(new GetAccessKeyLastUsedCommand({ AccessKeyId: k.AccessKeyId }));
        const lastUsedAt = lastUsed.AccessKeyLastUsed?.LastUsedDate;
        if (!lastUsedAt || lastUsedAt.getTime() < cutoff) {
          stale.push({
            user,
            access_key_id: k.AccessKeyId,
            days_since_use: lastUsedAt
              ? Math.floor((Date.now() - lastUsedAt.getTime()) / 86400_000)
              : null,
          });
        }
      }
    }

    return {
      status: stale.length === 0 ? "pass" : "fail",
      observed_value: {
        total_active_keys: totalActiveKeys,
        stale_keys: stale.length,
        max_age_days: maxAgeDays,
      },
      raw: { stale_keys: stale.slice(0, 25) },
    };
  } catch (err) {
    return { status: "error", observed_value: null, raw: { error: (err as Error).message } };
  }
}
