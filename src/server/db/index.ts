import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be a Neon postgres connection string");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Increase connection limits for better performance
  max: 20, // Maximum pool size
  // Reduce connection timeouts
  connectionTimeoutMillis: 5000, // 5 seconds
  idleTimeoutMillis: 30000, // 30 seconds
  // Add query timeout
  query_timeout: 15000, // 15 seconds per query
});

export const db = drizzle(pool, { schema });
