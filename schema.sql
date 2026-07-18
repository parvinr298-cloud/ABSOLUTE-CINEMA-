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
    title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_class VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    image_path TEXT,
    video_path TEXT,
    status VARCHAR(50) DEFAULT 'Ongoing',
    brochure_url TEXT,
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

-- Dynamic Architectural Project Pages Modules Table Setup
CREATE TABLE IF NOT EXISTS project_pages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    page_number INTEGER DEFAULT 1,
    title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Core Matrix Media Metadata Support Module Table Setup
CREATE TABLE IF NOT EXISTS project_media (
    id SERIAL PRIMARY KEY,
    page_id INTEGER,
    media_path TEXT NOT NULL,
    media_type VARCHAR(50) DEFAULT 'image',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimized Certificates Table (Accepts legacy nullable values)
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    title_en VARCHAR(255) UNIQUE,
    title_bn VARCHAR(255),
    description TEXT,
    description_en TEXT,
    description_bn TEXT,
    image_path TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimized Team Members Table (Accepts legacy nullable values)
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    name_en VARCHAR(255) UNIQUE,
    name_bn VARCHAR(255),
    position VARCHAR(255),
    position_en VARCHAR(255),
    position_bn VARCHAR(255),
    description TEXT,
    description_en TEXT,
    description_bn TEXT,
    image_path TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================================
-- RECONCILIATION FOR RETROACTIVE CASCADE MODES (Safe Idempotency Patches)
-- =========================================================================

-- Explicit CASCADE addition on target pages constraint links:
ALTER TABLE IF EXISTS project_pages DROP CONSTRAINT IF EXISTS project_pages_project_id_fkey CASCADE;
ALTER TABLE IF EXISTS project_pages DROP CONSTRAINT IF EXISTS fk_projects_relational_relation CASCADE;
ALTER TABLE IF EXISTS project_pages 
ADD CONSTRAINT fk_projects_relational_relation
    FOREIGN KEY (project_id) 
    REFERENCES projects(id) 
    ON DELETE CASCADE;

-- Explicit CASCADE addition on active project media tracking schemas constraints:
ALTER TABLE IF EXISTS project_media DROP CONSTRAINT IF EXISTS project_media_page_id_fkey CASCADE;
ALTER TABLE IF EXISTS project_media DROP CONSTRAINT IF EXISTS fk_project_page CASCADE;
ALTER TABLE IF EXISTS project_media DROP CONSTRAINT IF EXISTS fk_page_cascade_rule CASCADE;
ALTER TABLE IF EXISTS project_media 
ADD CONSTRAINT fk_page_cascade_rule
    FOREIGN KEY (page_id) 
    REFERENCES project_pages(id) 
    ON DELETE CASCADE;


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
    '$2y$12$R.P1C8/YlQzEqXEnPZuN8u3eM9CqRByMLe7v08V.KeR5u/NWeNWea', 
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

-- Seed Certificate details securely
INSERT INTO certificates (title, title_en, title_bn, description, description_en, description_bn, image_path, display_order)
VALUES
(
  'RAJUK Approved Contractor', 
  'RAJUK Approved Contractor', 
  'রাজউক অনুমোদিত ঠিকাদার',
  'Certified contractor for residential and commercial construction projects.',
  'Certified contractor for residential and commercial construction projects.',
  'আবাসিক ও বাণিজ্যিক নির্মাণ প্রকল্পের জন্য অনুমোদিত ঠিকাদার।',
  'images/unnamed7.jpg', 
  1
),
(
  'ISO Quality Compliance', 
  'ISO Quality Compliance', 
  'আইএসও গুণমান সম্মতি',
  'Quality management and project execution standards compliance certificate.',
  'Quality management and project execution standards compliance certificate.',
  'গুণমান ব্যবস্থাপনা এবং প্রকল্প বাস্তবায়ন মান সম্মতি শংসাপত্র।',
  'images/unnamed8.jpg', 
  2
)
ON CONFLICT (title_en) DO NOTHING;

-- Seed Team details securely
INSERT INTO team_members (name, name_en, name_bn, position, position_en, position_bn, description, description_en, description_bn, image_path, display_order)
VALUES
(
  'MD Mohim', 
  'MD Mohim', 
  'মোঃ মহিম',
  'General Manager', 
  'General Manager', 
  'মহাব্যবস্থাপক',
  'Oversees daily construction operations, site coordination, and project delivery.',
  'Oversees daily construction operations, site coordination, and project delivery.',
  'দৈনিক নির্মাণ কার্যক্রম, সাইট সমন্বয় এবং প্রকল্প সরবরাহ তদারকি করেন।',
  'images/unnamed1.jpg', 
  1
),
(
  'Engr. Rahim', 
  'Engr. Rahim', 
  'ইঞ্জিঃ রহিম',
  'Senior Structural Engineer', 
  'Senior Structural Engineer', 
  'সিনিয়র স্ট্রাকচারাল ইঞ্জিনিয়ার',
  'Leads structural analysis and ensures engineering compliance for all projects.',
  'Leads structural analysis and ensures engineering compliance for all projects.',
  'কাঠামোগত বিশ্লেষণ পরিচালনা করেন এবং প্রকৌশল সম্মতি নিশ্চিত করেন।',
  'images/unnamed2.jpg', 
  2
),
(
  'Architect Sumaia', 
  'Architect Sumaia', 
  'স্থপতি সুমাইয়া',
  'Lead Architect', 
  'Lead Architect', 
  'প্রধান স্থপতি',
  'Responsible for modern architectural planning and design development.',
  'Responsible for modern architectural planning and design development.',
  'আধুনিক স্থাপত্য পরিকল্পনা এবং নকশা উন্নয়নের জন্য দায়ী।',
  'images/unnamed3.jpg', 
  3
)
ON CONFLICT (name_en) DO NOTHING;
