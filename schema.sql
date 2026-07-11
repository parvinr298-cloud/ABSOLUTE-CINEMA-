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

-- Seed Data for Core Content Layers
INSERT INTO site_settings (key, value) VALUES
('hero_title', 'Architectural Excellence. Structural Integrity.'),
('hero_subtitle', 'Engineering the Future of Dhaka'),
('hero_description', 'From luxury residences to commercial landmarks, we bring world-class civil engineering and innovative design to Mirpur and beyond.'),
('hero_image', 'Images/unnamed6.jpg'),
('about_title', 'Visionary Leadership'),
('about_subtitle', 'A Message From Leadership'),
('about_designation', 'Managing Director, South Wind Engineering'),
('about_quote', '"We don''t just build houses; we construct legacies that stand the test of time and weather."'),
('about_p1', 'South Wind Engineering has been at the forefront of Dhaka’s urban transformation. Our approach combines rigorous civil engineering standards with aesthetic brilliance. We specialize in RAJUK-compliant designs, ensuring every project is legally sound and structurally superior.'),
('about_p2', 'Located in the heart of Mirpur 10, our studio serves as a hub for innovation where architects and engineers collaborate to turn your blueprints into reality.'),
('about_director_image', 'Images/unnamed8.jpg'),
('contact_address', 'House #9, Road #6, Block A\nMirpur 10, Dhaka North, 1216'),
('contact_plus_code', 'R969+H8 Dhaka'),
('contact_phone_1', '+880 1775-202920'),
('contact_phone_2', '+880 1912-835901'),
('contact_email', 'southwindengineering43@gmail.com'),
('contact_whatsapp', '8801775202920'),
('social_facebook', 'https://www.facebook.com/Southwindengineerings/'),
('social_instagram', 'https://www.instagram.com/southwindengineering/'),
('social_linkedin', '#'),
('social_youtube', '#'),
('seo_meta_title', 'South Wind Engineering | Premier Civil Engineering & Architecture'),
('seo_meta_description', 'South Wind Engineering - House #9, Road #6, Block A, Mirpur 10, Dhaka North. Professional Civil Engineering, Architecture & Construction Services.'),
('seo_og_title', 'South Wind Engineering | Premier Engineering and Architecture Studio'),
('seo_og_description', 'Professional Civil Engineering, Architecture & Construction Services in Dhaka North.')
ON CONFLICT (key) DO NOTHING;

-- Seed Default Services matching current design
INSERT INTO services (title, description, icon_class, display_order) VALUES
('Architectural Design', 'Custom residential and commercial plans that maximize space, light, and modern functionality.', 'fas fa-drafting-compass', 1),
('Structural Engineering', 'Advanced structural analysis ensuring safety and longevity using the latest construction tech.', 'fas fa-building', 2),
('RAJUK Approvals', 'Expert navigation of building codes and legal documentation for seamless project approval.', 'fas fa-file-signature', 3),
('Interior Design', 'Luxury interior solutions that reflect your personality while maintaining practical elegance.', 'fas fa-couch', 4),
('Construction Mgmt.', 'End-to-end site supervision ensuring materials and workmanship meet our elite standards.', 'fas fa-hard-hat', 5),
('Urban Planning', 'Sustainable development strategies for modern urban environments in Bangladesh.', 'fas fa-city', 6)
ON CONFLICT DO NOTHING;

-- Seed Default Projects matching layout classes
INSERT INTO projects (title, category, is_featured, display_order, images) VALUES
('South Wind Project 1', 'Residential Elite', true, 1, '["Images/unnamed1.jpg"]'::jsonb),
('South Wind Project 2', 'Modern Facade', true, 2, '["Images/unnamed2.jpg"]'::jsonb),
('South Wind Project 3', 'Luxury Living', true, 3, '["Images/unnamed3.jpg"]'::jsonb),
('South Wind Project 4', 'Structural Framework', true, 4, '["Images/unnamed4.jpg"]'::jsonb),
('South Wind Project 5', 'Commercial Space', true, 5, '["Images/unnamed5.jpg"]'::jsonb),
('South Wind Project 6', 'Construction Site', true, 6, '["Images/unnamed.jpg"]'::jsonb),
('South Wind Project 7', 'Architectural Detail', true, 7, '["Images/unnamed9.jpg"]'::jsonb),
('South Wind Project 8', 'Urban Landmark', true, 8, '["Images/unnamed10.jpg"]'::jsonb)
ON CONFLICT DO NOTHING;


-- =========================================================================
-- APPENDED ENGINE UPGRADES: DEEP PROJECT SPECIFICATIONS & MEDIA SUPPORT
-- =========================================================================

-- Safe non-destructive column additions for original tables
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_path TEXT;

-- New Architectural Project Pages Module
CREATE TABLE IF NOT EXISTS project_pages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    page_number INTEGER DEFAULT 1,
    title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- New Matrix Media Support Module
CREATE TABLE IF NOT EXISTS project_media (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES project_pages(id) ON DELETE CASCADE,
    media_path TEXT NOT NULL,
    media_type VARCHAR(50) DEFAULT 'image',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);