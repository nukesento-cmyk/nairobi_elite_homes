-- Safe to run repeatedly. Applied by scripts/seed-admins.mjs.
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('superadmin', 'admin')),
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- There can only ever be one SuperAdmin, whatever the application does.
CREATE UNIQUE INDEX IF NOT EXISTS admins_one_superadmin ON admins (role) WHERE role = 'superadmin';

-- Deleting an admin deletes their sessions, which signs them out at once.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

-- Reviewers were added after the first version of this table.
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check CHECK (role IN ('superadmin', 'admin', 'reviewer'));

-- status decides visibility: gated listings only ever appear as locked cards.
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  vertical text NOT NULL CHECK (vertical IN ('residential', 'land', 'commercial')),
  status text NOT NULL CHECK (status IN ('public', 'off_market', 'members_only')),
  area text NOT NULL,
  price_amount numeric NOT NULL CHECK (price_amount > 0),
  price_currency text NOT NULL CHECK (price_currency IN ('KES', 'USD')),
  price_period text NOT NULL CHECK (price_period IN ('sale', 'month')),
  beds integer,
  baths integer,
  acreage numeric,
  sqm integer,
  title_status text CHECK (title_status IN ('freehold', 'leasehold')),
  zoning text,
  description text,
  features text[] NOT NULL DEFAULT '{}',
  hero_url text,
  hero_alt text,
  gallery_urls text[] NOT NULL DEFAULT '{}',
  matterport_id text,
  -- Nothing reaches the site until it's approved. Editing sends it back for approval.
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_note text,
  created_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL,
  body text NOT NULL,
  cover_url text,
  cover_alt text,
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'pending', 'approved', 'rejected')),
  review_note text,
  published_at timestamptz,
  created_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Buyers sign in with Google. They're kept apart from staff, and hold no staff rights.
CREATE TABLE IF NOT EXISTS buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_sessions (
  token_hash text PRIMARY KEY,
  buyer_id uuid NOT NULL REFERENCES buyers (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

-- People asking an admin for the private community's link.
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'link_sent', 'declined')),
  handled_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Brands. Every account and piece of content below a SuperAdmin belongs to exactly one.
-- Existing data moves to the original brand, whose id is also in src/lib/brands.ts.
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- Bare host, such as example.com. Optional: a brand can run without its own domain.
  domain text UNIQUE CHECK (domain = lower(domain)),
  created_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brands_unique_name ON brands (lower(name));

-- Not ON CONFLICT: later columns are required, and that's checked before any conflict is.
INSERT INTO brands (id, name)
SELECT '00000000-0000-4000-8000-000000000001', 'NairobiEliteHomes'
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE id = '00000000-0000-4000-8000-000000000001');

-- Staff. Only the SuperAdmin stands outside a brand, and the database holds that true.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands (id) ON DELETE RESTRICT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES admins (id) ON DELETE SET NULL;
UPDATE admins SET brand_id = '00000000-0000-4000-8000-000000000001' WHERE brand_id IS NULL AND role <> 'superadmin';
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_brand_check;
ALTER TABLE admins ADD CONSTRAINT admins_brand_check CHECK ((role = 'superadmin') = (brand_id IS NULL));

-- Content and requests. No default, so a missing brand fails instead of landing in the wrong one.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands (id) ON DELETE RESTRICT;
UPDATE properties SET brand_id = '00000000-0000-4000-8000-000000000001' WHERE brand_id IS NULL;
ALTER TABLE properties ALTER COLUMN brand_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS properties_brand ON properties (brand_id);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands (id) ON DELETE RESTRICT;
UPDATE posts SET brand_id = '00000000-0000-4000-8000-000000000001' WHERE brand_id IS NULL;
ALTER TABLE posts ALTER COLUMN brand_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS posts_brand ON posts (brand_id);

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands (id) ON DELETE RESTRICT;
UPDATE access_requests SET brand_id = '00000000-0000-4000-8000-000000000001' WHERE brand_id IS NULL;
ALTER TABLE access_requests ALTER COLUMN brand_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS access_requests_brand ON access_requests (brand_id);

-- Users, shown as "buyers" in older code. They arrive through Google, staff create them, or
-- both once the emails match, so either way of signing in may be missing.
ALTER TABLE buyers ALTER COLUMN google_sub DROP NOT NULL;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands (id) ON DELETE RESTRICT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS failed_logins integer NOT NULL DEFAULT 0;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES admins (id) ON DELETE SET NULL;
UPDATE buyers SET brand_id = '00000000-0000-4000-8000-000000000001' WHERE brand_id IS NULL;
ALTER TABLE buyers ALTER COLUMN brand_id SET NOT NULL;
UPDATE buyers SET email = lower(email) WHERE email <> lower(email);
-- One sign-in per email across all brands, so signing in never has to ask which brand.
CREATE UNIQUE INDEX IF NOT EXISTS buyers_unique_email ON buyers (email);
CREATE INDEX IF NOT EXISTS buyers_brand ON buyers (brand_id);

-- A brand's private community links. Staff send these by hand; the public never sees them.
CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  name text NOT NULL,
  url text NOT NULL,
  created_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, url)
);

-- What a brand's own public site shows. The slug gives a brand with no domain an address,
-- /b/slug, and stays the same if the brand is renamed so its links keep working.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS slug text;
UPDATE brands SET slug = 'nairobi-elite-homes' WHERE id = '00000000-0000-4000-8000-000000000001' AND slug IS NULL;
UPDATE brands SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || left(id::text, 6) WHERE slug IS NULL;
ALTER TABLE brands ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS brands_unique_slug ON brands (slug);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS accent_color text CHECK (accent_color ~ '^#[0-9a-f]{6}$');
ALTER TABLE brands ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS whatsapp_phone text;
