import { z } from "zod";

import { generatePassword, hashPassword } from "@/lib/admin/password";
import { bareHost, slugFromBase } from "@/lib/brand-site";

import {
  AdminError,
  emailSchema,
  isDuplicate,
  nameSchema,
  parse,
  type Admin,
  type Db,
} from "./admin/accounts";

/** The original brand. The public site shows its content. Also in db/schema.sql and the seeds. */
export const DEFAULT_BRAND_ID = "00000000-0000-4000-8000-000000000001";

export type Brand = {
  id: string;
  name: string;
  domain: string | null;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  about: string | null;
  accentColor: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
};

const COLUMNS = `id, name, domain, slug, logo_url AS "logoUrl", tagline, about, accent_color AS "accentColor",
  contact_email AS "contactEmail", contact_phone AS "contactPhone", whatsapp_phone AS "whatsappPhone"`;
const brandNameSchema = z.string().trim().min(2, "Enter a brand name.").max(100);

/** Accepts what people paste, such as a full link with www and a path, and keeps example.com. */
export function normalizeDomain(input: unknown): string | null {
  const host = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
  if (!host) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    throw new AdminError("Enter a domain like example.com.");
  }
  if (host.endsWith(".vercel.app")) throw new AdminError("Use the brand's own domain, not a vercel.app address.");
  return host;
}

function slugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "brand";
}

function requireSuperadmin(actor: Admin): void {
  if (actor.role !== "superadmin") throw new AdminError("Only the SuperAdmin can do that.");
}

/** Everything for the SuperAdmin, and just their own for anyone else. */
export async function listBrands(db: Db, actor: Admin): Promise<Brand[]> {
  if (actor.role === "superadmin") {
    return db.query<Brand>(`SELECT ${COLUMNS} FROM brands ORDER BY created_at ASC`);
  }
  return db.query<Brand>(`SELECT ${COLUMNS} FROM brands WHERE id = $1`, [actor.brandId]);
}

/**
 * The brand and its first admin arrive together, in one statement, so a brand can't be left
 * with nobody to run it if the email turns out to be taken.
 */
export async function createBrand(
  db: Db,
  actor: Admin,
  input: { name: unknown; domain: unknown; adminName: unknown; adminEmail: unknown },
) {
  requireSuperadmin(actor);
  const name = parse(brandNameSchema, input.name);
  const domain = normalizeDomain(input.domain);
  const adminName = parse(nameSchema, input.adminName);
  const adminEmail = parse(emailSchema, input.adminEmail);
  const temporaryPassword = generatePassword();
  try {
    const [brand] = await db.query<Brand>(
      `WITH brand AS (
         INSERT INTO brands (name, domain, created_by, slug) VALUES ($1, $2, $3::uuid, $7) RETURNING ${COLUMNS}
       ), admin AS (
         INSERT INTO admins (email, name, role, password_hash, must_change_password, brand_id, created_by)
         SELECT $4, $5, 'admin', $6, true, brand.id, $3::uuid FROM brand
       )
       SELECT * FROM brand`,
      [name, domain, actor.id, adminEmail, adminName, await hashPassword(temporaryPassword), slugFromName(name)],
    );
    return { brand, adminEmail, temporaryPassword };
  } catch (error) {
    if (isDuplicate(error)) throw new AdminError("That brand name, domain or admin email is already in use.");
    throw error;
  }
}

export async function updateBrand(
  db: Db,
  actor: Admin,
  id: string,
  input: { name: unknown; domain: unknown },
): Promise<void> {
  requireSuperadmin(actor);
  if (!z.uuid().safeParse(id).success) throw new AdminError("That brand no longer exists.");
  const name = parse(brandNameSchema, input.name);
  const domain = normalizeDomain(input.domain);
  try {
    const rows = await db.query(`UPDATE brands SET name = $1, domain = $2 WHERE id = $3 RETURNING id`, [name, domain, id]);
    if (rows.length === 0) throw new AdminError("That brand no longer exists.");
  } catch (error) {
    if (isDuplicate(error)) throw new AdminError("That brand name or domain is already in use.");
    throw error;
  }
}

// --- A brand's public site. Its admins and the SuperAdmin look after this.

const optional = (schema: z.ZodType<string>) =>
  z.union([z.literal(""), schema]).transform((value) => value || null);

