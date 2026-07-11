const router = require('express').Router();
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
    const db = req.app.get('db');
    try {
        const settings = await db.query('SELECT key, value FROM site_settings');
        const configMap = {};
        settings.rows.forEach(row => { configMap[row.key] = row.value; });
        res.json(configMap);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/update-batch', auth, async (req, res) => {
    const db = req.app.get('db');
    const updates = req.body; // Expects JSON key-value configuration payload object
    try {
        await db.query('BEGIN');
        for (const [key, value] of Object.entries(updates)) {
            await db.query(
                'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
                [key, value]
            );
        }
        await db.query('COMMIT');
        res.json({ success: 'System text settings matrix synchronized updated successfully.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
