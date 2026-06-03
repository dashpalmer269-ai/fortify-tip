-- 039_seed_training_modules.sql
-- Seeds a baseline HIPAA Security Awareness training module so the
-- /app/training UI has content to render on day one. Additional
-- modules (phishing simulation, incident response drill, role-specific
-- security) can be added by inserting more rows.

insert into training_modules (
  module_type, title, description, content_markdown,
  duration_minutes, passing_score, active
) values (
  'hipaa_awareness',
  'HIPAA Security Awareness — Annual',
  'Required annual training for every workforce member on HIPAA Security Rule expectations, your obligations, and the practice''s policies.',
  $$
## What HIPAA expects of you

HIPAA's Security Rule (45 CFR §164.308(a)(5)) requires every covered entity and business associate
to implement a security awareness and training program for **all** workforce members. This
module satisfies your annual training requirement.

## The three rules you cannot violate

1. **Never share your account.** Every login is attributable to one person. Even a quick "sign in
   for me real quick" defeats the audit trail that proves the practice is compliant.
2. **Never email PHI to a personal address.** Patient names, dates of birth, diagnoses, billing
   details, or any of the other 18 HIPAA identifiers stay inside the systems the practice has
   approved for clinical use.
3. **Lock your screen every time you walk away.** Even a quick coffee break is enough time for
   someone to access a record they're not authorized to see.

## Recognizing PHI

HIPAA's safe-harbor list of identifiers — any of these in combination with health information
make something PHI:

- Names
- Addresses (anything more specific than state)
- Dates more specific than year (DOB, admission date, discharge date)
- Phone, fax, email
- Social Security numbers
- Medical record numbers
- Health plan beneficiary numbers
- Account numbers
- License numbers
- Vehicle / device identifiers
- Web URLs, IP addresses
- Biometric identifiers (fingerprints, voiceprints)
- Full-face photos
- Any other unique identifying number or characteristic

## What to do if you see something concerning

- **Suspected breach** (you sent PHI to the wrong person, lost a device, opened a phishing email):
  notify your Security Officer or Privacy Officer **immediately**. Speed matters — HIPAA
  notification clocks start ticking on the date of *discovery*, not the date of *report*.
- **Vendor asking for PHI without a BAA in place**: refuse, escalate to your Privacy Officer.
- **Workflow that requires you to do something insecure** (write down passwords, share accounts):
  flag it. Compliance isn't optional, and there's almost always a better workflow available.

## Your obligations on this platform

- Keep your account credentials private. Use MFA — your phone is the second factor.
- Acknowledge each policy version when you receive it (your acknowledgment is recorded with your
  account identity).
- Complete this training annually. Your next due date is one year from your most recent completion.
- Report any incident — even if you think it's minor.

## Wrapping up

Click the button below to record your completion. Your name, the timestamp, and a one-year
expiration date will be saved to your training record. This record is what your practice's
Security Officer will use to demonstrate compliance during an audit.
  $$,
  20,
  100,
  true
) on conflict do nothing;

insert into training_modules (
  module_type, title, description, content_markdown,
  duration_minutes, passing_score, active
) values (
  'phishing',
  'Phishing & Social Engineering — Quick Refresher',
  'A 5-minute refresher on recognizing phishing emails, voice scams, and social-engineering attempts targeting healthcare practices.',
  $$
## Why phishing is the #1 healthcare threat

The 2024 HHS OCR breach data shows over 60% of reported healthcare breaches start with a phishing
email. Healthcare practices are targeted *more* than average — patient records are worth more on
the black market than credit card data.

## The five tell-tales

1. **Urgency or fear** — "Your account will be suspended in 24 hours."
2. **Mismatched sender** — display name says "Microsoft" but the address is `noreply@m1cr0soft-support.ru`.
3. **Unexpected attachment** — a PDF, ZIP, or Office doc you weren't expecting, especially from
   a vendor or "patient."
4. **Hover before you click** — the link text says "Verify your account" but the actual URL is
   `bit.ly/abc123`.
5. **Asks for credentials, MFA codes, or a wire transfer** — no legitimate vendor will ever ask
   you to share your MFA code over email or phone.

## If you think you clicked

- Disconnect the device from the network (turn off Wi-Fi).
- Tell your Security Officer or IT lead — *now*, not tomorrow.
- Don't try to "fix it" by logging back in to verify — that just gives the attacker your second
  attempt.

## The voice-phone version

The same playbook over the phone. Common scenarios:

- "I'm calling from Microsoft Support, we detected a virus on your computer."
- "I'm a new patient's daughter and need their medical records faxed to a different address right now."
- "I'm with the billing department of [your EHR vendor], we need your admin password to push a critical update."

If you didn't initiate the call and they're asking for credentials, money, or PHI — hang up and
call back through a known number.

Click the button below to record your completion.
  $$,
  5,
  100,
  true
) on conflict do nothing;
