import test from "node:test";
import assert from "node:assert/strict";
import {
  encodePortrait,
  PORTRAIT_MAX_BYTES,
  portraitDimensions,
} from "../app/lib/portrait.mjs";
import { scheduleNotification } from "../app/server/notificationDelivery.mjs";

test("clear portrait encoding preserves high resolution while respecting the deployed upload limit", async () => {
  const requested = [];
  const result = await encodePortrait(3000, 4500, async (size, quality) => {
    requested.push(size);
    assert.ok(quality >= 0.74);
    return new Blob(
      [new Uint8Array(Math.ceil(size.width * size.height * 0.075))],
      { type: "image/jpeg" },
    );
  });
  assert.ok(result.size <= PORTRAIT_MAX_BYTES);
  assert.ok(requested.at(-1).height >= 1024);
  assert.ok(
    Math.abs(requested.at(-1).width / requested.at(-1).height - 2 / 3) < 0.002,
  );
});

test("complex photos shrink progressively rather than exceeding the database limit", async () => {
  const sizes = [];
  const photo = await encodePortrait(4000, 4000, async (size, quality) => {
    sizes.push(size.width);
    return new Blob(
      [new Uint8Array(Math.ceil(size.width * size.height * quality * 0.3))],
      { type: "image/jpeg" },
    );
  });
  assert.ok(photo.size <= PORTRAIT_MAX_BYTES);
  assert.ok(sizes.at(-1) > 384);
  assert.ok(new Set(sizes).size > 1);
});

test("small originals are not enlarged and failed encoders terminate", async () => {
  await encodePortrait(300, 150, async (size) => {
    assert.deepEqual(size, { width: 300, height: 150 });
    return new Blob([new Uint8Array(1000)], { type: "image/jpeg" });
  });
  await assert.rejects(
    () =>
      encodePortrait(
        700,
        1000,
        async () => new Blob([new Uint8Array(160001)], { type: "image/jpeg" }),
      ),
    /upload limit/,
  );
  await assert.rejects(
    () =>
      encodePortrait(
        20,
        20,
        async () => new Blob([new Uint8Array(1000)], { type: "image/png" }),
      ),
    /upload limit/,
  );
  assert.throws(() => portraitDimensions(0, 1));
});

test("notifications run after scheduling, without blocking a successful mutation response", async () => {
  let work,
    notified = false;
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  scheduleNotification(
    (callback) => {
      work = callback;
    },
    async () => {
      await pending;
      notified = true;
    },
  );
  assert.equal(notified, false);
  const response = Response.json({ id: "saved-booking" });
  assert.equal((await response.json()).id, "saved-booking");
  const delivery = work();
  assert.equal(notified, false);
  finish();
  await delivery;
  assert.equal(notified, true);
});

test("delivery and scheduling failures are reported without retrying or failing an already saved action", async () => {
  let work,
    errors = 0,
    calls = 0;
  scheduleNotification(
    (callback) => {
      work = callback;
    },
    async () => {
      calls++;
      throw Error("offline");
    },
    () => {
      errors++;
    },
  );
  await work();
  assert.equal(errors, 1);
  assert.equal(calls, 1);
  scheduleNotification(
    () => {
      throw Error("request ended");
    },
    async () => {
      calls++;
    },
    () => {
      errors++;
    },
  );
  assert.equal(errors, 2);
  assert.equal(calls, 1);
});
