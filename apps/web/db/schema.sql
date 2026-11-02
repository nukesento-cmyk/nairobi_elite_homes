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
  published boolean NOT NULL DEFAULT false,
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
