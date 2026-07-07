# Supabase Auth email templates

**Status: LIVE.** All four templates + subjects are deployed to the prod
Supabase project (`cqxvzsbyoeporgyjmrcp`) — confirmed via the Management API
on 2026-07-06. The HTML files in this folder are exports of exactly what's
deployed, kept in-repo for versioning. Light-theme design (white card,
violet #7c3aed accents) — this is the canonical auth-email style; the
in-app transactional emails (`lib/email/templates.ts`) use the dark shell.

| Supabase template  | File                  | Live subject                       |
|--------------------|-----------------------|------------------------------------|
| Confirm signup     | `confirm-signup.html` | Confirm your email — Fortify       |
| Reset password     | `reset-password.html` | Reset your Fortify password        |
| Magic link         | `magic-link.html`     | Your sign-in link for Fortify      |
| Change email       | `change-email.html`   | Confirm your new email — Fortify   |

Also confirmed live in Auth → URL Configuration: Site URL
`https://fortifynow.xyz`; allow-list includes `https://fortifynow.xyz/**`,
`https://fortify-zeta.vercel.app/**`, and `http://localhost:3000/**`.

"Invite user" is intentionally left at the Supabase default — Fortify sends
its own team invites via Resend (`practice_invites`, migration 048).

## To edit a template later

Edit the file here, then push it with the Management API (needs an
`sbp_...` personal access token from supabase.com/dashboard/account/tokens):

```bash
node -e "const fs=require('fs');fs.writeFileSync('/tmp/p.json',JSON.stringify({mailer_templates_email_change_content:fs.readFileSync('change-email.html','utf8')}))"
curl -X PATCH "https://api.supabase.com/v1/projects/cqxvzsbyoeporgyjmrcp/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/p.json
```

Field names: `mailer_templates_{confirmation,recovery,magic_link,email_change}_content`
and `mailer_subjects_{confirmation,recovery,magic_link,email_change}`.
