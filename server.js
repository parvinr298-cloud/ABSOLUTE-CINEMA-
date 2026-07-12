const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Pool } = require('pg');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'south_wind_secure_core_secret_key';

// 1. Establish Directories
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 2. PostgreSQL Connection Configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render') 
        ? { rejectUnauthorized: false } 
        : false
});

// 3. Database Bootstrap (Auto-Creates Tables On Deployment)
async function bootstrapDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Users (Admin Account)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                must_change_password BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed Default Admin (admin@southwind.com / AdminPass@123)
        const userCheck = await client.query('SELECT * FROM users LIMIT 1');
        if (userCheck.rows.length === 0) {
            const defaultHash = await bcrypt.hash('AdminPass@123', 10);
            await client.query(
                'INSERT INTO users (email, password_hash, must_change_password) VALUES ($1, $2, $3)',
                ['admin@southwind.com', defaultHash, true]
            );
            console.log('Seeded default user: admin@southwind.com / AdminPass@123');
        }

        // Configuration Settings
        await client.query(`
            CREATE TABLE IF NOT EXISTS content_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT
            );
        `);

        // Services
        await client.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                icon_class VARCHAR(100) DEFAULT 'fas fa-building',
                display_order INT DEFAULT 0
            );
        `);

        // Projects
        await client.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                category VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                image_path VARCHAR(512),
                video_path VARCHAR(512),
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Project Pages
        await client.query(`
            CREATE TABLE IF NOT EXISTS project_pages (
                id SERIAL PRIMARY KEY,
                project_id INT REFERENCES projects(id) ON DELETE CASCADE,
                title VARCHAR(255),
                page_number INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Project Media
        await client.query(`
            CREATE TABLE IF NOT EXISTS project_media (
                id SERIAL PRIMARY KEY,
                page_id INT REFERENCES project_pages(id) ON DELETE CASCADE,
                media_path VARCHAR(512) NOT NULL,
                media_type VARCHAR(50) DEFAULT 'image',
                display_order INT DEFAULT 0
            );
        `);

        // Client Message Logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Media Library Vault Tracker
        await client.query(`
            CREATE TABLE IF NOT EXISTS media_library (
                id SERIAL PRIMARY KEY,
                filepath VARCHAR(512) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query('COMMIT');
        console.log('Database tables verified and bootstrapped.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database bootstrap failed:', err);
    } finally {
        client.release();
    }
}
bootstrapDatabase();

// 4. Global Express Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CSP configuration to allow Content-Delivery CDN assets
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://*"],
            frameSrc: ["'self'", "https://www.youtube.com", "https://www.google.com"]
        }
    }
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Request threshold exceeded. Please try again later.' }
});
app.use('/api/', apiLimiter);

// Robust Token Authorization Middleware Supporting All Headers Checked by Frontend Probes
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || 
                  req.headers['x-access-token'] || 
                  req.headers['token'];

    if (!token) return res.status(401).json({ error: 'Access token missing.' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Access token invalid or expired.' });
        req.user = decoded;
        next();
    });
}

// Helper: Safely resolve database tables payload array wrap
const getRows = (payload) => payload.rows || [];

// 5. Auth Controllers
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid access credentials.' });

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid access credentials.' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token, must_change_password: user.must_change_password });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT email, must_change_password FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Passkey requires at least 8 characters.' });
    }
    try {
        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [hash, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/auth/change-email', authenticateToken, async (req, res) => {
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ error: 'New target email required.' });
    try {
        await pool.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, req.user.id]);
        res.json({ success: 'Administrative email modified successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Config Content Controllers
app.get('/api/content', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM content_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/content/update-batch', authenticateToken, async (req, res) => {
    const settings = req.body;
    try {
        for (const [key, val] of Object.entries(settings)) {
            await pool.query(
                'INSERT INTO content_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2',
                [key, val]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Core Competencies Controllers (Services)
app.get('/api/services', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM services ORDER BY display_order ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/services', authenticateToken, async (req, res) => {
    const { title, description, icon_class, display_order } = req.body;
    try {
        await pool.query(
            'INSERT INTO services (title, description, icon_class, display_order) VALUES ($1, $2, $3, $4)',
            [title, description, icon_class || 'fas fa-building', display_order || 0]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/services/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Projects Controllers
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY display_order ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
    const { category, title, display_order } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO projects (category, title, display_order) VALUES ($1, $2, $3) RETURNING id',
            [category, title, display_order || 0]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/projects/:id/advanced', authenticateToken, async (req, res) => {
    const { title, description, image_path, video_path } = req.body;
    try {
        await pool.query(
            'UPDATE projects SET title = COALESCE($1, title), description = COALESCE($2, description), image_path = COALESCE($3, image_path), video_path = COALESCE($4, video_path) WHERE id = $5',
            [title, description, image_path, video_path, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects/:id/details', async (req, res) => {
    const projectId = req.params.id;
    try {
        const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
        if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

        const project = projectResult.rows[0];

        // Fetch Pages and Nested Media Assets
        const pagesResult = await pool.query('SELECT * FROM project_pages WHERE project_id = $1 ORDER BY page_number ASC', [projectId]);
        const pages = pagesResult.rows;

        for (const page of pages) {
            const mediaResult = await pool.query('SELECT * FROM project_media WHERE page_id = $1 ORDER BY display_order ASC', [page.id]);
            page.media = mediaResult.rows;
        }

        project.pages = pages;
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Project Pages Controllers
app.post('/api/projects/:id/pages', authenticateToken, async (req, res) => {
    const { title, page_number } = req.body;
    const projectId = req.params.id;
    try {
        await pool.query(
            'INSERT INTO project_pages (project_id, title, page_number) VALUES ($1, $2, $3)',
            [projectId, title, page_number]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unified Dynamic Page Deletion Endpoint Checked by Frontend Probes
app.delete(['/api/project-pages/:id', '/api/project_pages/:id', '/api/pages/:id'], authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM project_pages WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Page Media Association Controllers
app.post('/api/project-pages/:pageId/media', authenticateToken, async (req, res) => {
    const { media_path, media_type, display_order } = req.body;
    const pageId = req.params.pageId;
    try {
        await pool.query(
            'INSERT INTO project_media (page_id, media_path, media_type, display_order) VALUES ($1, $2, $3, $4)',
            [pageId, media_path, media_type || 'image', display_order || 0]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Robust Deletion Router (No User-Ownership Block) supporting params/body checks
app.delete(['/api/project-media/:id', '/api/project_media/:id', '/api/project-medium/:id', '/api/project_medium/:id'], authenticateToken, async (req, res) => {
    const mediaId = req.params.id;
    try {
        const mediaCheck = await pool.query('SELECT * FROM project_media WHERE id = $1', [mediaId]);
        if (mediaCheck.rows.length === 0) {
            return res.status(404).json({ error: "Media record not found in database." });
        }
        await pool.query('DELETE FROM project_media WHERE id = $1', [mediaId]);
        res.json({ success: true, message: "Project media successfully purged." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Public Message Controllers
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messages', async (req, res) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and inquiry block required.' });
    }
    try {
        await pool.query(
            'INSERT INTO messages (name, email, phone, message) VALUES ($1, $2, $3, $4)',
            [name, email, phone || null, message]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/messages/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE messages SET is_read = TRUE WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. Media Vault and Multer Controllers
app.get('/api/media/library', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM media_library ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const upload = multer({ dest: 'temp_uploads/' });

app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No binary track attached.' });

    const tempPath = req.file.path;
    const isImage = req.file.mimetype.startsWith('image/');
    
    // Exact Timestamp Random Filename Generator
    const targetFilename = isImage 
        ? `optimized-asset-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`
        : `asset-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`;
    
    const targetPath = path.join(uploadsDir, targetFilename);
    const dbPath = `uploads/${targetFilename}`;

    try {
        if (isImage) {
            // Process Image utilizing Sharp to output WebP
            await sharp(tempPath)
                .resize({ width: 1440, withoutEnlargement: true })
                .webp({ quality: 85 })
                .toFile(targetPath);
            fs.unlinkSync(tempPath);
        } else {
            // Save video/other files directly
            fs.renameSync(tempPath, targetPath);
        }

        // Record locally in database tracking index
        await pool.query('INSERT INTO media_library (filepath, filename) VALUES ($1, $2)', [dbPath, targetFilename]);

        res.json({ url: dbPath });
    } catch (err) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        console.error('File transformation failed:', err);
        res.status(500).json({ error: 'File optimization pipeline failed.' });
    }
});

// Safe Disk-Removal Endpoint (Ignores ENOENT to prevent 400 bad requests on ephemeral wipes)
app.delete(['/api/media/:id'], authenticateToken, async (req, res) => {
    const mediaId = req.params.id;
    try {
        const mediaCheck = await pool.query('SELECT * FROM media_library WHERE id = $1', [mediaId]);
        if (mediaCheck.rows.length === 0) {
            return res.status(404).json({ error: "Media asset not found in database." });
        }

        const filePath = path.join(__dirname, 'public', mediaCheck.rows[0].filepath);

        // Safe Disk Check
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (unlinkErr) {
                console.warn(`File could not be unlinked on disk: ${filePath}`, unlinkErr);
            }
        } else {
            console.log(`File was missing from Render ephemeral storage: ${filePath}`);
        }

        await pool.query('DELETE FROM media_library WHERE id = $1', [mediaId]);
        res.json({ success: true, message: "Media asset successfully cleared." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Wildcard client redirect back to CMS Index HTML
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`South Wind cms core pipeline executing on port ${PORT}`);
});
