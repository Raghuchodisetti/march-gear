import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export type Database = MySql2Database<typeof schema>;

// One pool per server instance; reused across hot reloads in dev.
const globalForDb = globalThis as unknown as { mgPool?: mysql.Pool; mgDb?: Database };

function createPool() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is not set — add it to .env.local (see README › Backend).");
  const pool = mysql.createPool({
    uri,
    connectionLimit: process.env.VERCEL ? 5 : 10,
    waitForConnections: true,
    // Hosted MySQL providers usually require TLS; local XAMPP does not.
    ssl: /sslaccept=strict|ssl=true|ssl-mode=required/i.test(uri) ? { rejectUnauthorized: true } : undefined,
  });
  // Store and read timestamps in UTC, whatever the server's own time zone.
  pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export function getDb(): Database {
  if (!globalForDb.mgDb) {
    globalForDb.mgPool ??= createPool();
    globalForDb.mgDb = drizzle({ client: globalForDb.mgPool, schema, mode: "default" });
  }
  return globalForDb.mgDb;
}

/** Closes the pool — for scripts only. */
export async function closeDb() {
  await globalForDb.mgPool?.end();
  globalForDb.mgPool = undefined;
  globalForDb.mgDb = undefined;
}

export { schema };
