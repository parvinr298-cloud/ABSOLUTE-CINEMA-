-- Database schema for South Wind Engineering CMS (Consolidated Upgrades & Clean Seeding)

-- 1. BASE SYSTEM SCHEMA CREATIONS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon_class VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_library (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- APPENDED ENGINE UPGRADES: DEEP PROJECT SPECIFICATIONS & MEDIA SUPPORT
-- =========================================================================

-- Safe non-destructive column additions for original tables
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Ongoing';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brochure_url TEXT;

-- Dynamic Architectural Project Pages Modules Table Setup
CREATE TABLE IF NOT EXISTS project_pages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    page_number INTEGER DEFAULT 1,
    title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Core Matrix Media Metadata Support Module Table Setup
CREATE TABLE IF NOT EXISTS project_media (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES project_pages(id) ON DELETE CASCADE,
    media_path TEXT NOT NULL,
    media_type VARCHAR(50) DEFAULT 'image',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================================
-- RECONCILIATION FOR RETROACTIVE CASCADE MODES (Highly Important)
-- =========================================================================
-- 'CREATE TABLE IF NOT EXISTS' blocks will skip adding relational ON DELETE 
-- constraints on live setups. We drop and update constraints explicitly.

-- Explicit CASCADE addition on target pages constraint links:
ALTER TABLE IF EXISTS project_pages DROP CONSTRAINT IF EXISTS project_pages_project_id_fkey CASCADE;
ALTER TABLE IF EXISTS project_pages 
ADD CONSTRAINT fk_projects_relational_relation
    FOREIGN KEY (project_id) 
    REFERENCES projects(id) 
    ON DELETE CASCADE;

-- Explicit CASCADE addition on active project media tracking schemas constraints:
ALTER TABLE IF EXISTS project_media DROP CONSTRAINT IF EXISTS project_media_page_id_fkey CASCADE;
ALTER TABLE IF EXISTS project_media DROP CONSTRAINT IF EXISTS fk_project_page CASCADE;
ALTER TABLE IF EXISTS project_media 
ADD CONSTRAINT fk_page_cascade_rule
    FOREIGN KEY (page_id) 
    REFERENCES project_pages(id) 
    ON DELETE CASCADE;


-- =========================================================================
-- LIVE DATABASE CLEAN UP & DEDUPLICATION (PREVENTS UNIQUE VIOLATIONS)
-- =========================================================================

DELETE FROM services a 
USING services b 
WHERE a.id > b.id AND a.title = b.title;

DELETE FROM projects a 
USING projects b 
WHERE a.id > b.id AND a.title = b.title;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS unique_project_title;
ALTER TABLE projects ADD CONSTRAINT unique_project_title UNIQUE (title);

ALTER TABLE services DROP CONSTRAINT IF EXISTS unique_service_title;
ALTER TABLE services ADD CONSTRAINT unique_service_title UNIQUE (title);


-- =========================================================================
-- COMPLETE ENGINE CONTEXT CORE SEED MATRIX INTEGRATIONS
-- =========================================================================

-- Seed Data for Core Configuration Options content maps
INSERT INTO site_settings (key, value) VALUES
('hero_title', 'Architectural Excellence. Structural Integrity.'),
('hero_subtitle', 'Engineering the Future of Dhaka'),
('hero_description', 'From luxury residences to commercial landmarks, we bring world-class civil engineering and innovative design to Mirpur and beyond.'),
('hero_image', 'images/unnamed6.jpg'),
('about_title', 'Visionary Leadership'),
('about_subtitle', 'A Message From Leadership'),
('about_designation', 'Managing Director, South Wind Engineering'),
('about_quote', '"We don''t just build houses; we construct legacies that stand the test of time and weather."'),
('about_p1', 'South Wind Engineering has been at the forefront of Dhaka’s urban transformation. Our approach combines rigorous civil engineering standards with aesthetic brilliance. We specialize in RAJUK-compliant designs, ensuring every project is legally sound and structurally superior.'),
('about_p2', 'Located in the heart of Mirpur 10, our studio serves as a hub for innovation where architects and engineers collaborate to turn your blueprints into reality.'),
('about_director_image', 'images/unnamed8.jpg'),
('contact_address', 'House #9, Road #6, Block A\nMirpur 10, Dhaka North, 1216'),
('contact_plus_code', 'R969+H8 Dhaka'),
('contact_phone_1', '+880 1775-202920'),
('contact_phone_2', '+880 1912-835901'),
('contact_email', 'southwindengineering43@gmail.com'),
('contact_whatsapp', '8801775202920'),
('slider_before_image', 'images/unnamed.jpg'),
('slider_after_image', 'images/unnamed3.jpg'),
('social_facebook', 'https://www.facebook.com/Southwindengineerings/'),
('social_instagram', 'https://www.instagram.com/southwindengineering/'),
('social_linkedin', '#'),
('social_youtube', '#'),
('seo_meta_title', 'South Wind Engineering | Premier Civil Engineering & Architecture'),
('seo_meta_description', 'South Wind Engineering - House #9, Road #6, Block A, Mirpur 10, Dhaka North. Professional Civil Engineering, Architecture & Construction Services.'),
('seo_og_title', 'South Wind Engineering | Premier Engineering and Architecture Studio'),
('seo_og_description', 'Professional Civil Engineering, Architecture & Construction Services in Dhaka North.')
ON CONFLICT (key) DO NOTHING;

-- Initial core users authentication node seeding profile:
INSERT INTO users (email, password_hash, must_change_password) 
VALUES (
    'southwindengineering43@gmail.com',
    '$2y$12$R.P1C8/YlQzEqXEnPZuN8u3eM9CqRByMLe7v08V.KeR5u/NWeNWea', -- Matches password reset alert triggers on admin systems profiles configuration 
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Dynamic service blocks context rendering keys insertions
INSERT INTO services (title, description, icon_class, display_order) VALUES
('Architectural Design', 'Custom residential and commercial plans that maximize space, light, and modern functionality.', 'fas fa-drafting-compass', 1),
('Structural Engineering', 'Advanced structural analysis ensuring safety and longevity using the latest construction tech.', 'fas fa-building', 2),
('RAJUK Approvals', 'Expert navigation of building codes and legal documentation for seamless project approval.', 'fas fa-file-signature', 3),
('Interior Design', 'Luxury interior solutions that reflect your personality while maintaining practical elegance.', 'fas fa-couch', 4),
('Construction Mgmt.', 'End-to-end site supervision ensuring materials and workmanship meet our elite standards.', 'fas fa-hard-hat', 5),
('Urban Planning', 'Sustainable development strategies for modern urban environments in Bangladesh.', 'fas fa-city', 6)
ON CONFLICT (title) DO NOTHING;

-- Safe insertion arrays mapping parameters baseline values
INSERT INTO projects (title, category, is_featured, display_order, images) VALUES
('South Wind Project 1', 'Residential Elite', true, 1, '["images/unnamed1.jpg"]'::jsonb),
('South Wind Project 2', 'Modern Facade', true, 2, '["images/unnamed2.jpg"]'::jsonb),
('South Wind Project 3', 'Luxury Living', true, 3, '["images/unnamed3.jpg"]'::jsonb),
('South Wind Project 4', 'Structural Framework', true, 4, '["images/unnamed4.jpg"]'::jsonb),
('South Wind Project 5', 'Commercial Space', true, 5, '["images/unnamed5.jpg"]'::jsonb),
('South Wind Project 6', 'Construction Site', true, 6, '["images/unnamed.jpg"]'::jsonb),
('South Wind Project 7', 'Architectural Detail', true, 7, '["images/unnamed9.jpg"]'::jsonb),
('South Wind Project 8', 'Urban Landmark', true, 8, '["images/unnamed10.jpg"]'::jsonb)
ON CONFLICT (title) DO NOTHING;



-- =========================================================================
-- SELLABLE ENTERPRISE UPGRADE: CERTIFICATES & TEAM MANAGEMENT
-- =========================================================================

CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_path TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL,
    description TEXT,
    image_path TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO certificates (title, description, image_path, display_order)
VALUES
('RAJUK Approved Contractor', 'Certified contractor for residential and commercial construction projects.', 'images/unnamed7.jpg', 1),
('ISO Quality Compliance', 'Quality management and project execution standards compliance certificate.', 'images/unnamed8.jpg', 2)
ON CONFLICT DO NOTHING;

INSERT INTO team_members (name, position, description, image_path, display_order)
VALUES
('MD Mohim', 'General Manager', 'Oversees daily construction operations, site coordination, and project delivery.', 'images/unnamed1.jpg', 1),
('Engr. Rahim', 'Senior Structural Engineer', 'Leads structural analysis and ensures engineering compliance for all projects.', 'images/unnamed2.jpg', 2),
('Architect Sumaia', 'Lead Architect', 'Responsible for modern architectural planning and design development.', 'images/unnamed3.jpg', 3)
ON CONFLICT DO NOTHING;


-- Bilingual support for certificates
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS title_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS title_bn VARCHAR(255),
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS description_bn TEXT;

-- Bilingual support for team members
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS name_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS name_bn VARCHAR(255),
ADD COLUMN IF NOT EXISTS position_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS position_bn VARCHAR(255),
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS description_bn TEXT;
