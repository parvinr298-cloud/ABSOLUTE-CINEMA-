const router = require('express').Router();
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
    const db = req.app.get('db');
    try {
        const result = await db.query('SELECT * FROM team_members ORDER BY display_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    const db = req.app.get('db');
    const { name, position, description, image_path, display_order } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO team_members (name, position, description, image_path, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, position, description || '', image_path, display_order || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    const { name, position, description, image_path, display_order } = req.body;
    try {
        const result = await db.query(
            'UPDATE team_members SET name=$1, position=$2, description=$3, image_path=$4, display_order=$5 WHERE id=$6 RETURNING *',
            [name, position, description || '', image_path, display_order || 0, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('DELETE FROM team_members WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;