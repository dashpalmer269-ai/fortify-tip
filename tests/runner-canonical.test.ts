import { describe, expect, it } from "vitest";
import { stateHash } from "@/lib/compliance/runner";

describe("evidence state hash", () => {
  it("is deterministic for equal-but-reordered objects", () => {
    const a = stateHash({ mfa: true, users: 10, scope: ["admin", "user"] });
    const b = stateHash({ users: 10, scope: ["admin", "user"], mfa: true });
    expect(a).toBe(b);
  });

  it("treats array order as significant", () => {
    const a = stateHash({ scope: ["admin", "user"] });
    const b = stateHash({ scope: ["user", "admin"] });
    expect(a).not.toBe(b);
  });

  it("distinguishes nested keys", () => {
    const a = stateHash({ outer: { inner: 1 } });
    const b = stateHash({ outer: { inner: 2 } });
    expect(a).not.toBe(b);
  });

  it("handles null/undefined / scalars consistently", () => {
    expect(stateHash(null)).toBe(stateHash(null));
    expect(stateHash(0)).not.toBe(stateHash(null));
    expect(stateHash("")).not.toBe(stateHash(null));
  });
});
