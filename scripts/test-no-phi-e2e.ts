#!/usr/bin/env node
// End-to-end check: submitting PHI to onboarding endpoints returns 422
// before anything reaches the database.

import {
  C, step, ok, fail,
  adminCreate, signIn, cookieFor,
  appPost, makeTracker, employeeSubmitBody, finalizePayload,
} from "./_test-helpers";

const PASS = "Pass!123Strong";
const tracker = makeTracker();

async function main(): Promise<void> {
  const t = Date.now();
  const admin = await adminCreate(`phi-admin-${t}@test.local`, PASS, "admin");
  tracker.users.push(admin.id);
  const adminC = cookieFor(await signIn(`phi-admin-${t}@test.local`, PASS));

  const std = await adminCreate(`phi-std-${t}@test.local`, PASS, "employee");
  tracker.users.push(std.id);
  const stdC = cookieFor(await signIn(`phi-std-${t}@test.local`, PASS));

  step(1, "Admin /finalize with SSN in description → 422");
  const base1 = finalizePayload("Test " + t);
  const r1 = await appPost("/api/onboarding/finalize", {
    ...base1,
    state: {
      ...base1.state,
      information: { ...base1.state.information, description: "Family medicine. Pt SSN 123-45-6789 attached." },
    },
  }, adminC);
  const b1 = await r1.json() as { error?: string };
  if (r1.status === 422) ok(`status 422, msg: "${(b1.error ?? "").slice(0, 80)}..."`);
  else fail(`expected 422, got ${r1.status}: ${JSON.stringify(b1).slice(0, 120)}`);

  step(2, "Admin /finalize with MRN in practice name → 422");
  const r2 = await appPost("/api/onboarding/finalize", finalizePayload("Practice MRN: 5559876"), adminC);
  if (r2.status === 422) ok(`MRN in name → 422`);
  else fail(`expected 422, got ${r2.status}: ${(await r2.text()).slice(0, 120)}`);

  step(3, "Standard /employee with DOB phrase in admin name → 422");
  const r3 = await appPost("/api/onboarding/employee",
    employeeSubmitBody("Some Practice", "Jane Doe", "Tech", "Boss DOB: 1985-01-01"),
    stdC,
  );
  if (r3.status === 422) ok(`DOB in admin name → 422`);
  else fail(`expected 422, got ${r3.status}: ${(await r3.text()).slice(0, 120)}`);

  step(4, "Standard /employee with 'patient name' phrase → 422");
  const r4 = await appPost("/api/onboarding/employee",
    employeeSubmitBody("P", "OK Name", "Manages patient name records", "Admin"),
    stdC,
  );
  if (r4.status === 422) ok(`patient phrase → 422`);
  else fail(`expected 422, got ${r4.status}: ${(await r4.text()).slice(0, 120)}`);

  step(5, "Clean standard submission still succeeds");
  const r5 = await appPost("/api/onboarding/employee", employeeSubmitBody("Clean Practice " + t), stdC);
  if (r5.ok) ok(`clean submission accepted`);
  else fail(`clean submission rejected: ${r5.status} ${(await r5.text()).slice(0, 120)}`);

  await tracker.cleanup();
  console.log(`\n${process.exitCode ? C.r + "━━ FAILED ━━" : C.g + "━━ NO-PHI E2E PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  await tracker.cleanup();
});
