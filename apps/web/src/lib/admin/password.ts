// Also imported by scripts/seed-admins.mjs, so this file stays plain enough for Node
// to run directly: no path aliases, and only type syntax Node can strip.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLEL = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, cost: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: cost, r, p, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLEL);
  return ["scrypt", COST, BLOCK_SIZE, PARALLEL, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(cost), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A temporary password, shown once. The account must change it at first sign-in. */
export function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}
