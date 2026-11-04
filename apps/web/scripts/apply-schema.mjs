// Applies db/schema.sql to the database in DATABASE_URL. Safe to run repeatedly.
//   pnpm db:apply
import { readFileSync } from "node:fs";

import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("Schema applied.");
} finally {
  await sql.end();
}
