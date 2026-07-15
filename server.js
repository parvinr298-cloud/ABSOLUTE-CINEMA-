const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. SECURITY & UTILITY MIDDLEWARE
// ==========================================
app.use(helmet({
    contentSecurityPolicy: false, // Compatibility for Map iframes and external icons
}));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting Protection (Protects your server from attacks)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Traffic overload from this IP. Please try again in 15 minutes.' }
});
app.use('/api/', globalLimiter);

// ==========================================
// 2. DATABASE CONFIGURATION
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
app.set('db', pool);

// Global Auto-Seeding (Creates your first Admin account automatically)
async function initializeDatabaseAdmin() {
    try {
        const checkUser = await pool.query('SELECT * FROM users LIMIT 1');
        if (checkUser.rows.length === 0) {
            const defaultEmail = 'admin@example.com';
            const rawPassword = 'ChangeMe123!';
            const salt = await bcrypt.genSalt(12);
            const hashed = await bcrypt.hash(rawPassword, salt);
            
            await pool.query(
                'INSERT INTO users (email, password_hash, must_change_password) VALUES ($1, $2, true)',
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
// 3. STATIC FILES & STORAGE (Order matters)
// ==========================================

// Route for your Admin Dashboard (/admin will look into public/admin/index.html)
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// General route for uploads/images
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// General route for the main website folder
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
// 4. API ROUTING (Mapping to your /controllers folder)
// ==========================================
app.use('/api/auth', require('./controllers/authController'));
app.use('/api/content', require('./controllers/contentController'));
app.use('/api/services', require('./controllers/serviceController'));
app.use('/api/projects', require('./controllers/projectController'));
app.use('/api/messages', require('./controllers/messageController'));
app.use('/api/media', require('./controllers/mediaController'));

// ==========================================
// 5. THE FALLBACK (Served if no route matches)
// ==========================================

// Access the dashboard via browser: yoursite.com/dashboard (optional shortcut)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// All other traffic goes to the main Landing Page
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
