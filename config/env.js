import { setServers } from "node:dns";

export const config = {
  port: Number(process.env.API_PORT || 3001),
  sessionDurationMs: 8 * 60 * 60 * 1000,
  bodyLimitBytes: 64 * 1024,
  allowedKinds: new Set(["visitor", "question", "project"]),
  allowedStatuses: new Set(["new", "contacted", "resolved"]),
  frontendOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:5173").split(",").map((x) => x.trim()).filter(Boolean),
};

export function validateEnvironment() {
  if (!Number.isInteger(config.port) || config.port < 0 || config.port > 65535) throw new Error("API_PORT must be an integer between 0 and 65535.");
  for (const name of ["MONGODB_URI", "ADMIN_EMAIL", "ADMIN_PASSWORD", "SESSION_SECRET"]) if (!process.env[name]?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  if (process.env.ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  if (process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const dns = (process.env.MONGODB_DNS_SERVERS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (dns.length) setServers(dns);
}
