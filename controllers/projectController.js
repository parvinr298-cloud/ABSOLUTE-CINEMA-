const router = require('express').Router();
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
    const db = req.app.get('db');
    try {
        const listing = await db.query('SELECT * FROM projects ORDER BY display_order ASC, id DESC');
        res.json(listing.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    const db = req.app.get('db');
    const { title, category, is_featured, display_order, images, status, brochure_url } = req.body;
    try {
        const created = await db.query(
            'INSERT INTO projects (title, category, is_featured, display_order, images, status, brochure_url) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING *',
            [title, category, is_featured || false, display_order || 0, JSON.stringify(images || []), status || 'Ongoing', brochure_url || null]
        );
        res.json(created.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/reorder', auth, async (req, res) => {
    const db = req.app.get('db');
    const { orders } = req.body; // Expects structural configuration: [{ id: 1, display_order: 0 }]
    try {
        await db.query('BEGIN');
        for (const item of orders) {
            await db.query('UPDATE projects SET display_order = $1 WHERE id = $2', [item.display_order, item.id]);
        }
        await db.query('COMMIT');
        res.json({ success: 'Gallery structure configuration reordered successfully.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    const { title, category, is_featured, display_order, images, status, brochure_url } = req.body;
    try {
        const updated = await db.query(
            'UPDATE projects SET title = $1, category = $2, is_featured = $3, display_order = $4, images = $5::jsonb, status = $6, brochure_url = $7 WHERE id = $8 RETURNING *',
            [title, category, is_featured, display_order, JSON.stringify(images || []), status || 'Ongoing', brochure_url || null, req.params.id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ success: 'Project asset record terminated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================================
// APPENDED: ADVANCED PROJECT DETAILS CRUD ROUTES
// ==========================================================

router.patch('/:id/advanced', auth, async (req, res) => {
    const db = req.app.get('db');
    const { description, image_path, video_path, title, category, status, brochure_url } = req.body;
    try {
        const updated = await db.query(
            'UPDATE projects SET description = $1, image_path = $2, video_path = $3, title = COALESCE($4, title), category = COALESCE($5, category), status = COALESCE($6, status), brochure_url = COALESCE($7, brochure_url) WHERE id = $8 RETURNING *',
            [description, image_path, video_path, title, category, status, brochure_url, req.params.id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/details', async (req, res) => {
    const db = req.app.get('db');
    try {
        const projectRes = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (projectRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
        
        const project = projectRes.rows[0];
        const pagesRes = await db.query('SELECT * FROM project_pages WHERE project_id = $1 ORDER BY page_number ASC', [project.id]);
        const pages = pagesRes.rows;
        
        if (pages.length > 0) {
            const pageIds = pages.map(p => p.id);
            const mediaRes = await db.query('SELECT * FROM project_media WHERE page_id = ANY($1) ORDER BY display_order ASC', [pageIds]);
            pages.forEach(page => {
                page.media = mediaRes.rows.filter(m => m.page_id === page.id);
            });
        }
        
        project.pages = pages;
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/pages', auth, async (req, res) => {
    const db = req.app.get('db');
    const { page_number, title, description } = req.body;
    try {
        const created = await db.query(
            'INSERT INTO project_pages (project_id, page_number, title, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.params.id, page_number || 1, title, description]
        );
        res.json(created.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/project-pages/:pageId', auth, async (req, res) => {
    const db = req.app.get('db');
    const { page_number, title, description } = req.body;
    try {
        const updated = await db.query(
            'UPDATE project_pages SET page_number = $1, title = $2, description = $3 WHERE id = $4 RETURNING *',
            [page_number, title, description, req.params.pageId]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/project-pages/:pageId', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('DELETE FROM project_pages WHERE id = $1', [req.params.pageId]);
        res.json({ success: 'Page successfully terminated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/project-pages/:pageId/media', auth, async (req, res) => {
    const db = req.app.get('db');
    const { media_path, media_type, display_order } = req.body;
    try {
        const created = await db.query(
            'INSERT INTO project_media (page_id, media_path, media_type, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.params.pageId, media_path, media_type, display_order || 0]
        );
        res.json(created.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/project-media/:mediaId', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        await db.query('DELETE FROM project_media WHERE id = $1', [req.params.mediaId]);
        res.json({ success: 'Media successfully purged.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
