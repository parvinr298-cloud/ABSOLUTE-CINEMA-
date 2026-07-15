const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs'); // Added to read your schema.sql file
const jwt = require('jsonwebtoken'); // Added for inline authentication
require('dotenv').config();

// 🛡️ SECURITY SHIELD ADDITION 1: Import the shield framework at boot
const securityShield = require('./securityShield');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. SECURITY & UTILITY MIDDLEWARE
// ==========================================
app.use(helmet({
    contentSecurityPolicy: false, 
}));
const allowedOrigins = ['
;
app.use(cors({
origin: allowedOrigins,
credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ SECURITY SHIELD ADDITION 2: Inject the phone payload protection filter
app.use(securityShield);

// 🔥 CRITICAL FIX FOR RENDER: Tells Express to look past Render's reverse proxy.
// This prevents one user's loop from blocking everyone or locking you out completely.
app.set('trust proxy', 1);

// Relaxed rate-limiter threshold for dashboards that execute multiple API fetches on load.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000, // Increased from 300 to 2000 to safely allow heavy internal dashboard traffic
    message: { error: 'Traffic overload from this IP. Please try again in 15 minutes.' }
});
app.use('/api/', globalLimiter);

// ==========================================
// 2. DATABASE CONFIGURATION & AUTO-BUILD
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
app.set('db', pool);

// Automatically creates your tables and admin account on startup
async function initializeDatabaseAdmin() {
    try {
        // 1. Find and run schema.sql to build the tables first
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schemaSql);
            console.log('>>> Database tables created or verified successfully from schema.sql.');
        } else {
            console.log('>>> Warning: schema.sql file not found in root directory.');
        }

        // --- AUTOMATIC SESSION UPDATE STRUCTURAL MATRIX INJECTION ---
        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;');
            console.log('>>> DB: Verified Token Session tracker parameter matrix configured.');
        } catch(colErr) {
            console.warn('>>> DB Version Verification Bypassed.');
        }

        // 2. Now check if the admin user exists
        const checkUser = await pool.query('SELECT * FROM users LIMIT 1');
        if (checkUser.rows.length === 0) {
            const defaultEmail = 'admin@example.com';
            const rawPassword = 'ChangeMe123!';
            const salt = await bcrypt.genSalt(12);
            const hashed = await bcrypt.hash(rawPassword, salt);
            
            await pool.query(
                'INSERT INTO users (email, password_hash, must_change_password, token_version) VALUES ($1, $2, true, 0)',
                [defaultEmail, hashed]
            );
            console.log('=====================================================');
            console.log('SECURITY NOTICE: Default admin account created.');
            console.log(`Login Email: ${defaultEmail}`);
            console.log(`Initial Password: ${rawPassword}`);
            console.log('=====================================================');
        }
    } catch (err) {
        console.error('Database Initial Check Error:', err.message);
    }
}
initializeDatabaseAdmin();

// ==========================================
// 3. STATIC FILES & STORAGE
// ==========================================
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 4. API ROUTING
// ==========================================

// Inline Authentication Middleware to protect deep management operations
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Missing token. Access denied.' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'super_secret_fallback_key_123!', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

// A. POST ROUTE: Add Media Asset to Page
app.post('/api/project-pages/:pageId/media', authenticateToken, async (req, res) => {
    const { pageId } = req.params;
    const { media_path, media_type, display_order } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO project_media (page_id, media_path, media_type, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [pageId, media_path, media_type || 'image', display_order || 0]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to insert page media: ' + err.message });
    }
});

// B. DELETE ROUTE: Delete Page Module (Removes linked page media first to prevent foreign key blocks)
app.delete('/api/project-pages/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Clear children from project_media first
        await pool.query('DELETE FROM project_media WHERE page_id = $1', [id]);
        
        // Delete parent page module
        const result = await pool.query('DELETE FROM project_pages WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Page module not found.' });
        }
        res.json({ success: true, message: 'Page module removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database delete execution failed: ' + err.message });
    }
});

// C. DELETE ROUTE: Delete Individual Page Media
app.delete('/api/project-media/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM project_media WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Media asset not found.' });
        }
        res.json({ success: true, message: 'Media asset removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database delete execution failed: ' + err.message });
    }
});

// Controller Routings
app.use('/api/auth', require('./controllers/authController'));
app.use('/api/content', require('./controllers/contentController'));
app.use('/api/services', require('./controllers/serviceController'));
app.use('/api/projects', require('./controllers/projectController'));
app.use('/api/messages', require('./controllers/messageController'));
app.use('/api/media', require('./controllers/mediaController'));

// ==========================================
// 5. THE FALLBACK
// ==========================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ==========================================
// 6. ENGINE START
// ==========================================
app.listen(PORT, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `>>> South Wind System Active on Port: ${PORT}`);
    console.log(`>>> Current Node Mode: ${process.env.NODE_ENV}`);
});
