#!/usr/bin/env node
// End-to-end test of the approval workflow:
//   1. Admin signs up, completes onboarding, creates a practice.
//   2. Standard-A signs up, submits join request with matching practice name.
//   3. Verify: profile is pending, admin got notification, matched_practice_id set.
//   4. Admin approves Standard-A; verify membership row + status flip + notification.
//   5. Standard-B signs up, requests join with matching name.
//   6. Admin denies Standard-B with a reason; verify denied state + notification.
//   7. Edge: Standard-C signs up with a NON-matching practice name; verify unmatched.

import {
  C, step, ok, fail,
  adminCreate, signIn, cookieFor,
  appPost, appGet, restGet, makeTracker,
  finalizePayload, employeeSubmitBody,
} from "./_test-helpers";

const PASS = "TestPass!123Strong";
const PRACTICE_NAME = `Cedar Park Demo ${Date.now()}`;
const tracker = makeTracker();

async function main(): Promise<void> {
  step(1, "Admin completes onboarding");
  const adminEmail = `admin-${Date.now()}@flow-test.local`;
  const admin = await adminCreate(adminEmail, PASS, "admin");
  tracker.users.push(admin.id);
  const adminCookie = cookieFor(await signIn(adminEmail, PASS));
  ok(`admin user: ${adminEmail} (${admin.id})`);

  const finalizeRes = await appPost("/api/onboarding/finalize", finalizePayload(PRACTICE_NAME), adminCookie);
  const fb = (await finalizeRes.json()) as { ok?: boolean; practice_id?: string; error?: string };
  if (!finalizeRes.ok || !fb.ok || !fb.practice_id) {
    fail(`finalize: ${finalizeRes.status} ${JSON.stringify(fb)}`);
    return;
  }
  tracker.practices.push(fb.practice_id);
  ok(`practice created: ${PRACTICE_NAME} (${fb.practice_id})`);

  // ── 2. Standard-A submits ─────────────────────────────────────────────
  step(2, "Standard-A requests to join (matching practice name)");
  const sAEmail = `standard-a-${Date.now()}@flow-test.local`;
  const sA = await adminCreate(sAEmail, PASS, "employee");
  tracker.users.push(sA.id);
  const sACookie = cookieFor(await signIn(sAEmail, PASS));

  const sAEmpRes = await appPost(
    "/api/onboarding/employee",
    employeeSubmitBody(PRACTICE_NAME, "Jane Doe", "Office Manager", "Practice Admin"),
    sACookie,
  );
  const sAB = (await sAEmpRes.json()) as { ok?: boolean; matched?: boolean; error?: string };
  if (!sAEmpRes.ok || !sAB.ok) {
    fail(`Standard-A submit: ${sAEmpRes.status} ${JSON.stringify(sAB)}`);
    return;
  }
  ok(`Standard-A submitted (matched=${sAB.matched})`);
  if (sAB.matched !== true) fail("expected matched=true for exact name");

  step(3, "Verify Standard-A is pending + admin received notification");
  const sAProfile = await restGet<Array<{ status: string; matched_practice_id: string | null }>>(
    `user_profiles?user_id=eq.${sA.id}&select=status,matched_practice_id,full_name,claimed_admin_name`
  );
  if (sAProfile[0]?.status !== "pending") fail(`status: ${sAProfile[0]?.status}`);
  else ok(`profile.status = pending`);
  if (sAProfile[0]?.matched_practice_id !== fb.practice_id) fail(`matched_practice_id mismatch`);
  else ok(`matched_practice_id linked to admin's practice`);

  const adminNotifs = await restGet<Array<{ title: string; body: string; link: string }>>(
    `notifications?user_id=eq.${admin.id}&kind=eq.request.created&select=title,body,link`
  );
  if (adminNotifs.length === 0) fail(`admin received 0 notifications`);
  else ok(`admin got "${adminNotifs[0]?.title}" notification → ${adminNotifs[0]?.link}`);

  // ── 4. Admin approves Standard-A ──────────────────────────────────────
  step(4, "Admin approves Standard-A as 'staff'");
  const approveRes = await appPost(`/api/team/requests/${sA.id}`, { action: "approve", role: "staff" }, adminCookie);
  const apprB = (await approveRes.json()) as { ok?: boolean; status?: string; error?: string };
  if (!approveRes.ok || apprB.status !== "approved") {
    fail(`approve: ${approveRes.status} ${JSON.stringify(apprB)}`);
    return;
  }
  ok(`approve → ${apprB.status}`);

  const sAProfile2 = await restGet<Array<{ status: string; decided_by: string | null }>>(
    `user_profiles?user_id=eq.${sA.id}&select=status,decided_by,decided_at`
  );
  if (sAProfile2[0]?.status !== "approved") fail(`status not approved: ${sAProfile2[0]?.status}`);
  else ok(`profile.status flipped to approved (decided_by ${sAProfile2[0]?.decided_by === admin.id ? "matches admin ✓" : "MISMATCH"})`);

  const sAMembership = await restGet<Array<{ role: string }>>(
    `practice_users?user_id=eq.${sA.id}&practice_id=eq.${fb.practice_id}&select=role`
  );
  if (sAMembership[0]?.role !== "staff") fail(`membership role: ${sAMembership[0]?.role}`);
  else ok(`practice_users row created with role=staff`);

  const sANotifs = await restGet<Array<{ title: string; link: string }>>(
    `notifications?user_id=eq.${sA.id}&kind=eq.request.approved&select=title,link`
  );
  if (sANotifs.length === 0) fail(`Standard-A did not receive approval notification`);
  else ok(`Standard-A notified "${sANotifs[0]?.title}" → ${sANotifs[0]?.link}`);

  step(4.5, "Approved Standard-A loads /app");
  const sANewCookie = cookieFor(await signIn(sAEmail, PASS));
  const appRes = await appGet(`/app`, sANewCookie);
  if (appRes.status === 200) ok(`GET /app → 200 (sees DashboardEmployee)`);
  else if (appRes.status === 307) fail(`GET /app → 307 redirect. Location: ${appRes.headers.get("location")}`);
  else fail(`GET /app → unexpected ${appRes.status}`);

  // ── 5. Standard-B + deny ──────────────────────────────────────────────
  step(5, "Standard-B submits, admin denies with reason");
  const sBEmail = `standard-b-${Date.now()}@flow-test.local`;
  const sB = await adminCreate(sBEmail, PASS, "employee");
  tracker.users.push(sB.id);
  const sBCookie = cookieFor(await signIn(sBEmail, PASS));

  await appPost("/api/onboarding/employee", employeeSubmitBody(PRACTICE_NAME, "John Imposter", "Janitor", "Fake Admin"), sBCookie);

  const denyRes = await appPost(`/api/team/requests/${sB.id}`, { action: "deny", denial_reason: "We don't recognize you on our team." }, adminCookie);
  const denB = (await denyRes.json()) as { ok?: boolean; status?: string };
  if (!denyRes.ok || denB.status !== "denied") fail(`deny: ${denyRes.status} ${JSON.stringify(denB)}`);
  else ok(`deny → ${denB.status}`);

  const sBProfile = await restGet<Array<{ status: string; denial_reason: string | null }>>(
    `user_profiles?user_id=eq.${sB.id}&select=status,denial_reason`
  );
  if (sBProfile[0]?.status !== "denied") fail(`status not denied: ${sBProfile[0]?.status}`);
  else ok(`profile.status = denied, reason recorded`);
  if (sBProfile[0]?.denial_reason !== "We don't recognize you on our team.") fail(`reason mismatch`);

  const sBNotifs = await restGet<Array<{ title: string; link: string }>>(
    `notifications?user_id=eq.${sB.id}&kind=eq.request.denied&select=title,link`
  );
  if (sBNotifs.length === 0) fail(`Standard-B did not receive denial notification`);
  else ok(`Standard-B notified "${sBNotifs[0]?.title}" → ${sBNotifs[0]?.link}`);

  const sBNewCookie = cookieFor(await signIn(sBEmail, PASS));
  const sBAppRes = await appGet(`/app`, sBNewCookie);
  if (sBAppRes.status === 307 && sBAppRes.headers.get("location")?.includes("/denied")) {
    ok(`denied Standard-B hits /app → redirects to /denied`);
  } else fail(`denied user routing: ${sBAppRes.status} → ${sBAppRes.headers.get("location")}`);

  // ── 6. Standard-C unmatched ───────────────────────────────────────────
  step(6, "Standard-C submits non-matching practice name");
  const sCEmail = `standard-c-${Date.now()}@flow-test.local`;
  const sC = await adminCreate(sCEmail, PASS, "employee");
  tracker.users.push(sC.id);
  const sCCookie = cookieFor(await signIn(sCEmail, PASS));

  const sCRes = await appPost(
    "/api/onboarding/employee",
    employeeSubmitBody("Nonexistent Practice " + Date.now(), "Jane NoMatch", "Tech", "Anyone"),
    sCCookie,
  );
  const sCB = (await sCRes.json()) as { matched?: boolean };
  if (sCB.matched !== false) fail(`expected matched=false, got ${sCB.matched}`);
  else ok(`unmatched submission stored (matched=false)`);

  const sCProfile = await restGet<Array<{ status: string; matched_practice_id: string | null }>>(
    `user_profiles?user_id=eq.${sC.id}&select=status,matched_practice_id`
  );
  if (sCProfile[0]?.status !== "pending") fail(`status: ${sCProfile[0]?.status}`);
  if (sCProfile[0]?.matched_practice_id !== null) fail(`matched_practice_id should be null`);
  else ok(`profile.status = pending, matched_practice_id = null`);

  const sCNewCookie = cookieFor(await signIn(sCEmail, PASS));
  const sCAppRes = await appGet(`/app`, sCNewCookie);
  if (sCAppRes.status === 307 && sCAppRes.headers.get("location")?.includes("/pending")) {
    ok(`unmatched Standard-C hits /app → redirects to /pending`);
  } else fail(`unmatched user routing: ${sCAppRes.status} → ${sCAppRes.headers.get("location")}`);

  // ── 7. Notifications API ──────────────────────────────────────────────
  step(7, "Notifications API as admin (GET + mark all read)");
  const adminNotifResG = await appGet(`/api/notifications`, adminCookie);
  const notifData = (await adminNotifResG.json()) as { items: unknown[]; unread: number; error?: string };
  if (!adminNotifResG.ok) fail(`notifications GET: ${adminNotifResG.status} ${JSON.stringify(notifData)}`);
  else ok(`GET /api/notifications → ${notifData.items.length} items, ${notifData.unread} unread`);

  const markRes = await appPost(`/api/notifications`, { mark_all_read: true }, adminCookie);
  if (!markRes.ok) fail(`mark all read failed`);
  else {
    const re = await appGet(`/api/notifications`, adminCookie);
    const reD = (await re.json()) as { unread: number };
    if (reD.unread === 0) ok(`mark_all_read → unread now 0`);
    else fail(`unread after mark: ${reD.unread}`);
  }

  step(8, "Cleanup");
  await tracker.cleanup();
  ok(`practice + ${tracker.users.length} users deleted`);

  console.log(`\n${process.exitCode ? C.r + "━━ TEST FAILED ━━" : C.g + "━━ ALL FLOWS PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  await tracker.cleanup();
});
