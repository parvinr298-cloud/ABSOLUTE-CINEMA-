const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

// Make sharp optional for environments like Android Termux
let sharp;
try {
    sharp = require('sharp');
} catch (err) {
    console.warn('Sharp module unavailable. Image optimization will be skipped.');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const exclusiveSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'asset-' + exclusiveSuffix + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|mp4/;
        const mimeCheck = allowedTypes.test(file.mimetype);
        const extCheck = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimeCheck && extCheck) return cb(null, true);
        cb(new Error('Media file rejected. Format structural support constrained to JPEG, PNG, WEBP, or MP4 maps.'));
    },
    limits: { fileSize: 50 * 1024 * 1024 } 
});

router.post('/upload', auth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No active payload engine source detected.' });

    const db = req.app.get('db');
    const originalPath = req.file.path;
    
    try {
        let finalFilename;
        let finalMimeType;
        let finalSize;

        const isVideo = req.file.mimetype.startsWith('video/');

        // FIXED: Graceful fallback added to prevent server crashing on Render's memory limits
        if (!isVideo && sharp) {
            try {
                finalFilename = 'optimized-' + req.file.filename.split('.')[0] + '.webp';
                const optimizedPath = path.join(__dirname, '../public/uploads/', finalFilename);

                await sharp(originalPath)
                    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
                    .toFormat('webp', { quality: 82 })
                    .toFile(optimizedPath);

                if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);

                finalMimeType = 'image/webp';
                finalSize = fs.statSync(optimizedPath).size;
            } catch (sharpError) {
                console.warn("Sharp optimization bypassed due to RAM limit. Uploading original file.");
                finalFilename = req.file.filename;
                finalMimeType = req.file.mimetype;
                finalSize = req.file.size;
            }
        } else {
            finalFilename = req.file.filename;
            finalMimeType = req.file.mimetype;
            finalSize = req.file.size;
        }

        const relativeWebPath = '/uploads/' + finalFilename;
        const meta = await db.query(
            'INSERT INTO media_library (filename, filepath, mime_type, file_size) VALUES ($1, $2, $3, $4) RETURNING *',
            [finalFilename, relativeWebPath, finalMimeType, finalSize]
        );

        res.json({ url: relativeWebPath, dbRecord: meta.rows[0] });
    } catch (err) {
        if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
        res.status(500).json({ error: `Upload processing failure: ${err.message}` });
    }
});

router.get('/library', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        const catalog = await db.query('SELECT * FROM media_library ORDER BY id DESC');
        res.json(catalog.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const db = req.app.get('db');
    try {
        const target = await db.query('SELECT * FROM media_library WHERE id = $1', [req.params.id]);
        if (target.rows.length === 0) return res.status(404).json({ error: 'Target asset entity record missing.' });

        const absoluteSysPath = path.join(__dirname, '../public', target.rows[0].filepath);
        if (fs.existsSync(absoluteSysPath)) fs.unlinkSync(absoluteSysPath);

        await db.query('DELETE FROM media_library WHERE id = $1', [req.params.id]);
        res.json({ success: 'Asset purged from media environment.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
