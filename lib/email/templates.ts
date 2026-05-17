/**
 * Lightweight HTML email templates. Inline styles only — every mail client
 * strips <style> tags differently. The look should match the app's neon-violet
 * identity while remaining mobile-safe.
 */
const BRAND = {
  bg: "#000000",
  panel: "#0a0a0a",
  border: "#1f1f1f",
  text: "#e5e7eb",
  muted: "#9ca3af",
  violet: "#8b5cf6",
};

interface Layout {
  title: string;
  preheader: string;
  body: string;
  cta?: { label: string; href: string };
}

function shell({ title, preheader, body, cta }: Layout): string {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <span style="display:none;color:${BRAND.bg};">${escapeHtml(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:14px;padding:32px;">
        <tr><td style="padding-bottom:24px;border-bottom:1px solid ${BRAND.border};">
          <span style="font-weight:800;letter-spacing:6px;font-size:14px;color:#ffffff;text-transform:uppercase;">Fortify</span>
        </td></tr>
        <tr><td style="padding:24px 0;">
          ${body}
        </td></tr>
        ${cta ? `<tr><td style="padding-top:8px;">
          <a href="${escapeAttr(cta.href)}" style="display:inline-block;background:${BRAND.violet};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(cta.label)}</a>
        </td></tr>` : ""}
        <tr><td style="padding-top:24px;border-top:1px solid ${BRAND.border};color:${BRAND.muted};font-size:12px;line-height:1.6;">
          Fortify — Compliance automation for healthcare. You received this email because of activity in your Fortify account.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function welcomeEmail(opts: { email: string; appUrl: string }) {
  return shell({
    title: "Welcome to Fortify",
    preheader: "Your compliance workspace is ready",
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Welcome to Fortify</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">Thanks for signing up. Your compliance workspace is ready and we've pre-seeded your practice with the healthcare-baseline controls (MFA, encryption, audit logging, BAAs, training, and more).</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.text};">The fastest way to a real score is to run the 5-minute risk assessment — your AI-generated executive summary will be ready when you're done.</p>
    `,
    cta: { label: "Open Fortify", href: `${opts.appUrl}/app` },
  });
}

export function inviteEmail(opts: { practice_name: string; role: string; invite_url: string }) {
  return shell({
    title: `You've been invited to ${opts.practice_name} on Fortify`,
    preheader: `Join ${opts.practice_name}'s compliance workspace`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">You're invited</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};"><strong>${escapeHtml(opts.practice_name)}</strong> added you to their Fortify compliance workspace as <strong>${escapeHtml(opts.role)}</strong>.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.text};">Click the button below to accept and create your account.</p>
    `,
    cta: { label: "Accept invitation", href: opts.invite_url },
  });
}

export function baaExpiringEmail(opts: {
  practice_name: string;
  vendor_name: string;
  days_remaining: number;
  app_url: string;
}) {
  return shell({
    title: `BAA expiring in ${opts.days_remaining} days`,
    preheader: `${opts.vendor_name} BAA needs renewal`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">BAA expiring soon</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">Your Business Associate Agreement with <strong>${escapeHtml(opts.vendor_name)}</strong> expires in <strong>${opts.days_remaining} days</strong>.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.text};">Renew it now to keep ${escapeHtml(opts.practice_name)}'s HIPAA §164.308(b)(1) coverage intact.</p>
    `,
    cta: { label: "Review BAAs in Fortify", href: `${opts.app_url}/app/vendors` },
  });
}

export function driftAlertEmail(opts: {
  practice_name: string;
  control_title: string;
  check_title: string;
  app_url: string;
}) {
  return shell({
    title: `Control drift detected: ${opts.control_title}`,
    preheader: `Configuration change requires review`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ef4444;">Control drift detected</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">An automated compliance check at <strong>${escapeHtml(opts.practice_name)}</strong> flipped from passing to failing.</p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${BRAND.muted};">Control: <span style="color:#ffffff;">${escapeHtml(opts.control_title)}</span></p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${BRAND.muted};">Check: <span style="color:#ffffff;">${escapeHtml(opts.check_title)}</span></p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.text};">Open the workspace to see the change, acknowledge, or assign a remediation task.</p>
    `,
    cta: { label: "Review in Fortify", href: `${opts.app_url}/app/compliance` },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
function escapeAttr(s: string): string {
  return s.replace(/["<>]/g, (c) => (c === '"' ? "&quot;" : c === "<" ? "&lt;" : "&gt;"));
}
