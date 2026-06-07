/**
 * Signup route entry.
 *
 * Server component wrapping the client-side SignupForm in a Suspense
 * boundary. SignupForm consumes useSearchParams() to read the ?invite=...
 * param; Next 16 requires that consumer to live inside a Suspense
 * boundary so the rest of the page can still prerender statically.
 */
import { Suspense } from "react";
import SignupForm from "./SignupForm";
import { Card, CardBody } from "@/components/ui/Card";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupSkeleton() {
  return (
    <Card>
      <CardBody className="py-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-2">
          Get started
        </p>
        <h1 className="font-display text-3xl text-[var(--color-primary)] mb-2">
          Create your account
        </h1>
        <p className="text-[13px] text-[var(--color-tertiary)]">Loading…</p>
      </CardBody>
    </Card>
  );
}
