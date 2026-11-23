import { config, validateEnvironment } from "./config/env.js";
import { connectDatabase } from "./models/database.js";
import { createApp } from "./app.js";
import { getMongoStartupHint } from "./mongo-connection.js";
try { validateEnvironment(); } catch (error) { console.error(error.message); process.exit(1); }
let context;
try { context = await connectDatabase(); } catch (error) { console.error(getMongoStartupHint(error)); process.exit(1); }
const server = createApp(context);
server.headersTimeout = 15000; server.requestTimeout = 30000; server.keepAliveTimeout = 5000;
server.listen(config.port, () => console.log(`NavYug API listening on http://localhost:${config.port}`));
let closing = false;
async function shutdown(signal) { if (closing) return; closing = true; console.log(`Received ${signal}; shutting down the API.`); await new Promise((resolve) => server.close(resolve)); await context.mongo.close(); }
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => shutdown(signal).catch((e) => { console.error("API shutdown failed:", e); process.exitCode = 1; }));
server.on("error", (error) => { console.error(`API server error (${error.code || error.name}). Check API_PORT ${config.port}.`); process.exitCode = 1; void shutdown("server error"); });
