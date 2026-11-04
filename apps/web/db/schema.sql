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

-- ----------------------------------------------------------------------------
-- Acquisition: the morning research job and its lead database. See docs/acquisition.md.
-- The rules that protect people live here as well as in code, so no code path can skip them.
-- ----------------------------------------------------------------------------

-- Which domains the research job may touch. A domain with no row is treated as blocked.
CREATE TABLE IF NOT EXISTS acq_source_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  domain text NOT NULL CHECK (domain = lower(domain)),
  verdict text NOT NULL DEFAULT 'pending' CHECK (verdict IN ('pending', 'allowed', 'human_only', 'blocked')),
  terms_url text,
  notes text,
  reviewed_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, domain)
);

-- Who may be called. Locked by default until counsel clears each class, then changed here
-- without a code change. See the Compliance section of the design.
CREATE TABLE IF NOT EXISTS acq_contact_class_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  contact_class text NOT NULL CHECK (contact_class IN ('organisation_line', 'named_business_role', 'individual_published', 'owner_submitted')),
  callable boolean NOT NULL DEFAULT false,
  notes text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, contact_class)
);

CREATE TABLE IF NOT EXISTS acq_source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  policy_id uuid REFERENCES acq_source_policies (id) ON DELETE SET NULL,
  url text NOT NULL,
  http_status integer,
  outcome text NOT NULL CHECK (outcome IN ('stored', 'stopped', 'failed')),
  content_sha256 text,
  extract text,
  snapshot_expires_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acq_source_records_url ON acq_source_records (brand_id, url);

CREATE TABLE IF NOT EXISTS acq_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  prospect_type text NOT NULL CHECK (prospect_type IN ('person', 'organisation')),
  category text NOT NULL CHECK (category IN ('individual_landlord', 'home_seller', 'apartment_owner_manager', 'developer', 'commercial_owner', 'landowner', 'portfolio_investor', 'management_company', 'business_with_portfolio')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'researched', 'ready_to_call', 'contacted', 'interested', 'meeting_scheduled', 'negotiating', 'mandate_secured', 'rejected', 'follow_up', 'do_not_contact')),
  -- 'verified_owner' takes verified authority, and only a named person can verify it.
  owner_rep_class text NOT NULL DEFAULT 'unknown' CHECK (owner_rep_class IN ('unknown', 'claims_owner', 'representative', 'agent', 'developer_of_record', 'verified_owner')),
  authority_status text NOT NULL DEFAULT 'unverified' CHECK (authority_status IN ('unverified', 'self_declared', 'documents_received', 'verified', 'failed')),
  authority_verified_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  campaign text CHECK (campaign IN ('vacant_rentals', 'premium_sales', 'developers', 'commercial', 'portfolio')),
  score integer CHECK (score BETWEEN 0 AND 100),
  score_breakdown jsonb NOT NULL DEFAULT '{}',
  opening_script text,
  canonical_key text NOT NULL,
  next_follow_up_at timestamptz,
  notify_by date,
  assigned_to uuid REFERENCES admins (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  approved_at timestamptz,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, canonical_key),
  CONSTRAINT acq_prospects_verified_owner CHECK (owner_rep_class <> 'verified_owner' OR authority_status = 'verified'),
  CONSTRAINT acq_prospects_verified_by CHECK (authority_status <> 'verified' OR authority_verified_by IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS acq_prospects_queue ON acq_prospects (brand_id, status, score DESC);

CREATE TABLE IF NOT EXISTS acq_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  prospect_id uuid NOT NULL REFERENCES acq_prospects (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('phone', 'email', 'website')),
  normalised_value text NOT NULL,
  -- Keyed hash of the value, compared against the suppression list.
  value_hash text NOT NULL,
  contact_class text NOT NULL CHECK (contact_class IN ('organisation_line', 'named_business_role', 'individual_published', 'owner_submitted')),
  source_record_id uuid NOT NULL REFERENCES acq_source_records (id) ON DELETE RESTRICT,
  usable boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, kind, normalised_value)
);
CREATE INDEX IF NOT EXISTS acq_contacts_prospect ON acq_contacts (prospect_id);
CREATE INDEX IF NOT EXISTS acq_contacts_hash ON acq_contacts (value_hash);

