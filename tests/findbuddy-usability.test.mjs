import test from "node:test";
import assert from "node:assert/strict";
import { portraitDimensions } from "../app/lib/portrait.mjs";
import { sharedRequest } from "../app/lib/requestPool.mjs";
import { filterModeration } from "../app/lib/moderation.mjs";

test("portrait normalization keeps the complete aspect ratio and never enlarges a small original", () => {
  for (const [width, height] of [
    [450, 1200],
    [1600, 900],
    [40, 60],
    [300, 150],
  ]) {
    const size = portraitDimensions(width, height);
    assert.ok(size.width <= width && size.height <= height);
    assert.ok(Math.max(size.width, size.height) <= 1536);
    assert.ok(Math.abs(size.width / size.height - width / height) < 0.01);
  }
  assert.deepEqual(portraitDimensions(300, 150), { width: 300, height: 150 });
  assert.equal(portraitDimensions(3000, 4500).height, 1536);
  for (const [width, height] of [
    [0, 20],
    [20, -1],
    [NaN, 2],
    [Infinity, 5],
  ])
    assert.throws(() => portraitDimensions(width, height));
});

test("concurrent reads share work, remain isolated by identity and are never cached after completion", async () => {
  let count = 0;
  let resolve;
  const request = () => {
    count++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const first = sharedRequest("dashboard:user-a", request);
  const second = sharedRequest("dashboard:user-a", request);
  assert.equal(first, second);
  assert.deepEqual(
    await sharedRequest("dashboard:user-b", async () => ({ owner: "b" })),
    { owner: "b" },
  );
  resolve({ owner: "a" });
  assert.deepEqual(await first, { owner: "a" });
  assert.deepEqual(await second, { owner: "a" });
  assert.equal(count, 1);
  assert.deepEqual(
    await sharedRequest("dashboard:user-a", async () => ({ updated: true })),
    { updated: true },
  );
});

test("a failed shared read can be retried", async () => {
  const first = sharedRequest("failure", async () => {
    throw new Error("offline");
  });
  const second = sharedRequest("failure", async () => "should not run");
  await assert.rejects(first, /offline/);
  await assert.rejects(second, /offline/);
  assert.equal(await sharedRequest("failure", async () => "online"), "online");
});

test("moderation searches the visible profile type, including hidden centres and empty filters", () => {
  const teachers = [
    { id: "t1", display_name: "Алия", verification: "pending" },
  ];
  const centres = [
    { id: "o1", name: "Study", city: "Алматы", status: "hidden" },
  ];
  assert.equal(filterModeration(teachers, "pending", "АЛИЯ").length, 1);
  assert.equal(filterModeration(centres, "pending").length, 0);
  assert.equal(filterModeration(centres, "hidden", " алматы ").length, 1);
  assert.equal(filterModeration([...teachers, ...centres], "all").length, 2);
  assert.equal(filterModeration(centres, "all", "Нет такого").length, 0);
});
