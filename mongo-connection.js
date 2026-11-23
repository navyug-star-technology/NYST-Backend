const retryableCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

function getErrorChain(error) {
  const chain = [];
  const seen = new Set();
  for (
    let current = error;
    current && !seen.has(current);
    current = current.cause
  ) {
    chain.push(current);
    seen.add(current);
  }
  return chain;
}

function getErrorCode(error) {
  return getErrorChain(error).find((item) => item.code)?.code;
}

function isRetryable(error) {
  return getErrorChain(error).some(
    (item) =>
      retryableCodes.has(item.code) ||
      item.syscall === "querySrv" ||
      item.name === "MongoServerSelectionError",
  );
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function connectWithRetry(createClient, options = {}) {
  const attempts = options.attempts ?? 4;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const delay = options.delay ?? wait;
  const logger = options.logger ?? console;

  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError(
      "MongoDB connection attempts must be a positive integer.",
    );
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let client;
    try {
      client = createClient();
      await client.connect();
      return client;
    } catch (error) {
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          logger.warn(
            `Could not close the failed MongoDB client (${closeError.name}).`,
          );
        }
      }
      if (!isRetryable(error) || attempt === attempts) throw error;

      const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      logger.warn(
        `MongoDB connection attempt ${attempt}/${attempts} failed (${getErrorCode(error) || error.name}); retrying in ${delayMs} ms.`,
      );
      await delay(delayMs);
    }
  }
}

export function getMongoStartupHint(error) {
  const chain = getErrorChain(error);
  const code = getErrorCode(error);

  if (chain.some((item) => item.syscall === "querySrv")) {
    return "MongoDB SRV DNS lookup was refused. Check that the Node.js DNS resolver and current network allow DNS SRV queries, then verify the cluster hostname in MONGODB_URI.";
  }
  if (
    chain.some(
      (item) => item.codeName === "AuthenticationFailed" || item.code === 18,
    )
  ) {
    return "MongoDB authentication failed. Verify the database username and password in MONGODB_URI.";
  }
  if (code === 8000 || chain.some((item) => item.codeName === "AtlasError")) {
    return "MongoDB Atlas rejected the connection (code 8000). Verify the MongoDB Database Access username/password, percent-encode special characters in the password inside MONGODB_URI, and confirm the current public IP is in Atlas Network Access.";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `MongoDB hostname could not be resolved (${code}). Verify MONGODB_URI and the network DNS settings.`;
  }
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET"
  ) {
    return `MongoDB server connection failed (${code}). Check that the cluster is active and this machine is allowed in MongoDB Atlas Network Access.`;
  }

  return `MongoDB startup failed (${code || error.name || "unknown error"}). Verify MONGODB_URI, the cluster status, and the database user's permissions.`;
}
