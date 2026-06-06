-- 040_update_training_content.sql
-- Training upgrade: video-anchored content + quiz gate replacement.
--
-- The training UI is being upgraded from a checkbox completion to a
-- 10-question quiz (80% to pass), so the markdown content for each
-- module now points the learner at the official HHS/CMS video FIRST,
-- then names the key points to listen for, then defers the actual
-- "I learned this" decision to the quiz.
--
-- This migration:
--   1. UPDATES the existing hipaa_awareness module's content (the row
--      was inserted by 039).
--   2. INSERTS two new modules — hipaa_privacy and breach_notification —
--      with the same shape. Both are idempotent (NOT EXISTS guards).
--   3. Leaves the phishing module from 039 alone; its content is still
--      good, and the QuizButton will source phishing questions from the
--      QUIZ_QUESTIONS constant in the component.

-- ── 1. UPDATE hipaa_awareness ────────────────────────────────────────────
update training_modules set
  title = 'HIPAA Security Awareness — Annual',
  description = 'Required annual training on the HIPAA Security Rule. Watch the official HHS / Office for Civil Rights video, then pass a 10-question quiz (80% to pass) to record completion.',
  duration_minutes = 25,
  passing_score = 80,
  content_markdown = $$
## Before you take the quiz

Watch the official HHS Office for Civil Rights video before starting. This
video is published by the U.S. Department of Health & Human Services — the
agency that enforces HIPAA. The same content has been used as the basis for
real OCR audits.

[▶ Watch on YouTube — ~20 min](https://youtube.com/watch?v=QWRn2r5R7ts)

---

## Key points covered

- The HIPAA Security Rule's three safeguard categories: **administrative**, **physical**, and **technical**
- The **minimum necessary** standard and how it shapes access decisions
- **Risk analysis** and risk management as ongoing requirements, not a one-time event
- **Workforce training**, sanctions, and accountability — every workforce member is responsible
- **Documentation retention**: 6 years from the date of creation or last effective date
- **HHS Office for Civil Rights (OCR)** is the enforcement agency

---

## When you finish the video

Take the 10-question quiz below. You need **8 of 10 correct** to record your completion. If you fall short, you can retake the quiz — review the correct answers from the failed attempt before retrying.
$$
where module_type = 'hipaa_awareness';

-- ── 2. INSERT hipaa_privacy (idempotent) ─────────────────────────────────
insert into training_modules (
  module_type, title, description, content_markdown,
  duration_minutes, passing_score, active
)
select
  'hipaa_privacy',
  'HIPAA Privacy Rule — Annual',
  'Required annual training on the HIPAA Privacy Rule: use and disclosure, minimum necessary, patient rights, Notice of Privacy Practices. Includes link to the official HHS/CMS training portal + 10-question quiz (80% to pass).',
  $$
## Before you take the quiz

Open the official HHS / CMS HIPAA training portal. CMS curates a plain-language
walk-through of the Privacy Rule organized for healthcare workforce members.
Allow about 20 minutes to scan the major sections.

[Open the official HHS/CMS HIPAA training portal](https://www.cms.gov/training-education/by-setting/providers-and-suppliers/hipaa)

---

## Key points covered

- The Privacy Rule's scope: **use** and **disclosure** of Protected Health Information (PHI)
- The **minimum necessary** standard for all uses, requests, and disclosures
- **Treatment, Payment, Operations** (TPO) — when authorization is required vs not required
- Patient rights:
  - **Access** to their records
  - **Amendment** of inaccurate records
  - **Accounting of disclosures** beyond TPO
  - **Request restrictions** on certain uses
- **Notice of Privacy Practices** requirements
- The required **Privacy Officer** designation
- **Heightened protections** for psychotherapy notes

---

## When you finish the material

Take the 10-question quiz below. You need **8 of 10 correct** to record your completion. The quiz is open-book — you can scroll back to the linked material at any time.
$$,
  20,
  80,
  true
where not exists (
  select 1 from training_modules where module_type = 'hipaa_privacy'
);

-- ── 3. INSERT breach_notification (idempotent) ───────────────────────────
insert into training_modules (
  module_type, title, description, content_markdown,
  duration_minutes, passing_score, active
)
select
  'breach_notification',
  'HIPAA Breach Notification — Annual',
  'Required annual training on the HIPAA Breach Notification Rule: what is a breach, the 60-day notice window, risk assessment, Business Associate obligations. Includes official HHS video + 10-question quiz (80% to pass).',
  $$
## Before you take the quiz

Watch the official HHS Office for Civil Rights video on breach notification.

[▶ Watch on YouTube — ~25 min](https://youtube.com/watch?v=VnbBxxyZLc8)

---

## Key points covered

- The **definition** of "breach" of unsecured PHI under §164.402
- The **60-day individual notification** deadline (§164.404)
- **Media notification** + **immediate HHS notification** when 500 or more individuals are affected
- The **annual roll-up** for breaches affecting fewer than 500
- The **four-factor breach risk assessment** that determines whether a probable compromise occurred
- **Business Associate** notification obligations (BAs notify the covered entity, not the patients directly)
- The HHS **public breach portal** — sometimes called the "Wall of Shame"
- The **burden of proof** sits with the covered entity / business associate

---

## When you finish the video

Take the 10-question quiz below. You need **8 of 10 correct** to record your completion. If you fall short, you can retake the quiz — review the correct answers from the failed attempt before retrying.
$$,
  25,
  80,
  true
where not exists (
  select 1 from training_modules where module_type = 'breach_notification'
);
