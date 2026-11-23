import { MongoClient } from "mongodb";
import { connectWithRetry } from "../mongo-connection.js";
import { config } from "../config/env.js";

export async function connectDatabase() {
  const mongo = await connectWithRetry(() => new MongoClient(process.env.MONGODB_URI, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 }));
  const database = mongo.db(process.env.MONGODB_DB || "navyug_star");
  const submissions = Object.fromEntries([...config.allowedKinds].map((kind) => [kind, database.collection(`${kind}Submissions`)]));
  for (const collection of Object.values(submissions)) await collection.createIndex({ createdAt: -1 });
  return { mongo, database, submissions, content: database.collection("siteContent"), allowedKinds: config.allowedKinds, allowedStatuses: config.allowedStatuses };
}
