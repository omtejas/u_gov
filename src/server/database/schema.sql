-- ==========================================================
-- U-GOV Sovereign Public Digital Infrastructure
-- Master PostgreSQL Schema Definition (Phase 2 - U-IDENTITY)
-- ==========================================================

-- 1. Users Table (Core Identity Entity)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) UNIQUE NOT NULL, -- Email or national format U-ID
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, PENDING_VERIFICATION
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    preferred_language VARCHAR(10) DEFAULT 'en', -- en, hi, mr, kn
    kyc_level VARCHAR(100) DEFAULT 'Tier 1 (Basic)', -- Tier 1, Tier 2, Tier 3, Tier 4
    aadhaar_linked BOOLEAN DEFAULT FALSE,
    pan_linked BOOLEAN DEFAULT FALSE,
    state VARCHAR(100) DEFAULT 'Maharashtra',
    district VARCHAR(100) DEFAULT 'Pune',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Roles Table (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 4. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 5. User Roles Mapping
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 6. Role Permissions Mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 7. Sessions Table (Stateful Server-Managed Sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY, -- SHA-256 session token identifier
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- 8. Audit Events Table (U-AUDIT)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    actor_id VARCHAR(255),
    actor_name VARCHAR(255),
    actor_role VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    result VARCHAR(50) NOT NULL, -- SUCCESS, WARNING, FAILED, BLOCKED, INFO
    context TEXT,
    ip_address VARCHAR(45)
);

-- Initial Roles Seeding
INSERT INTO roles (id, name, description) VALUES
('CITIZEN', 'Citizen', 'Standard citizen account with access to public services and DigiVault'),
('OFFICIAL', 'Department Officer', 'Officer desk access for verifying and processing applications'),
('ADMIN', 'System Administrator', 'Full platform operational governance and node telemetry access'),
('AUDITOR', 'Statutory Auditor', 'Read-only access to tamper-evident system audit logs and compliance'),
('SERVICE_MANAGER', 'Service Manager', 'Authority to manage and configure public service directory items'),
('INTEGRATION_MANAGER', 'Integration Manager', 'Configures interoperability adapters and external node gateways')
ON CONFLICT (id) DO NOTHING;

-- Initial Permissions Seeding
INSERT INTO permissions (id, name, description) VALUES
('services:read', 'Read Services', 'Browse public services catalogue'),
('services:apply', 'Apply for Services', 'Submit applications for public services'),
('documents:manage', 'Manage DigiVault', 'Upload, view, and grant consents on credentials'),
('applications:read', 'Track Applications', 'View status of own applications'),
('audit:read', 'Read Audit Logs', 'Inspect tamper-evident system event ledger'),
('system:admin', 'Admin Console', 'Full telemetry and infrastructure configuration')
ON CONFLICT (id) DO NOTHING;

-- Map Default Permissions to Citizen
INSERT INTO role_permissions (role_id, permission_id) VALUES
('CITIZEN', 'services:read'),
('CITIZEN', 'services:apply'),
('CITIZEN', 'documents:manage'),
('CITIZEN', 'applications:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ==========================================================
-- U-DOCS Sovereign Digital Vault Schema (Phase 3)
-- ==========================================================

-- 9. Document Types Table (Credential Catalog)
CREATE TABLE IF NOT EXISTS document_types (
    id VARCHAR(64) PRIMARY KEY, -- 'AADHAAR', 'DRIVING_LICENCE', 'DOMICILE', 'INCOME_CERT', 'PAN', 'MARKSHEET'
    name VARCHAR(255) NOT NULL,
    issuing_authority VARCHAR(255) NOT NULL,
    retention_days INTEGER DEFAULT NULL -- NULL means permanent retention
);

-- 10. Citizen Owned Documents Table
CREATE TABLE IF NOT EXISTS citizen_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type_id VARCHAR(64) NOT NULL REFERENCES document_types(id),
    title VARCHAR(255) NOT NULL,
    document_number VARCHAR(128) NOT NULL, -- Masked format e.g. 'XXXX-XXXX-4820'
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_key VARCHAR(512) NOT NULL, -- Random UUID-based key, never raw citizen name
    sha256_checksum VARCHAR(64) NOT NULL, -- Mathematical content integrity hash
    verification_status VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED', -- 'UNVERIFIED', 'SELF_ATTESTED', 'SANDBOX_SIMULATED', 'DIGILOCKER_VERIFIED'
    issuer_signature_data JSONB DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citizen_docs_owner ON citizen_documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_citizen_docs_type ON citizen_documents(document_type_id);

-- 11. Document Consent Grants Table
CREATE TABLE IF NOT EXISTS document_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES citizen_documents(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_entity VARCHAR(255) NOT NULL, -- e.g. 'RTO Maharashtra', 'Direct Benefit Transfer Cell'
    purpose VARCHAR(512) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_consents_owner ON document_consents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_doc_consents_doc ON document_consents(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_consents_status ON document_consents(status);

-- Seed Initial Document Types
INSERT INTO document_types (id, name, issuing_authority, retention_days) VALUES
('AADHAAR', 'Aadhaar Identity Document', 'Unique Identification Authority of India (UIDAI)', NULL),
('PAN', 'Permanent Account Number Card', 'Income Tax Department of India', NULL),
('DRIVING_LICENCE', 'Driving Licence', 'Ministry of Road Transport & Highways (MoRTH)', 7300),
('DOMICILE', 'State Domicile Certificate', 'Revenue & Forest Department, Govt of Maharashtra', NULL),
('INCOME_CERT', 'Annual Income Certificate', 'Tehsildar / Sub-Divisional Officer', 365),
('MARKSHEET', 'Secondary School Marksheet (10th/12th)', 'State Secondary Education Board', NULL)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================
-- U-SERVICES Public Service Catalogue Schema (Phase 4.1)
-- ==========================================================

-- 12. Public Government Services Registry
CREATE TABLE IF NOT EXISTS government_services (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'serv-nsp', 'serv-parivahan'
    service_code VARCHAR(64) UNIQUE NOT NULL, -- e.g. 'NSP', 'SARATHI-DL'
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    ministry VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL, -- 'education', 'transport', 'agriculture', 'welfare', 'revenue'
    state VARCHAR(64) DEFAULT 'ALL_INDIA',
    required_document_type_ids TEXT[] DEFAULT '{}',
    required_documents JSONB DEFAULT '[]',
    benefits JSONB DEFAULT '[]',
    eligibility JSONB DEFAULT '[]',
    sla_days INTEGER DEFAULT 15,
    fee_inr NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(32) DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'SANDBOX_PROTOTYPE', 'MAINTENANCE'
    official_portal VARCHAR(512),
    is_popular BOOLEAN DEFAULT FALSE,
    featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_category ON government_services(category);
CREATE INDEX IF NOT EXISTS idx_services_status ON government_services(status);
CREATE INDEX IF NOT EXISTS idx_services_code ON government_services(service_code);

-- ==========================================================
-- U-APPLICATIONS Lifecycle Engine Schema (Phase 4.2)
-- ==========================================================

-- 13. Public Service Applications Table
CREATE TABLE IF NOT EXISTS government_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(64) UNIQUE NOT NULL, -- e.g. 'UGOV-2026-NSP-881290'
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id VARCHAR(64) NOT NULL REFERENCES government_services(id),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'DOCUMENTS_REQUIRED', 'READY', 'CONSENT_REQUIRED', 'CONSENT_GRANTED', 'SUBMITTED', 'PROCESSING', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED'
    form_data JSONB DEFAULT '{}',
    attached_document_ids TEXT[] DEFAULT '{}',
    consent_ids TEXT[] DEFAULT '{}',
    tracking_token VARCHAR(128) DEFAULT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON government_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_service ON government_applications(service_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON government_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_number ON government_applications(application_number);



