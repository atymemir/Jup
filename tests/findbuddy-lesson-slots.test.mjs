import test from "node:test";
import assert from "node:assert/strict";
import { lessonClock, lessonSlotDays } from "../app/lib/lessonSlots.ts";

test("lesson choices group by Kazakhstan's day and preserve chronological order across midnight", () => {
  const slots = [
    { id: "later", starts_at: "2026-11-24T00:00:00Z", price: 7000 },
    { id: "midnight", starts_at: "2026-11-23T19:15:00Z", price: 0 },
    { id: "invalid", starts_at: "invalid", price: 5000 },
    { id: "evening", starts_at: "2026-11-23T18:00:00Z", price: 5000 },
  ];
  const groups = lessonSlotDays(slots);
  assert.deepEqual(groups.map((g) => [g.key, g.slots.map((s) => s.id)]), [
    ["2026-11-23", ["evening"]], ["2026-11-24", ["midnight", "later"]],
  ]);
  assert.equal(groups[1].slots[0].price, 0);
  assert.equal(lessonClock(slots[1].starts_at), "00:15");
  assert.equal(lessonClock("invalid"), "Время уточняется");
  assert.deepEqual(slots.map((s) => s.id), ["later", "midnight", "invalid", "evening"]);
});
