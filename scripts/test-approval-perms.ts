#!/usr/bin/env node
// Permission edge cases for the approval endpoints.

import {
  C, step, ok, fail,
  adminCreate, signIn, cookieFor,
  appPost, makeTracker, finalizePayload, employeeSubmitBody,
} from "./_test-helpers";

const PASS = "Pass!123Strong";
const tracker = makeTracker();

async function setupPractice(adminEmail: string, practiceName: string): Promise<string> {
  const adminUser = await adminCreate(adminEmail, PASS, "admin");
  tracker.users.push(adminUser.id);
  const cookie = cookieFor(await signIn(adminEmail, PASS));
  const res = await appPost("/api/onboarding/finalize", finalizePayload(practiceName), cookie);
  const body = (await res.json()) as { practice_id?: string };
  if (!body.practice_id) throw new Error(`failed to create practice ${practiceName}: ${res.status}`);
  tracker.practices.push(body.practice_id);
  return body.practice_id;
}

async function main(): Promise<void> {
  const t = Date.now();

  step(1, "Setup: two admins, each with a practice, a pending standard + an approved staff under A");
  const adminAEmail = `adminA-${t}@perm.local`;
  const adminBEmail = `adminB-${t}@perm.local`;
  await setupPractice(adminAEmail, `Practice A ${t}`);
  await setupPractice(adminBEmail, `Practice B ${t}`);

  const cAA = cookieFor(await signIn(adminAEmail, PASS));
  const cAB = cookieFor(await signIn(adminBEmail, PASS));

  const pending = await adminCreate(`pending-${t}@perm.local`, PASS, "employee");
  tracker.users.push(pending.id);
  const pendingCookie = cookieFor(await signIn(`pending-${t}@perm.local`, PASS));
  await appPost("/api/onboarding/employee", employeeSubmitBody(`Practice A ${t}`), pendingCookie);

  const approved = await adminCreate(`approved-${t}@perm.local`, PASS, "employee");
  tracker.users.push(approved.id);
  await appPost(
    "/api/onboarding/employee",
    employeeSubmitBody(`Practice A ${t}`),
    cookieFor(await signIn(`approved-${t}@perm.local`, PASS)),
  );
  await appPost(`/api/team/requests/${approved.id}`, { action: "approve", role: "staff" }, cAA);
  ok("Practice A + B set up; one pending request, one already-approved staff under A");

  step(2, "Staff (non-admin) attempts to approve");
  const sessStaff = cookieFor(await signIn(`approved-${t}@perm.local`, PASS));
  const r1 = await appPost(`/api/team/requests/${pending.id}`, { action: "approve", role: "staff" }, sessStaff);
  if (r1.status === 403) ok(`staff approve → 403 Forbidden`);
  else fail(`staff approve: expected 403, got ${r1.status}: ${await r1.text()}`);

  step(3, "Admin from Practice B attempts to approve a Practice A request");
  const r2 = await appPost(`/api/team/requests/${pending.id}`, { action: "approve", role: "staff" }, cAB);
  if (r2.status === 403) ok(`cross-practice admin approve → 403`);
  else fail(`cross-practice approve: expected 403, got ${r2.status}: ${await r2.text()}`);

  step(4, "Admin tries to approve someone already approved");
  const r3 = await appPost(`/api/team/requests/${approved.id}`, { action: "approve", role: "staff" }, cAA);
  if (r3.status === 409) ok(`double-approve → 409 already-decided`);
  else fail(`double-approve: expected 409, got ${r3.status}: ${await r3.text()}`);

  step(5, "Unauthenticated request to approve endpoint");
  const r4 = await appPost(`/api/team/requests/${pending.id}`, { action: "approve", role: "staff" });
  if (r4.status === 401) ok(`unauth approve → 401`);
  else fail(`unauth approve: expected 401, got ${r4.status}: ${await r4.text()}`);

  step(6, "Pending user tries to self-approve");
  const r5 = await appPost(`/api/team/requests/${pending.id}`, { action: "approve", role: "staff" }, pendingCookie);
  if (r5.status === 403) ok(`self-approve → 403`);
  else fail(`self-approve: expected 403, got ${r5.status}: ${await r5.text()}`);

  step(7, "Invalid action body");
  const r6 = await appPost(`/api/team/requests/${pending.id}`, { action: "delete" }, cAA);
  if (r6.status === 400) ok(`invalid action → 400`);
  else fail(`invalid action: expected 400, got ${r6.status}`);

  step(8, "Cleanup");
  await tracker.cleanup();
  ok(`${tracker.practices.length} practices + ${tracker.users.length} users deleted`);

  console.log(`\n${process.exitCode ? C.r + "━━ EDGE TESTS FAILED ━━" : C.g + "━━ ALL EDGE CASES PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  await tracker.cleanup();
});
