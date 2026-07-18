const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// GET all team members
router.get('/', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT * FROM team_members ORDER BY display_order ASC, id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new team member
router.post('/', auth, async (req, res) => {
    const pool = req.app.get('db');
    const { 
        name, name_en, name_bn, 
        position, position_en, position_bn, 
        description, description_en, description_bn, 
        image_path, display_order 
    } = req.body;

    // Map fallbacks to ensure no null parameters
    const finalName = name || name_en || '';
    const finalNameEn = name_en || name || '';
    const finalNameBn = name_bn || '';
    const finalPos = position || position_en || '';
    const finalPosEn = position_en || position || '';
    const finalPosBn = position_bn || '';
    const finalDesc = description || description_en || '';
    const finalDescEn = description_en || description || '';
    const finalDescBn = description_bn || '';

    try {
        const result = await pool.query(
            `INSERT INTO team_members 
            (name, name_en, name_bn, position, position_en, position_bn, description, description_en, description_bn, image_path, display_order) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [finalName, finalNameEn, finalNameBn, finalPos, finalPosEn, finalPosBn, finalDesc, finalDescEn, finalDescBn, image_path, display_order || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE team member
router.delete('/:id', auth, async (req, res) => {
    const pool = req.app.get('db');
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM team_members WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Team member not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
