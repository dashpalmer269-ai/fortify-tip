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

export function joinRequestCreatedEmail(opts: {
  practice_name: string;
  requester_name: string;
  requester_job: string;
  app_url: string;
}) {
  return shell({
    title: `New join request for ${opts.practice_name}`,
    preheader: `${opts.requester_name} wants to join`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">New join request</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};"><strong>${escapeHtml(opts.requester_name)}</strong> (${escapeHtml(opts.requester_job)}) requested access to your Fortify workspace at <strong>${escapeHtml(opts.practice_name)}</strong>.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.text};">Review their details and approve or deny the request from the Team page.</p>
    `,
    cta: { label: "Review request", href: `${opts.app_url}/app/team` },
  });
}

export function joinRequestApprovedEmail(opts: {
  practice_name: string;
  role_label: string;
  app_url: string;
}) {
  return shell({
    title: `You're in: ${opts.practice_name} on Fortify`,
    preheader: "Your access was approved",
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">You're approved</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">An administrator at <strong>${escapeHtml(opts.practice_name)}</strong> approved your request to join their Fortify compliance workspace.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.text};">You've been assigned the <strong>${escapeHtml(opts.role_label)}</strong> role. Sign in to get started.</p>
    `,
    cta: { label: "Open Fortify", href: `${opts.app_url}/app` },
  });
}

export function joinRequestDeniedEmail(opts: {
  practice_name: string;
  reason: string | null;
  app_url: string;
}) {
  return shell({
    title: `Your access request was declined`,
    preheader: `${opts.practice_name} did not approve your request`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Access not granted</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">An administrator at <strong>${escapeHtml(opts.practice_name)}</strong> did not approve your access request.</p>
      ${opts.reason
        ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${BRAND.muted};">Reason: <span style="color:#ffffff;">${escapeHtml(opts.reason)}</span></p>`
        : ""}
      <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.text};">If this is a mistake, contact your administrator directly.</p>
    `,
    cta: { label: "Open Fortify", href: `${opts.app_url}/denied` },
  });
}

export function readinessDigestEmail(opts: {
  practice_name: string;
  overall_pct: number;
  delta_pct: number;
  critical_open: number;
  drift_alerts_week: number;
  baas_expiring: number;
  ai_summary: string;
  app_url: string;
}) {
  const direction = opts.delta_pct === 0 ? "" : opts.delta_pct > 0 ? "↑" : "↓";
  const deltaColor = opts.delta_pct >= 0 ? "#10b981" : "#ef4444";
  return shell({
    title: `Weekly readiness digest — ${opts.practice_name}`,
    preheader: `Overall ${opts.overall_pct}% · ${opts.critical_open} critical open · ${opts.drift_alerts_week} drift this week`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Weekly readiness digest</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">
        <tr>
          <td style="padding:14px;background:#0f0f0f;border-radius:8px;width:50%;">
            <p style="margin:0 0 4px;font-size:11px;color:${BRAND.muted};letter-spacing:1.4px;text-transform:uppercase;">Overall readiness</p>
            <p style="margin:0;font-size:28px;color:#ffffff;font-weight:700;">${opts.overall_pct}%
              <span style="font-size:14px;color:${deltaColor};font-weight:500;">${direction} ${Math.abs(opts.delta_pct)}%</span>
            </p>
          </td>
          <td width="12"></td>
          <td style="padding:14px;background:#0f0f0f;border-radius:8px;width:50%;">
            <p style="margin:0 0 4px;font-size:11px;color:${BRAND.muted};letter-spacing:1.4px;text-transform:uppercase;">Critical open</p>
            <p style="margin:0;font-size:28px;color:#ffffff;font-weight:700;">${opts.critical_open}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:${BRAND.muted};line-height:1.6;">
        Drift alerts this week: <span style="color:#ffffff;">${opts.drift_alerts_week}</span> ·
        BAAs expiring soon: <span style="color:#ffffff;">${opts.baas_expiring}</span>
      </p>
      <div style="margin:18px 0;padding:14px;background:#0f0f0f;border-radius:8px;border-left:3px solid ${BRAND.violet};">
        <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.text};">${escapeHtml(opts.ai_summary)}</p>
      </div>
    `,
    cta: { label: "Open dashboard", href: `${opts.app_url}/app` },
  });
}

export function workforceRescreenBlockedEmail(opts: {
  practice_id: string;
  member_name: string;
  app_url: string;
}) {
  return shell({
    title: `Compliance verification paused access for ${opts.member_name}`,
    preheader: "Periodic re-screening flagged a workforce member",
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Verification needed</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};"><strong>${escapeHtml(opts.member_name)}</strong>'s periodic compliance verification did not complete cleanly. Their workspace access is paused while we re-verify.</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${BRAND.muted};">You don't need to take immediate action. The member will be prompted to complete a brief verification next time they sign in. If you believe this is in error, you can override the decision from the Team page.</p>
    `,
    cta: { label: "Open Team", href: `${opts.app_url}/app/team` },
  });
}

export function taskReminderEmail(opts: {
  overdue: Array<{ title: string; due_date: string }>;
  due_soon: Array<{ title: string; due_date: string }>;
  app_url: string;
}) {
  const row = (t: { title: string; due_date: string }, isOverdue: boolean) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.text};">
       ${escapeHtml(t.title)}
       <span style="color:${isOverdue ? "#ef4444" : BRAND.muted};font-size:12px;"> &middot; ${isOverdue ? "overdue" : "due"} ${escapeHtml(t.due_date)}</span>
     </td></tr>`;
  return shell({
    title: "Your compliance tasks need attention",
    preheader: `${opts.overdue.length} overdue, ${opts.due_soon.length} due soon`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Tasks needing attention</h1>
      ${opts.overdue.length > 0 ? `<p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:#ef4444;">Overdue</p><table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${opts.overdue.map((t) => row(t, true)).join("")}</table>` : ""}
      ${opts.due_soon.length > 0 ? `<p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:${BRAND.muted};">Due soon</p><table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">${opts.due_soon.map((t) => row(t, false)).join("")}</table>` : ""}
    `,
    cta: { label: "Open Fortify", href: `${opts.app_url}/app` },
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
