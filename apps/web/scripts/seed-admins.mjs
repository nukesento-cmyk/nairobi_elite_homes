// Creates the first accounts: one SuperAdmin and two admins.
//   pnpm seed-admins
//
// Reads DATABASE_URL and the SEED_* emails from .env.local or the environment. Safe to run
// again: existing accounts are left alone, and passwords are never reset. A deleted admin
// whose email is still in the environment would be created again, so remove it first.
import { readFileSync } from "node:fs";

import postgres from "postgres";

import { generatePassword, hashPassword } from "../src/lib/admin/password.ts";

const accounts = [
  { role: "superadmin", email: process.env.SEED_SUPERADMIN_EMAIL, name: process.env.SEED_SUPERADMIN_NAME ?? "SuperAdmin" },
  { role: "admin", email: process.env.SEED_ADMIN_1_EMAIL, name: process.env.SEED_ADMIN_1_NAME ?? "Admin One" },
  { role: "admin", email: process.env.SEED_ADMIN_2_EMAIL, name: process.env.SEED_ADMIN_2_NAME ?? "Admin Two" },
].map((account) => ({ ...account, email: account.email?.trim().toLowerCase() }));

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!process.env.DATABASE_URL) fail("Set DATABASE_URL first.");
if (accounts.some(({ email }) => !email?.includes("@"))) {
  fail("Set SEED_SUPERADMIN_EMAIL, SEED_ADMIN_1_EMAIL and SEED_ADMIN_2_EMAIL.");
}
if (new Set(accounts.map(({ email }) => email)).size !== accounts.length) {
  fail("The three seed emails must be different.");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const created = [];

try {
  await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

  for (const { role, email, name } of accounts) {
    const [byEmail] = await sql`SELECT role FROM admins WHERE email = ${email}`;
    if (byEmail) {
      if (byEmail.role !== role) fail(`${email} already exists as ${byEmail.role}, not ${role}.`);
      console.log(`Exists, left unchanged: ${email} (${role})`);
      continue;
    }
    if (role === "superadmin") {
      const [existing] = await sql`SELECT email FROM admins WHERE role = 'superadmin'`;
      if (existing) {
        console.log(`Skipped ${email}: ${existing.email} is already the SuperAdmin.`);
        continue;
      }
    }
    const password = generatePassword();
    await sql`INSERT INTO admins (email, name, role, password_hash, must_change_password)
      VALUES (${email}, ${name}, ${role}, ${await hashPassword(password)}, true)`;
    created.push({ role, email, password });
  }
} catch (error) {
  // Never prints the connection string, which contains a password.
  fail(`Seeding failed: ${error.code ?? error.message}. Check DATABASE_URL and that the database is reachable.`);
} finally {
  await sql.end({ timeout: 1 });
}

if (created.length > 0) {
  console.log("\nCreated. These temporary passwords are shown once and never stored:\n");
  for (const { role, email, password } of created) console.log(`  ${role.padEnd(10)} ${email}  ${password}`);
  console.log("\nEach account must choose its own password at first sign-in.");
}
