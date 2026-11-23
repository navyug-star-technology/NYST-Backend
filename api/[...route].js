
import { createApp } from "../app.js";
import { connectDatabase } from "../models/database.js";
import { validateEnvironment } from "../config/env.js";

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      validateEnvironment();

      const context = await connectDatabase();

      const server = createApp(context);

      const requestHandler =
        server.listeners("request")[0];

      return {
        server,
        requestHandler,
      };
    })().catch((error) => {
      appPromise = undefined;
      throw error;
    });
  }

  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();

    return await app.requestHandler(req, res);
  } catch (error) {
    console.error("Vercel API initialization failed:", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");

      res.end(
        JSON.stringify({
          error: "Backend initialization failed.",
        })
      );
    }
  }
}
