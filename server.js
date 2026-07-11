const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs'); // Added to read your schema.sql file
require('dotenv').config();

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

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
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

        // 2. Now check if the admin user exists
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
// 3. STATIC FILES & STORAGE
// ==========================================
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 4. API ROUTING
// ==========================================
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
