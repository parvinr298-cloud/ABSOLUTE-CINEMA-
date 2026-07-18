const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
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
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ SECURITY SHIELD ADDITION 2: Inject the phone payload protection filter
app.use(securityShield);

// Tells Express to look past the hosting provider's reverse proxy.
// This prevents rate limit blockages on external deployment configurations.
app.set('trust proxy', 1);

// Relaxed rate-limiter threshold for dashboards that execute multiple API fetches on load.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000, 
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
        // 🛡️ CRITICAL PRODUCTION FIX: Run isolated alterations first to prevent transaction rollbacks
        try {
            await pool.query('ALTER TABLE IF EXISTS certificates ALTER COLUMN title DROP NOT NULL;');
            await pool.query('ALTER TABLE IF EXISTS team_members ALTER COLUMN name DROP NOT NULL;');
            await pool.query('ALTER TABLE IF EXISTS team_members ALTER COLUMN position DROP NOT NULL;');
            console.log('>>> DB: Successfully committed dropping NOT NULL constraints on legacy columns.');
        } catch(alterErr) {
            console.warn('>>> DB Alteration Bypassed (Normal on fresh setups):', alterErr.message);
        }

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

// B1. DECK 1 ROUTE EXCLUSIVE CORRECTION candidate matching url 1
app.delete('/api/project-pages/:id', authenticateToken, async (req, res) => {
    const rawIdVal = req.params.id;
    const pageId = parseInt(rawIdVal, 10);
    
    if (isNaN(pageId)) {
        return res.status(400).json({ error: 'Page Identifier expects structured numerical inputs parsing validations.' });
    }

    try {
        console.log(`>>> CMS Routing Intercept: Page ${pageId} deletion operation authorized.`);
        
        // Remove nested/linked project-media entities dynamically inside PG schemas
        await pool.query('DELETE FROM project_media WHERE page_id = $1', [pageId]);
        
        // Purge parent page node context directly
        const result = await pool.query('DELETE FROM project_pages WHERE id = $1', [pageId]);
        
        if (result.rowCount === 0) {
            console.warn(`>>> System database warn tracking: deletion targeted inexistent row inside PG [${pageId}]`);
            return res.status(404).json({ error: 'No mapping parameters matches existing indices registries configurations list contexts database logs.' });
        }

        console.log(`>>> SUCCESS: Page record row references drops: [ID: ${pageId}] verified.`);
        return res.json({ success: true, message: 'Structure block page entries completely wiped.' });

    } catch (err) {
        console.error('API Database Processing Exceptions traces tracking error:', err);
        return res.status(500).json({ error: 'Internal system routing constraints delete execution query fail updates block: ' + err.message });
    }
});

// B2. DECK 2 ROUTE EXCLUSIVE CORRECTION matching secondary endpoint checks candidate checks
app.delete('/api/projects/pages/:id', authenticateToken, async (req, res) => {
    const rawIdVal = req.params.id;
    const pageId = parseInt(rawIdVal, 10);
    
    if (isNaN(pageId)) {
         return res.status(400).json({ error: 'Input validations missing parameters checks validation checks matches parameter errors status: Bad request id coordinates formatting' });
    }

    try {
        console.log(`>>> Alternative System Path Matching Route Candidate matched details traces for [ID: ${pageId}]`);
        await pool.query('DELETE FROM project_media WHERE page_id = $1', [pageId]);
        const result = await pool.query('DELETE FROM project_pages WHERE id = $1', [pageId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Page entries were missing under target reference details criteria checking logs checking databases parameter profiles parameters context trace failed indices validation maps checks failed.' });
        }

        console.log(`>>> Alt Cascade delete complete matching options sequences indices update logs trace parameter checks options matches successes parameters detail matches trace info options maps.`);
        return res.json({ success: true, message: 'Platform data purged safely checks parameters loops mappings success validations logs.' });

    } catch (err) {
         console.error('Secondary REST pipeline controller validation checks context loop failed:', err);
         return res.status(500).json({ error: 'Failed alt mapping deletes routines checks parameters failed trace matches contexts errors log blocks error context mapping details options checks context indices error: ' + err.message });
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
app.use('/api/certificates', require('./controllers/certificateController'));
app.use('/api/team', require('./controllers/teamController'));
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
