import test from "node:test";
import assert from "node:assert/strict";
import { mutationBodyLimit } from "../app/lib/mutationLimits.ts";

test("normalized center logos can be saved without opening large payloads for unrelated actions", () => {
  const logo = "A".repeat(40000);
  const organization = { action: "organization_save", name: "Учебный центр", logo };
  const request = JSON.stringify({ action: "platform", data: organization });
  assert.ok(request.length > 16000);
  assert.ok(request.length <= mutationBodyLimit("platform", organization));
  assert.equal(mutationBodyLimit("save_profile", {}), 225000);
  for (const [action, data] of [["platform", { action: "student_profile", logo }], ["platform", null], ["message", organization], ["organization_save", organization], ["platform", []]]) {
    assert.equal(mutationBodyLimit(action, data), 16000);
  }
  assert.ok(JSON.stringify({ action: "platform", data: { ...organization, logo: "A".repeat(226000) } }).length > mutationBodyLimit("platform", organization));
});
