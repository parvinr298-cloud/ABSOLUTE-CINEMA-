const router = require('express').Router();
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
    const db = req.app.get('db');
    try {
        const items = await db.query('SELECT * FROM services ORDER BY display_order ASC, id ASC');
        res.json(items.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    const db = req.app.get('db');
    const { title, description, icon_class, display_order } = req.body;
    try {
        const newService = await db.query(
            'INSERT INTO services (title, description, icon_class, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, icon_class, display_order || 0]
        );
        res.json(newService.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    const { title, description, icon_class, display_order } = req.body;
    try {
        const update = await db.query(
            'UPDATE services SET title = $1, description = $2, icon_class = $3, display_order = $4 WHERE id = $5 RETURNING *',
            [title, description, icon_class, display_order, req.params.id]
        );
        res.json(update.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('DELETE FROM services WHERE id = $1', [req.params.id]);
        res.json({ success: 'Service competency deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
