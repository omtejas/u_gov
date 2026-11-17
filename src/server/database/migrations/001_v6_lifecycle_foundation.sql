-- U-GOV V6 additive persistence and lifecycle migration.
-- Apply after the existing schema.sql. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES citizen_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  storage_key VARCHAR(512) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  sha256_checksum VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id, version_number DESC);

CREATE TABLE IF NOT EXISTS consent_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID REFERENCES document_consents(id) ON DELETE SET NULL,
  document_id UUID REFERENCES citizen_documents(id) ON DELETE SET NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_entity VARCHAR(255) NOT NULL,
  purpose VARCHAR(512) NOT NULL,
  access_result VARCHAR(32) NOT NULL CHECK (access_result IN ('ALLOWED','DENIED','REVOKED','EXPIRED')),
  correlation_id VARCHAR(128),
  ip_address INET,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_access_owner_time ON consent_access_logs(owner_user_id, accessed_at DESC);

CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES government_applications(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  previous_status VARCHAR(32),
  new_status VARCHAR(32),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  actor_type VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
  actor_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_application_events_timeline ON application_events(application_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS citizen_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  resource_type VARCHAR(64),
  resource_id VARCHAR(128),
  read_at TIMESTAMPTZ,
  deduplication_key VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, deduplication_key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_inbox ON citizen_notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS service_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id VARCHAR(64) NOT NULL REFERENCES government_services(id) ON DELETE CASCADE,
  document_type_id VARCHAR(64) NOT NULL REFERENCES document_types(id),
  requirement_type VARCHAR(24) NOT NULL DEFAULT 'REQUIRED' CHECK (requirement_type IN ('REQUIRED','OPTIONAL','CONDITIONAL')),
  condition JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(service_id, document_type_id)
);

CREATE TABLE IF NOT EXISTS grievances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(40) NOT NULL UNIQUE,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  category VARCHAR(64) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  state VARCHAR(100),
  district VARCHAR(100),
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grievances_status_time ON grievances(status, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(160) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  source_url TEXT,
  reviewed_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('HEALTHY','DEGRADED','DOWN','UNKNOWN')),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_provider_health_latest ON provider_health_checks(provider_code, checked_at DESC);

INSERT INTO schema_migrations(version, checksum)
VALUES ('v6_001_lifecycle_foundation', 'sha256-managed-by-release-pipeline')
ON CONFLICT (version) DO NOTHING;
