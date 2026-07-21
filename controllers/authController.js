const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = req.app.get('db');
    const { email, password } = req.body;

    try {
        const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) return res.status(400).json({ error: 'Invalid systemic access credentials.' });

        const user = userRes.rows[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: 'Invalid systemic access credentials.' });

        // Sign token version into JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                must_change_password: user.must_change_password,
                token_version: user.token_version || 0 
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, must_change_password: user.must_change_password });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/change-password', [
    auth,
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[!@#$&*])/)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Password must be at least 8 characters long, containing 1 capital letter and 1 special symbol.' });

    const db = req.app.get('db');
    const { newPassword } = req.body;

    try {
        const salt = await bcrypt.genSalt(12);
        const hashed = await bcrypt.hash(newPassword, salt);

        await db.query(
            'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
            [hashed, req.user.id]
        );
        res.json({ success: 'Administrative credentials successfully reinforced.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Added secure email change handling compatible with PUT, POST, and PATCH methods
router.route('/change-email')
    .all(auth)
    .post(changeEmailHandler)
    .put(changeEmailHandler)
    .patch(changeEmailHandler);

async function changeEmailHandler(req, res) {
    const db = req.app.get('db');
    const { newEmail } = req.body;

    if (!newEmail || !newEmail.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    try {
        const result = await db.query(
            'UPDATE users SET email = $1 WHERE id = $2',
            [newEmail, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

router.post('/kick-others', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        // Increment token version in database
        const result = await db.query(
            'UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1 RETURNING token_version, email',
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Associated user account record not located.' });
        }
        const updatedUser = result.rows[0];
        
        // Re-sign token for active browser with the updated token version
        const token = jwt.sign(
            { 
                id: req.user.id, 
                email: updatedUser.email, 
                must_change_password: req.user.must_change_password, 
                token_version: updatedUser.token_version 
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        res.json({ success: true, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/profile', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        const user = await db.query('SELECT id, email, must_change_password, token_version FROM users WHERE id = $1', [req.user.id]);
        res.json(user.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
