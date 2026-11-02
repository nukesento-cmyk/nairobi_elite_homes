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
