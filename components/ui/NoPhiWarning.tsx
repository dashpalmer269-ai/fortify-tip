/**
 * NO-PHI upload guard. Drop into every form that lets a user upload a file
 * or paste free-form text, so the practice is reminded — at the point of
 * action — that Fortify is not configured to receive Protected Health
 * Information. The warning is part of Fortify's "we are not a Business
 * Associate" legal posture (see fortify-path-to-production.md).
 *
 * Variants:
 *   - default: full red-bordered alert with the canonical copy
 *   - compact: one-liner footnote for tighter forms
 */

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

export default function NoPhiWarning({ variant = "default", className = "" }: Props) {
  if (variant === "compact") {
    return (
      <p className={`text-[11px] text-[var(--color-danger)] ${className}`}>
        Do not include patient names, dates of birth, MRNs, diagnoses, or any other PHI.
        Fortify is not configured to receive Protected Health Information.
      </p>
    );
  }

  return (
    <div
      className={`rounded-md px-3 py-2.5 text-[12px] leading-relaxed ${className}`}
      style={{
        background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)",
        color: "var(--color-primary)",
      }}
      role="alert"
    >
      <strong className="block mb-1" style={{ color: "var(--color-danger)" }}>
        Do not upload anything containing PHI
      </strong>
      <span className="text-[var(--color-secondary)]">
        No patient names, dates of birth, medical record numbers, diagnoses, treatment notes,
        billing detail, or any other Protected Health Information. Fortify is a compliance-
        management platform — uploads should be policies, attestations, vendor BAAs,
        configuration screenshots, and similar compliance artifacts only.
      </span>
    </div>
  );
}