CREATE TABLE IF NOT EXISTS acq_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  prospect_id uuid NOT NULL REFERENCES acq_prospects (id) ON DELETE CASCADE,
  area text,
  location_text text,
  property_type text,
  intent text CHECK (intent IN ('rent', 'sale', 'both', 'unknown')),
  -- Null unless a source states it.
  asking_amount numeric CHECK (asking_amount > 0),
  asking_currency text CHECK (asking_currency IN ('KES', 'USD')),
  source_record_id uuid NOT NULL REFERENCES acq_source_records (id) ON DELETE RESTRICT,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acq_opportunities_prospect ON acq_opportunities (prospect_id);

CREATE TABLE IF NOT EXISTS acq_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  prospect_id uuid NOT NULL REFERENCES acq_prospects (id) ON DELETE CASCADE,
  claim_type text NOT NULL CHECK (claim_type IN ('active_marketing', 'ownership_claim', 'representation', 'developer_of_record', 'portfolio_size', 'property_detail', 'contact')),
  quote text NOT NULL CHECK (length(trim(quote)) > 0),
  source_record_id uuid NOT NULL REFERENCES acq_source_records (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acq_evidence_prospect ON acq_evidence (prospect_id);

-- Possible duplicates a person resolves. Nothing here merges on its own.
CREATE TABLE IF NOT EXISTS acq_duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  prospect_id uuid NOT NULL REFERENCES acq_prospects (id) ON DELETE CASCADE,
  possible_match_id uuid NOT NULL REFERENCES acq_prospects (id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged', 'not_duplicate')),
  resolved_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, possible_match_id)
);

CREATE TABLE IF NOT EXISTS acq_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  prospect_id uuid NOT NULL REFERENCES acq_prospects (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES acq_contacts (id) ON DELETE SET NULL,
  caller_id uuid REFERENCES admins (id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'call' CHECK (channel IN ('call', 'email', 'meeting', 'other')),
  outcome text NOT NULL CHECK (outcome IN ('no_answer', 'answered', 'interested', 'not_interested', 'meeting_booked', 'wrong_person', 'opt_out', 'other')),
  opt_out_line_read boolean NOT NULL DEFAULT false,
  notes text,
  next_follow_up_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acq_interactions_prospect ON acq_interactions (prospect_id, occurred_at DESC);

-- Opt-outs apply across every brand, and outlive the prospect they came from. Only keyed
-- hashes are kept, so this list holds no phone numbers or emails.
CREATE TABLE IF NOT EXISTS acq_suppression (
  value_hash text PRIMARY KEY,
  origin_brand_id uuid REFERENCES brands (id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'opt_out',
  received_at timestamptz NOT NULL DEFAULT now(),
  comply_by date NOT NULL DEFAULT ((now() + interval '14 days')::date),
  updated_by text
);

CREATE TABLE IF NOT EXISTS acq_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  campaign text NOT NULL CHECK (campaign IN ('vacant_rentals', 'premium_sales', 'developers', 'commercial', 'portfolio')),
  version integer NOT NULL CHECK (version > 0),
  template text NOT NULL,
  approved_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  approved_at timestamptz,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, campaign, version)
);

CREATE TABLE IF NOT EXISTS acq_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  prospect_id uuid NOT NULL REFERENCES acq_prospects (id) ON DELETE RESTRICT,
  identity_verified_at timestamptz,
  ownership_verified_at timestamptz,
  verified_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  availability_confirmed_at timestamptz,
  terms_confirmed_at timestamptz,
  authority_signed_at timestamptz,
  photos_authorised_at timestamptz,
  submitted_at timestamptz,
  final_approved_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  final_approved_at timestamptz,
  failed_reason text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Whoever verified the documents can't also give the final approval.
  CONSTRAINT acq_onboarding_two_people CHECK (final_approved_by IS NULL OR verified_by IS NULL OR final_approved_by <> verified_by)
);
CREATE INDEX IF NOT EXISTS acq_onboarding_prospect ON acq_onboarding (prospect_id);

