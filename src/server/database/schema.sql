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
