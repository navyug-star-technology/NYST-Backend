import assert from "node:assert/strict";
import { test } from "node:test";
import { connectWithRetry, getMongoStartupHint } from "../mongo-connection.js";

test("connects without retry when MongoDB is available", async () => {
  let connectCalls = 0;
  const client = await connectWithRetry(() => ({
    async connect() {
      connectCalls += 1;
    },
  }));
  assert.equal(connectCalls, 1);
  assert.ok(client);
});

test("retries transient DNS failures with capped exponential delays", async () => {
  let connectCalls = 0;
  const delays = [];
  await connectWithRetry(
    () => ({
      async connect() {
        connectCalls += 1;
        if (connectCalls < 4) {
          throw Object.assign(new Error("DNS request refused"), {
            code: "ECONNREFUSED",
            syscall: "querySrv",
          });
        }
      },
      async close() {},
    }),
    {
      attempts: 4,
      initialDelayMs: 1000,
      maxDelayMs: 2500,
      delay: async (milliseconds) => delays.push(milliseconds),
      logger: { warn() {} },
    },
  );

  assert.equal(connectCalls, 4);
  assert.deepEqual(delays, [1000, 2000, 2500]);
});

test("does not retry non-transient authentication failures", async () => {
  const error = Object.assign(new Error("Authentication failed"), {
    code: 18,
    codeName: "AuthenticationFailed",
  });
  let connectCalls = 0;

  await assert.rejects(
    connectWithRetry(
      () => ({
        async connect() {
          connectCalls += 1;
          throw error;
        },
        async close() {},
      }),
      {
        delay: async () =>
          assert.fail("authentication errors must not be retried"),
      },
    ),
    error,
  );
  assert.equal(connectCalls, 1);
  assert.match(getMongoStartupHint(error), /database username and password/);
});

test("explains an SRV DNS refusal without exposing the connection string", () => {
  const error = Object.assign(new Error("querySrv refused"), {
    code: "ECONNREFUSED",
    syscall: "querySrv",
  });

  assert.match(getMongoStartupHint(error), /SRV DNS lookup was refused/);
  assert.doesNotMatch(getMongoStartupHint(error), /mongodb\+srv:/);
});

test("explains Atlas error 8000 without exposing credentials", () => {
  const error = Object.assign(new Error("Atlas authentication error"), {
    code: 8000,
    codeName: "AtlasError",
  });

  assert.match(
    getMongoStartupHint(error),
    /Database Access username\/password/,
  );
  assert.match(getMongoStartupHint(error), /percent-encode special characters/);
  assert.doesNotMatch(getMongoStartupHint(error), /mongodb\+srv:/);
});
