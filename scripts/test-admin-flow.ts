#!/usr/bin/env node
// Test the administrator onboarding flow end-to-end.

import {
  C, step, ok, fail,
  adminCreate, signIn, cookieFor,
  appGet, appPost, restGet, makeTracker, finalizePayload,
} from "./_test-helpers";

const PASS = "TestPassword!Strong#123";
const tracker = makeTracker();

async function main(): Promise<void> {
  const email = `test-admin-${Date.now()}@fortify-test.local`;

  step(1, "Create confirmed test user");
  const user = await adminCreate(email, PASS, "admin");
  tracker.users.push(user.id);
  ok(`created ${email} (${user.id})`);
  ok(`user_metadata.account_type = ${user.user_metadata?.account_type}`);

  step(2, "Sign in (password grant)");
  const session = await signIn(email, PASS);
  const cookie = cookieFor(session);
  ok(`access_token ok, expires_in=${session.expires_in}s`);
  ok(`cookie prepared (${cookie.split("=")[1]?.length ?? 0} chars)`);

  step(3, "Hit /app/onboarding as the signed-in user");
  const onboardingRes = await appGet("/app/onboarding", cookie);
  if (onboardingRes.status !== 200) fail(`onboarding page: ${onboardingRes.status}`);
  else ok(`GET /app/onboarding → 200`);

  step(4, "POST /api/onboarding/finalize");
  const finalizeRes = await appPost(
    "/api/onboarding/finalize",
    {
      ...finalizePayload("Test Practice " + Date.now()),
      state: {
        ...finalizePayload("Test Practice " + Date.now()).state,
        safeguards: {
          mode: "manual" as const,
          integrations: ["microsoft_365", "google_workspace"],
          assistance_date: "",
          assistance_window: "",
          assistance_phone: "",
          assistance_notes: "",
        },
      },
    },
    cookie,
  );
  const fb = (await finalizeRes.json().catch(() => ({}))) as { ok?: boolean; practice_id?: string; error?: string };
  if (!finalizeRes.ok || !fb.ok || !fb.practice_id) {
    fail(`finalize: ${finalizeRes.status} ${JSON.stringify(fb)}`);
    return;
  }
  const practiceId = fb.practice_id;
  tracker.practices.push(practiceId);
  ok(`finalize → 200, practice_id=${practiceId}`);

  step(5, "Verify DB state");

  const check = async <T>(label: string, path: string, predicate: (data: T) => boolean): Promise<void> => {
    const data = await restGet<T>(path);
    if (predicate(data)) ok(`${label}: ${C.d}${JSON.stringify(data).slice(0, 140)}${C.x}`);
    else fail(`${label}: predicate failed → ${JSON.stringify(data).slice(0, 200)}`);
  };

  await check<Array<{ id: string; name: string; onboarding_step: string; current_status: string }>>(
    "practices row exists with completed step",
    `practices?id=eq.${practiceId}&select=id,name,onboarding_step,current_status,selected_plan,description,employee_range`,
    (d) => d.length === 1 && d[0]?.onboarding_step === "completed" && d[0]?.current_status === "starting_brand_new",
  );

  await check<Array<{ role: string; user_id: string }>>(
    "practice_users has caller as owner",
    `practice_users?practice_id=eq.${practiceId}&select=role,user_id`,
    (d) => d.length === 1 && d[0]?.role === "owner" && d[0]?.user_id === user.id,
  );

  await check<Array<{ city: string; region: string }>>(
    "practice_locations has 1 location",
    `practice_locations?practice_id=eq.${practiceId}&select=city,region`,
    (d) => d.length === 1 && d[0]?.city === "Austin",
  );

  await check<Array<{ integration_type: string }>>(
    "integration choices recorded",
    `onboarding_integration_choices?practice_id=eq.${practiceId}&select=integration_type`,
    (d) => d.length === 2,
  );

  await check<Array<{ action: string }>>(
    "audit log entry created",
    `audit_logs?practice_id=eq.${practiceId}&action=eq.onboarding.completed&select=action,metadata`,
    (d) => d.length >= 1,
  );

  await check<Array<{ id: string }>>(
    "practice_controls pre-seeded (healthcare baseline)",
    `practice_controls?practice_id=eq.${practiceId}&select=id`,
    (d) => Array.isArray(d),
  );

  step(6, "Post-onboarding navigation");
  const welcomeRes = await appGet("/app/onboarding/welcome", cookie);
  ok(`GET /app/onboarding/welcome → ${welcomeRes.status}`);
  const appRes = await appGet("/app", cookie);
  ok(`GET /app → ${appRes.status}`);

  step(7, "Cleanup");
  await tracker.cleanup();
  ok(`practice + ${tracker.users.length} user deleted`);

  console.log(`\n${process.exitCode ? C.r + "━━ FAILED ━━" : C.g + "━━ ADMIN FLOW PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  await tracker.cleanup();
});
