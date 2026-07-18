const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });
    jwt.verify(token, process.env.JWT_SECRET || 'super_secret_fallback_key_123!', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// GET all certificates
router.get('/', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT * FROM certificates ORDER BY display_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new certificate
router.post('/', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');
    const { 
        title, title_en, title_bn, 
        description, description_en, description_bn, 
        image_path, display_order 
    } = req.body;

    // Map fallbacks to ensure no null parameters
    const finalTitle = title || title_en || '';
    const finalTitleEn = title_en || title || '';
    const finalTitleBn = title_bn || '';
    const finalDesc = description || description_en || '';
    const finalDescEn = description_en || description || '';
    const finalDescBn = description_bn || '';

    try {
        const result = await pool.query(
            `INSERT INTO certificates 
            (title, title_en, title_bn, description, description_en, description_bn, image_path, display_order) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [finalTitle, finalTitleEn, finalTitleBn, finalDesc, finalDescEn, finalDescBn, image_path, display_order || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE certificate
router.delete('/:id', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM certificates WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Certificate not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
