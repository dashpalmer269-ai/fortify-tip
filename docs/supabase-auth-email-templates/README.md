# Supabase Auth email templates

Branded replacements for the four default Supabase auth emails, matching the
product's transactional email look (`lib/email/templates.ts`).

These CANNOT be deployed from code — Supabase auth templates are dashboard
(or Management API) configuration. Paste them in once:

1. Open https://supabase.com/dashboard/project/cqxvzsbyoeporgyjmrcp/auth/templates
2. For each template below, replace the **Message body** with the matching
   file's full HTML and set the **Subject**:

| Supabase template  | File                  | Subject to set                       |
|--------------------|-----------------------|--------------------------------------|
| Confirm signup     | `confirm-signup.html` | Confirm your Fortify account         |
| Reset password     | `reset-password.html` | Reset your Fortify password          |
| Magic link         | `magic-link.html`     | Your Fortify sign-in link            |
| Change email       | `change-email.html`   | Confirm your new email for Fortify   |

3. Leave "Invite user" as-is — Fortify sends its own team invites via Resend
   (`practice_invites`, migration 048), not Supabase's invite flow.

Notes:
- `{{ .ConfirmationURL }}` is the only template variable used; it works in
  all four templates.
- While you're in Auth settings, verify **Site URL** is
  `https://fortifynow.xyz` and `https://fortifynow.xyz/**` is in Redirect
  URLs (Auth → URL Configuration) — required for the links in these emails
  to land on the production domain.
