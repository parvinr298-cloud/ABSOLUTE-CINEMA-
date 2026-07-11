const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

router.post('/', [
    body('name').trim().notEmpty().escape(),
    body('email').isEmail().normalizeEmail(),
    body('message').trim().notEmpty().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Please check your input formatting metrics.' });

    const db = req.app.get('db');
    const { name, email, phone, message } = req.body;
    try {
        await db.query(
            'INSERT INTO messages (name, email, phone, message) VALUES ($1, $2, $3, $4)',
            [name, email, phone || null, message]
        );
        res.json({ success: 'Operational request dispatched successfully. Thank you.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        const list = await db.query('SELECT * FROM messages ORDER BY id DESC');
        res.json(list.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id/read', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('UPDATE messages SET is_read = true WHERE id = $1', [req.params.id]);
        res.json({ success: 'Message flagged as read.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
        res.json({ success: 'Communication asset thread cleaned from database storage.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
