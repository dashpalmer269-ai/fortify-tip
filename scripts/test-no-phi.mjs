#!/usr/bin/env node
// Verifies the PHI detection and audit-sanitization helpers.
// Pure unit test — no API / DB calls. Run with: npx tsx scripts/test-no-phi.mjs

import { detectPhi, containsPhi, scanFieldsForPhi, sanitizeForAudit, NO_PHI_AI_SYSTEM_PROMPT, NO_PHI_POLICY } from "../lib/compliance/no-phi";

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", x: "\x1b[0m" };
let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ${C.g}✓${C.x} ${m}`); pass++; };
const bad = (m) => { console.log(`  ${C.r}✗${C.x} ${m}`); fail++; };

function expect(label, actual, predicate) {
  if (predicate(actual)) ok(label);
  else bad(`${label} — got ${JSON.stringify(actual)}`);
}

console.log(`${C.y}1. Detects SSN patterns${C.x}`);
expect("SSN dashed",   detectPhi("Customer SSN 123-45-6789"),    (m) => m.some((x) => x.category === "SSN"));
expect("SSN spaced",   detectPhi("Customer SSN 123 45 6789"),    (m) => m.some((x) => x.category === "SSN"));
expect("SSN solid",    detectPhi("ssn:123456789 next"),          (m) => m.some((x) => x.category === "SSN"));

console.log(`\n${C.y}2. Detects MRN patterns${C.x}`);
expect("MRN colon",    detectPhi("Pt MRN: 1029384"),             (m) => m.some((x) => x.category === "MRN"));
expect("MRN hash",     detectPhi("MR# 555123"),                  (m) => m.some((x) => x.category === "MRN"));
expect("medical record phrase", detectPhi("medical record number 1234567"), (m) => m.some((x) => x.category === "MRN"));

console.log(`\n${C.y}3. Detects ICD / CPT / NPI / DOB / phone${C.x}`);
expect("ICD-10",       detectPhi("Diagnosis E11.9 noted"),       (m) => m.some((x) => x.category === "ICD-10 code"));
expect("CPT",          detectPhi("CPT 99213 billed"),            (m) => m.some((x) => x.category === "CPT code"));
expect("NPI",          detectPhi("Provider NPI 1234567890"),     (m) => m.some((x) => x.category === "NPI"));
expect("DOB explicit", detectPhi("DOB: 01/12/1985"),             (m) => m.some((x) => x.category === "Date of birth"));
expect("Phone US",     detectPhi("Call 512-555-1234 anytime"),   (m) => m.some((x) => x.category === "Phone number"));

console.log(`\n${C.y}4. Negative cases (no PHI expected)${C.x}`);
expect("Empty",           detectPhi(""),                                   (m) => m.length === 0);
expect("Generic compliance text",
       detectPhi("Implement multi-factor authentication on all admin accounts to satisfy HIPAA 164.308(a)(5)(i)."),
       (m) => m.length === 0);
expect("Practice name",   detectPhi("Cedar Park Family Medicine"),         (m) => m.length === 0);
expect("Vendor",          detectPhi("AWS HIPAA-eligible services"),        (m) => m.length === 0);
expect("year alone",      detectPhi("Onboarded in 2024"),                  (m) => m.length === 0);

console.log(`\n${C.y}5. scanFieldsForPhi returns first match with field name${C.x}`);
const r1 = scanFieldsForPhi({ title: "Backup policy", notes: "Pt SSN 555-22-3344" });
expect("returns object", r1, (v) => v && typeof v === "object");
expect("field is notes", r1.field, (v) => v === "notes");
expect("categories include SSN", r1.categories, (v) => v.includes("SSN"));
expect("message mentions notes", r1.message, (v) => v.includes("notes"));
expect("message mentions PHI",   r1.message, (v) => v.includes("PHI") || v.includes("patient"));

const r2 = scanFieldsForPhi({ title: "Backup policy", notes: "Restore weekly." });
expect("clean input returns null", r2, (v) => v === null);

console.log(`\n${C.y}6. sanitizeForAudit redacts PHI in metadata values${C.x}`);
const meta = { plan: "practice", admin_note: "Pt SSN 123-45-6789", count: 5 };
const cleaned = sanitizeForAudit(meta);
expect("plan preserved",       cleaned.plan,       (v) => v === "practice");
expect("count preserved",      cleaned.count,      (v) => v === 5);
expect("admin_note redacted",  cleaned.admin_note, (v) => typeof v === "string" && v.startsWith("[redacted"));

console.log(`\n${C.y}7. Policy constants exist and are non-empty${C.x}`);
expect("system prompt has length",  NO_PHI_AI_SYSTEM_PROMPT.length,           (v) => v > 500);
expect("system prompt mentions PHI",NO_PHI_AI_SYSTEM_PROMPT,                  (v) => v.includes("PHI"));
expect("system prompt mentions 18", NO_PHI_AI_SYSTEM_PROMPT,                  (v) => v.includes("18"));
expect("system prompt refuses",     NO_PHI_AI_SYSTEM_PROMPT.toLowerCase(),    (v) => v.includes("refuse"));
expect("policy has title",          NO_PHI_POLICY.title,                      (v) => v.length > 0);
expect("policy cites 45 CFR",       NO_PHI_POLICY.citation,                   (v) => v.includes("45 CFR"));

console.log(`\n${C.y}8. containsPhi convenience${C.x}`);
expect("true on PHI",     containsPhi("SSN: 123-45-6789"), (v) => v === true);
expect("false on clean",  containsPhi("Compliance update"), (v) => v === false);
expect("false on null",   containsPhi(null), (v) => v === false);

console.log(`\n${fail === 0 ? C.g + "━━ " + pass + " NO-PHI ASSERTIONS PASSED ━━" : C.r + "━━ " + fail + " FAILED, " + pass + " passed ━━"}${C.x}\n`);
process.exit(fail === 0 ? 0 : 1);