const settingsSchema = z.object({
  logoUrl: optional(z.url("The logo must be a link.").refine((value) => value.startsWith("https:"), "The logo link must be secure.")),
  tagline: optional(z.string().max(160, "Keep the tagline under 160 characters.")),
  about: optional(z.string().max(2000, "Keep the description under 2000 characters.")),
  accentColor: optional(z.string().regex(/^#[0-9a-f]{6}$/, "Choose a colour.")),
  contactEmail: optional(z.email("Enter a valid contact email.").max(200)),
  contactPhone: optional(z.string().regex(/^\+?[0-9][0-9 ()-]{7,18}$/, "Enter a valid contact phone number.")),
  whatsappPhone: optional(z.string().regex(/^\+?[0-9][0-9 ()-]{7,18}$/, "Enter a valid WhatsApp number.")),
});

const SITE_BACKGROUND = [14, 26, 20];
const MIN_ACCENT_CONTRAST = 4.5;

function luminance([r, g, b]: number[]): number {
  const [red, green, blue] = [r, g, b].map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The accent is used for prices and links on a dark page, so it has to stay readable there. */
export function accentContrast(hex: string): number {
  const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const lighter = Math.max(luminance(rgb), luminance(SITE_BACKGROUND));
  const darker = Math.min(luminance(rgb), luminance(SITE_BACKGROUND));
  return (lighter + 0.05) / (darker + 0.05);
}

export async function updateBrandSettings(db: Db, actor: Admin, id: string, input: unknown): Promise<void> {
  const allowed = actor.role === "superadmin" || (actor.role === "admin" && actor.brandId === id);
  if (!allowed) throw new AdminError("You can't change that brand's site.");
  if (!z.uuid().safeParse(id).success) throw new AdminError("That brand no longer exists.");
  if (id === DEFAULT_BRAND_ID) throw new AdminError("The main site is set up separately.");
  const settings = parse(settingsSchema, input);
  if (settings.accentColor && accentContrast(settings.accentColor) < MIN_ACCENT_CONTRAST) {
    throw new AdminError("That colour is too dark to read on the site. Choose a lighter one.");
  }
  const rows = await db.query(
    `UPDATE brands SET logo_url = $2, tagline = $3, about = $4, accent_color = $5, contact_email = $6,
       contact_phone = $7, whatsapp_phone = $8 WHERE id = $1 RETURNING id`,
    [id, settings.logoUrl, settings.tagline, settings.about, settings.accentColor, settings.contactEmail,
      settings.contactPhone, settings.whatsappPhone],
  );
  if (rows.length === 0) throw new AdminError("That brand no longer exists.");
}

/** A key with a dot is a domain, and anything else a slug. */
export async function findBrandByKey(db: Db, key: string): Promise<Brand | null> {
  const column = key.includes(".") ? "domain" : "slug";
  const [brand] = await db.query<Brand>(`SELECT ${COLUMNS} FROM brands WHERE ${column} = $1`, [key]);
  return brand ?? null;
}

/** Which brand a visitor is with. Any address that isn't a brand's own is the original brand. */
export async function brandIdForHost(db: Db, host: string | null): Promise<string> {
  const [brand] = await db.query<{ id: string }>(`SELECT id FROM brands WHERE domain = $1`, [bareHost(host)]);
  return brand?.id ?? DEFAULT_BRAND_ID;
}

/** The same, for a visitor on /b/slug, where the address alone doesn't say. */
export async function brandIdForVisitor(db: Db, base: string, host: string | null): Promise<string> {
  const slug = slugFromBase(base);
  if (!slug) return brandIdForHost(db, host);
  const [brand] = await db.query<{ id: string }>(`SELECT id FROM brands WHERE slug = $1`, [slug]);
  return brand?.id ?? DEFAULT_BRAND_ID;
}

/** The brand staff are working in: always their own, and the SuperAdmin must say which. */
export async function targetBrandId(db: Db, actor: Admin, chosen: unknown): Promise<string> {
  if (actor.role !== "superadmin") {
    if (!actor.brandId) throw new AdminError("Your account isn't linked to a brand.");
    return actor.brandId;
  }
  const id = String(chosen ?? "");
  if (!z.uuid().safeParse(id).success) throw new AdminError("Choose a brand.");
  const [brand] = await db.query<{ id: string }>(`SELECT id FROM brands WHERE id = $1`, [id]);
  if (!brand) throw new AdminError("Choose a brand.");
  return brand.id;
}
