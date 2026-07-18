const router = require('express').Router();
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
    const db = req.app.get('db');
    try {
        const result = await db.query('SELECT * FROM certificates ORDER BY display_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    const db = req.app.get('db');
    const { title, description, image_path, display_order } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO certificates (title, description, image_path, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description || '', image_path, display_order || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    const { title, description, image_path, display_order } = req.body;
    try {
        const result = await db.query(
            'UPDATE certificates SET title=$1, description=$2, image_path=$3, display_order=$4 WHERE id=$5 RETURNING *',
            [title, description || '', image_path, display_order || 0, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('DELETE FROM certificates WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;