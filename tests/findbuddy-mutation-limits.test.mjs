import test from "node:test";
import assert from "node:assert/strict";
import { mutationBodyLimit } from "../app/lib/mutationLimits.ts";

test("normalized center logos can be saved without opening large payloads for unrelated actions", () => {
  const logo = "A".repeat(40000);
  const organization = {
    action: "organization_save",
    name: "Учебный центр",
    logo,
  };
  const request = JSON.stringify({ action: "platform", data: organization });
  assert.ok(request.length > 16000);
  assert.ok(request.length <= mutationBodyLimit("platform", organization));
  assert.equal(mutationBodyLimit("save_profile", {}), 300000);
  for (const [action, data] of [
    ["platform", { action: "student_profile", logo }],
    ["platform", null],
    ["message", organization],
    ["organization_save", organization],
    ["platform", []],
  ]) {
    assert.equal(mutationBodyLimit(action, data), 16000);
  }
  assert.ok(
    JSON.stringify({
      action: "platform",
      data: { ...organization, logo: "A".repeat(226000) },
    }).length > mutationBodyLimit("platform", organization),
  );
});

test("a bounded portrait and complete Unicode qualifications fit without enlarging unrelated requests", () => {
  const text = "学".repeat(180);
  const request = JSON.stringify({
    action: "save_profile",
    data: {
      photo: "A".repeat(213336),
      bio: "学".repeat(1500),
      lesson_plan: "学".repeat(600),
      education_entries: Array.from({ length: 8 }, () => ({
        institution: text,
        degree: text,
        field: text,
        year: "2025",
        status: "completed",
      })),
      certificates: Array.from({ length: 8 }, () => ({
        name: text,
        issuer: text,
        result: text,
        year: "2025",
      })),
    },
  });
  assert.ok(Buffer.byteLength(request) > 225000);
  assert.ok(
    Buffer.byteLength(request) <= mutationBodyLimit("save_profile", {}),
  );
  assert.ok(Buffer.byteLength(request) > mutationBodyLimit("message", {}));
});
