import test from "node:test";
import assert from "node:assert/strict";
import { portraitBounds } from "../app/lib/portrait.mjs";
import { sharedRequest } from "../app/lib/requestPool.mjs";
import { filterModeration } from "../app/lib/moderation.mjs";

test("square, portrait and landscape uploads keep every edge inside the thumbnail", () => {
  assert.deepEqual(portraitBounds(400, 400), {
    x: 0,
    y: 0,
    width: 384,
    height: 384,
  });
  assert.deepEqual(portraitBounds(400, 800), {
    x: 96,
    y: 0,
    width: 192,
    height: 384,
  });
  assert.deepEqual(portraitBounds(800, 400), {
    x: 0,
    y: 96,
    width: 384,
    height: 192,
  });
  for (const [width, height] of [
    [450, 1200],
    [1600, 900],
    [40, 60],
    [61, 500],
  ]) {
    const bounds = portraitBounds(width, height);
    assert.ok(bounds.x >= 0 && bounds.y >= 0);
    assert.ok(
      bounds.x + bounds.width <= 384 && bounds.y + bounds.height <= 384,
    );
    assert.ok(Math.abs(bounds.width / bounds.height - width / height) < 1e-10);
  }
  for (const dimensions of [
    [0, 20],
    [20, -1],
    [NaN, 2],
    [Infinity, 5],
  ])
    assert.throws(() => portraitBounds(...dimensions));
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