-- References only. The files live in a separate private, encrypted store.
CREATE TABLE IF NOT EXISTS acq_onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  onboarding_id uuid NOT NULL REFERENCES acq_onboarding (id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('identity', 'ownership', 'authority', 'marketing_authority', 'other')),
  storage_ref text NOT NULL,
  verified_by uuid REFERENCES admins (id) ON DELETE SET NULL,
  verified_at timestamptz,
  delete_after date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per job per day. The unique key is what makes a duplicate cron call harmless.
CREATE TABLE IF NOT EXISTS acq_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  job text NOT NULL,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_by text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  lease_expires_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  delivered_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}',
  spend_usd numeric NOT NULL DEFAULT 0,
  error text,
  UNIQUE (brand_id, job, run_date)
);

-- Step-level log. Contact details never go in here.
CREATE TABLE IF NOT EXISTS acq_run_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES acq_runs (id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acq_run_events_run ON acq_run_events (run_id, id);

CREATE TABLE IF NOT EXISTS acq_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  before jsonb,
  after jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

-- A property that came through acquisition can't be approved until onboarding is complete,
-- whichever role submits it. Properties added by hand leave this empty and are unaffected.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS acq_onboarding_id uuid REFERENCES acq_onboarding (id) ON DELETE RESTRICT;

-- The audit log can never be changed. Erasing a person's interactions and source records is
-- the one exception elsewhere, and takes a deliberate SET LOCAL acq.erasure = 'on'.
CREATE OR REPLACE FUNCTION acq_block_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'acq_audit_log is append-only';
END $$;
CREATE OR REPLACE TRIGGER acq_audit_log_append_only BEFORE UPDATE OR DELETE ON acq_audit_log
  FOR EACH ROW EXECUTE FUNCTION acq_block_audit_change();

CREATE OR REPLACE FUNCTION acq_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('acq.erasure', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;
CREATE OR REPLACE TRIGGER acq_interactions_append_only BEFORE UPDATE OR DELETE ON acq_interactions
  FOR EACH ROW EXECUTE FUNCTION acq_append_only();
CREATE OR REPLACE TRIGGER acq_source_records_append_only BEFORE UPDATE OR DELETE ON acq_source_records
  FOR EACH ROW EXECUTE FUNCTION acq_append_only();

-- TG_ARGV[0] lists columns kept out of the log, so it never holds a name or contact detail.
CREATE OR REPLACE FUNCTION acq_write_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  hidden text[] := string_to_array(COALESCE(TG_ARGV[0], ''), ',');
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  whole jsonb := COALESCE(after_row, before_row);
BEGIN
  INSERT INTO acq_audit_log (actor, action, table_name, record_id, before, after)
  VALUES (COALESCE(whole ->> 'updated_by', 'system'), TG_OP, TG_TABLE_NAME,
          COALESCE(whole ->> 'id', whole ->> 'value_hash'), before_row - hidden, after_row - hidden);
  RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER acq_source_policies_audit AFTER INSERT OR UPDATE OR DELETE ON acq_source_policies
  FOR EACH ROW EXECUTE FUNCTION acq_write_audit('');
CREATE OR REPLACE TRIGGER acq_contact_class_rules_audit AFTER INSERT OR UPDATE OR DELETE ON acq_contact_class_rules
  FOR EACH ROW EXECUTE FUNCTION acq_write_audit('');
CREATE OR REPLACE TRIGGER acq_prospects_audit AFTER INSERT OR UPDATE OR DELETE ON acq_prospects
  FOR EACH ROW EXECUTE FUNCTION acq_write_audit('display_name,opening_script,canonical_key,score_breakdown');
CREATE OR REPLACE TRIGGER acq_contacts_audit AFTER INSERT OR UPDATE OR DELETE ON acq_contacts
  FOR EACH ROW EXECUTE FUNCTION acq_write_audit('normalised_value,value_hash');
CREATE OR REPLACE TRIGGER acq_suppression_audit AFTER INSERT OR UPDATE OR DELETE ON acq_suppression
  FOR EACH ROW EXECUTE FUNCTION acq_write_audit('');
CREATE OR REPLACE TRIGGER acq_campaigns_audit AFTER INSERT OR UPDATE OR DELETE ON acq_campaigns
  FOR EACH ROW EXECUTE FUNCTION acq_write_audit('');
CREATE OR REPLACE TRIGGER acq_onboarding_audit AFTER INSERT OR UPDATE OR DELETE ON acq_onboarding
  FOR EACH ROW EXECUTE FUNCTION acq_write_audit('');

-- Every status change goes through here.
CREATE OR REPLACE FUNCTION acq_check_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'new' THEN
      RAISE EXCEPTION 'A prospect must start as new, not %', NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  NEW.updated_at := now();
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF OLD.status = 'do_not_contact' THEN
    RAISE EXCEPTION 'A Do Not Contact prospect cannot change status';
  END IF;

  -- Opting out always works, from anywhere. The AFTER trigger writes the suppression rows.
  IF NEW.status = 'do_not_contact' THEN RETURN NEW; END IF;

  IF NOT (
    (OLD.status = 'new' AND NEW.status IN ('researched', 'rejected')) OR
    (OLD.status = 'researched' AND NEW.status IN ('ready_to_call', 'rejected', 'follow_up')) OR
    (OLD.status = 'ready_to_call' AND NEW.status IN ('contacted', 'rejected', 'follow_up')) OR
    (OLD.status = 'contacted' AND NEW.status IN ('interested', 'rejected', 'follow_up')) OR
    (OLD.status = 'interested' AND NEW.status IN ('meeting_scheduled', 'negotiating', 'rejected', 'follow_up')) OR
    (OLD.status = 'meeting_scheduled' AND NEW.status IN ('interested', 'negotiating', 'rejected', 'follow_up')) OR
    (OLD.status = 'negotiating' AND NEW.status IN ('mandate_secured', 'rejected', 'follow_up')) OR
    (OLD.status = 'follow_up' AND NEW.status IN ('ready_to_call', 'contacted', 'interested', 'meeting_scheduled', 'negotiating', 'rejected')) OR
    (OLD.status = 'rejected' AND NEW.status = 'follow_up')
  ) THEN
    RAISE EXCEPTION 'A prospect cannot move from % to %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'researched' THEN
    IF NOT EXISTS (SELECT 1 FROM acq_evidence e WHERE e.prospect_id = NEW.id) THEN
      RAISE EXCEPTION 'A researched prospect needs at least one piece of evidence';
    END IF;
    IF NEW.campaign IS NULL OR NEW.score IS NULL OR NEW.opening_script IS NULL THEN
      RAISE EXCEPTION 'A researched prospect needs a campaign, a score and an opening script';
    END IF;
  ELSIF NEW.status = 'ready_to_call' THEN
    IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'A person must approve a prospect before it is ready to call';
    END IF;
    IF EXISTS (SELECT 1 FROM acq_contacts c JOIN acq_suppression s ON s.value_hash = c.value_hash WHERE c.prospect_id = NEW.id) THEN
      RAISE EXCEPTION 'This prospect has a contact on the suppression list';
    END IF;
    IF EXISTS (SELECT 1 FROM acq_duplicate_candidates d WHERE d.status = 'open' AND NEW.id IN (d.prospect_id, d.possible_match_id)) THEN
      RAISE EXCEPTION 'This prospect has an unresolved possible duplicate';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM acq_contacts c
      JOIN acq_contact_class_rules r ON r.brand_id = c.brand_id AND r.contact_class = c.contact_class
      WHERE c.prospect_id = NEW.id AND c.usable AND c.kind IN ('phone', 'email') AND r.callable
    ) THEN
      RAISE EXCEPTION 'This prospect has no contact that may be called';
    END IF;
  ELSIF NEW.status = 'follow_up' THEN
    IF NEW.next_follow_up_at IS NULL THEN
      RAISE EXCEPTION 'A follow-up needs a date';
    END IF;
  ELSIF NEW.status = 'mandate_secured' THEN
    IF NOT EXISTS (SELECT 1 FROM acq_onboarding o WHERE o.prospect_id = NEW.id AND o.authority_signed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'A mandate needs an onboarding record with signed authority';
    END IF;
  END IF;

  IF NEW.status IN ('contacted', 'interested', 'meeting_scheduled', 'negotiating')
     AND NOT EXISTS (SELECT 1 FROM acq_interactions i WHERE i.prospect_id = NEW.id) THEN
    RAISE EXCEPTION 'Moving to % needs a logged interaction', NEW.status;
  END IF;

  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER acq_prospects_status BEFORE INSERT OR UPDATE ON acq_prospects
  FOR EACH ROW EXECUTE FUNCTION acq_check_status();

-- Do Not Contact suppresses every contact of that prospect in the same transaction.
CREATE OR REPLACE FUNCTION acq_suppress_on_opt_out() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO acq_suppression (value_hash, origin_brand_id, updated_by)
  SELECT c.value_hash, NEW.brand_id, NEW.updated_by FROM acq_contacts c WHERE c.prospect_id = NEW.id
  ON CONFLICT (value_hash) DO NOTHING;
  UPDATE acq_contacts SET usable = false, updated_by = NEW.updated_by WHERE prospect_id = NEW.id;
  RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER acq_prospects_opt_out AFTER UPDATE OF status ON acq_prospects
  FOR EACH ROW WHEN (NEW.status = 'do_not_contact' AND OLD.status <> 'do_not_contact')
  EXECUTE FUNCTION acq_suppress_on_opt_out();

CREATE OR REPLACE FUNCTION acq_check_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.acq_onboarding_id IS NOT NULL AND NEW.review_status = 'approved' AND NOT EXISTS (
    SELECT 1 FROM acq_onboarding o WHERE o.id = NEW.acq_onboarding_id
      AND o.identity_verified_at IS NOT NULL AND o.ownership_verified_at IS NOT NULL
      AND o.verified_by IS NOT NULL AND o.availability_confirmed_at IS NOT NULL
      AND o.terms_confirmed_at IS NOT NULL AND o.authority_signed_at IS NOT NULL
      AND o.photos_authorised_at IS NOT NULL AND o.submitted_at IS NOT NULL
      AND o.final_approved_by IS NOT NULL AND o.final_approved_at IS NOT NULL
      AND o.failed_reason IS NULL
  ) THEN
    RAISE EXCEPTION 'This property cannot be approved until its onboarding is complete';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER properties_acquisition_gate BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION acq_check_publication();

-- Starting positions. ON CONFLICT leaves anything a person has since changed alone.
INSERT INTO acq_source_policies (brand_id, domain, verdict, terms_url, notes, reviewed_at, updated_by) VALUES
  ('00000000-0000-4000-8000-000000000001', 'property24.co.ke', 'blocked', 'https://www.property24.co.ke/terms-and-conditions', 'Terms bar automated and manual copying. Needs written consent.', now(), 'system'),
  ('00000000-0000-4000-8000-000000000001', 'property24.com', 'blocked', NULL, 'Same group as property24.co.ke. Needs written consent.', now(), 'system'),
  ('00000000-0000-4000-8000-000000000001', 'buyrentkenya.com', 'blocked', 'https://www.buyrentkenya.com/legal', 'Terms bar data mining and scraping without written consent.', now(), 'system'),
  ('00000000-0000-4000-8000-000000000001', 'jiji.co.ke', 'blocked', NULL, 'Terms not yet reviewed.', now(), 'system'),
  ('00000000-0000-4000-8000-000000000001', 'linkedin.com', 'human_only', 'https://www.linkedin.com/legal/user-agreement', 'User Agreement 8.2 bans scraping, bots and copying.', now(), 'system'),
  ('00000000-0000-4000-8000-000000000001', 'facebook.com', 'human_only', NULL, 'No automated collection.', now(), 'system'),
  ('00000000-0000-4000-8000-000000000001', 'instagram.com', 'human_only', NULL, 'No automated collection.', now(), 'system')
ON CONFLICT (brand_id, domain) DO NOTHING;

-- Only owners who submitted their own details are callable until counsel clears the others.
INSERT INTO acq_contact_class_rules (brand_id, contact_class, callable, notes, updated_by) VALUES
  ('00000000-0000-4000-8000-000000000001', 'owner_submitted', true, 'Consent given on the owner form.', 'system'),
  ('00000000-0000-4000-8000-000000000001', 'organisation_line', false, 'Awaiting advocate opinion.', 'system'),
  ('00000000-0000-4000-8000-000000000001', 'named_business_role', false, 'Awaiting advocate opinion.', 'system'),
  ('00000000-0000-4000-8000-000000000001', 'individual_published', false, 'Locked pending advocate opinion.', 'system')
ON CONFLICT (brand_id, contact_class) DO NOTHING;
