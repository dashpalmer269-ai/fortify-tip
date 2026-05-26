#!/usr/bin/env node
// Test the /api/team/name endpoint.

import {
  C, step, ok, fail,
  adminCreate, signIn, cookieFor,
  appPost, restGet, makeTracker, finalizePayload, employeeSubmitBody,
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
  const adminAEmail = `adminA-${t}@edit.local`;
  const adminBEmail = `adminB-${t}@edit.local`;

  step(1, "Setup: practice A (admin + staff), practice B (admin)");
  const pAId = await setupPractice(adminAEmail, `Edit Test A ${t}`);
  await setupPractice(adminBEmail, `Edit Test B ${t}`);

  // We need admin user IDs for the test
  const adminAUser = (await restGet<Array<{ user_id: string }>>(
    `practice_users?practice_id=eq.${pAId}&role=eq.owner&select=user_id`
  ))[0];
  const adminAId = adminAUser?.user_id ?? "";

  const cAA = cookieFor(await signIn(adminAEmail, PASS));
  const cAB = cookieFor(await signIn(adminBEmail, PASS));

  const standard = await adminCreate(`std-${t}@edit.local`, PASS, "employee");
  tracker.users.push(standard.id);
  await appPost(
    "/api/onboarding/employee",
    employeeSubmitBody(`Edit Test A ${t}`, "Original Name", "Tech", "A"),
    cookieFor(await signIn(`std-${t}@edit.local`, PASS)),
  );
  await appPost(`/api/team/requests/${standard.id}`, { action: "approve", role: "staff" }, cAA);
  ok("practice A has admin + 1 approved staff; practice B has admin");

  step(2, "Admin A renames staff");
  const r1 = await appPost(`/api/team/name`, {
    practice_id: pAId, target_user_id: standard.id, full_name: "Updated Name",
  }, cAA);
  if (!r1.ok) fail(`rename: ${r1.status} ${await r1.text()}`);
  else {
    const p = await restGet<Array<{ full_name: string | null }>>(
      `user_profiles?user_id=eq.${standard.id}&select=full_name`
    );
    if (p[0]?.full_name === "Updated Name") ok(`profile.full_name updated`);
    else fail(`profile.full_name not updated: ${JSON.stringify(p)}`);
  }

  step(3, "Admin A renames themselves (no existing profile)");
  const r2 = await appPost(`/api/team/name`, {
    practice_id: pAId, target_user_id: adminAId, full_name: "Admin A Name",
  }, cAA);
  if (!r2.ok) fail(`self-rename: ${r2.status} ${await r2.text()}`);
  else {
    const p = await restGet<Array<{ full_name: string | null; status: string }>>(
      `user_profiles?user_id=eq.${adminAId}&select=full_name,status`
    );
    if (p[0]?.full_name === "Admin A Name") ok(`admin's profile created on the fly with name`);
    else fail(`admin profile not created: ${JSON.stringify(p)}`);
  }

  step(4, "Staff attempts to rename admin");
  const sessStd = cookieFor(await signIn(`std-${t}@edit.local`, PASS));
  const r3 = await appPost(`/api/team/name`, {
    practice_id: pAId, target_user_id: adminAId, full_name: "hacker",
  }, sessStd);
  if (r3.status === 403) ok(`staff rename → 403`);
  else fail(`expected 403, got ${r3.status}`);

  step(5, "Admin B (different practice) tries to rename staff in practice A");
  const r4 = await appPost(`/api/team/name`, {
    practice_id: pAId, target_user_id: standard.id, full_name: "x",
  }, cAB);
  if (r4.status === 403) ok(`cross-practice admin → 403`);
  else fail(`expected 403, got ${r4.status}: ${await r4.text()}`);

  step(6, "Empty name");
  const r5 = await appPost(`/api/team/name`, {
    practice_id: pAId, target_user_id: standard.id, full_name: "   ",
  }, cAA);
  if (r5.status === 400) ok(`empty name → 400`);
  else fail(`expected 400, got ${r5.status}`);

  step(7, "Oversized name (>120 chars)");
  const r6 = await appPost(`/api/team/name`, {
    practice_id: pAId, target_user_id: standard.id, full_name: "x".repeat(200),
  }, cAA);
  if (r6.status === 400) ok(`200-char name → 400`);
  else fail(`expected 400, got ${r6.status}`);

  step(8, "Audit log entry");
  const audit = await restGet<Array<{ metadata: unknown }>>(
    `audit_logs?practice_id=eq.${pAId}&action=eq.team.name_updated&select=metadata`
  );
  if (audit.length >= 2) ok(`team.name_updated logged ${audit.length}x`);
  else fail(`expected ≥2 audit entries, got ${audit.length}`);

  step(9, "Cleanup");
  await tracker.cleanup();
  ok("cleaned up");

  console.log(`\n${process.exitCode ? C.r + "━━ TEST FAILED ━━" : C.g + "━━ EDIT STAFF TESTS PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  await tracker.cleanup();
});
