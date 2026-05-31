"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Inline AWS connect form. POSTs to /api/integrations/aws/connect which
 * validates the credentials via STS GetCallerIdentity, seals them with the
 * KMS helper, and flips status='connected'. Refreshes the integrations
 * page on success so the credential-health card re-renders.
 */
export default function AwsConnectForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [secret, setSecret] = useState("");
  const [region, setRegion] = useState("us-east-1");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/integrations/aws/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_key_id: accessKey.trim(),
          secret_access_key: secret.trim(),
          region: region.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Connection failed (${res.status})`);
      // Clear sensitive state immediately
      setSecret("");
      setAccessKey("");
      setOpen(false);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Connect
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 w-full space-y-3 border-t border-[var(--color-border-subtle)] pt-4">
      <p className="text-[11px] text-[var(--color-quaternary)] leading-relaxed">
        Create a read-only IAM user in AWS Console → IAM → Users → Add user. Attach an inline policy with these
        actions only: <code className="font-mono">cloudtrail:DescribeTrails, cloudtrail:GetTrailStatus,
        iam:GetAccountSummary, iam:ListUsers, iam:ListMFADevices, s3:ListAllMyBuckets, s3:GetBucketEncryption,
        s3:GetBucketPublicAccessBlock, s3:GetBucketAcl, s3:GetBucketPolicyStatus, sts:GetCallerIdentity</code>.
        Then create an access key.
      </p>

      <div className="grid grid-cols-1 gap-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-1">
            Access Key ID
          </span>
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="AKIA…"
            autoComplete="off"
            required
            pattern="AKIA[0-9A-Z]{16}"
            className="w-full bg-transparent border border-[var(--color-border-default)] rounded-md px-3 py-2 text-sm text-[var(--color-primary)] font-mono focus:outline-none focus:border-[var(--color-border-strong)]"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-1">
            Secret Access Key
          </span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            required
            minLength={40}
            className="w-full bg-transparent border border-[var(--color-border-default)] rounded-md px-3 py-2 text-sm text-[var(--color-primary)] font-mono focus:outline-none focus:border-[var(--color-border-strong)]"
          />
          <span className="block text-[10px] text-[var(--color-quaternary)] mt-1">
            Encrypted at rest via KMS-backed helper before storage. Never logged.
          </span>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)] mb-1">
            Default Region
          </span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full bg-transparent border border-[var(--color-border-default)] rounded-md px-3 py-2 text-sm text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-border-strong)]"
          >
            <option className="bg-black" value="us-east-1">us-east-1</option>
            <option className="bg-black" value="us-east-2">us-east-2</option>
            <option className="bg-black" value="us-west-1">us-west-1</option>
            <option className="bg-black" value="us-west-2">us-west-2</option>
            <option className="bg-black" value="ca-central-1">ca-central-1</option>
            <option className="bg-black" value="eu-west-1">eu-west-1</option>
            <option className="bg-black" value="eu-west-2">eu-west-2</option>
            <option className="bg-black" value="eu-central-1">eu-central-1</option>
          </select>
        </label>
      </div>

      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={submitting}>
          Validate &amp; connect
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={() => {
            setOpen(false);
            setError(null);
            setSecret("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
