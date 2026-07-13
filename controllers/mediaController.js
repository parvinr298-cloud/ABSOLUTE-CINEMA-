const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary using Environment Variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer temporary storage 
// (Files are uploaded here temporarily and immediately deleted after sent to Cloudinary)
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
        const isVideo = req.file.mimetype.startsWith('video/');

        // Upload the temporary file straight to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(originalPath, {
            folder: 'south_wind_media',
            resource_type: isVideo ? 'video' : 'image'
        });

        // Delete the local temporary file immediately to keep server clean
        if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);

        const relativeWebPath = uploadResult.secure_url; // Cloudinary permanent URL
        const finalFilename = uploadResult.public_id.split('/').pop() + '.' + uploadResult.format;
        const finalMimeType = isVideo ? 'video/mp4' : 'image/' + uploadResult.format;
        const finalSize = uploadResult.bytes;

        const meta = await db.query(
            'INSERT INTO media_library (filename, filepath, mime_type, file_size) VALUES ($1, $2, $3, $4) RETURNING *',
            [finalFilename, relativeWebPath, finalMimeType, finalSize]
        );

        res.json({ url: relativeWebPath, dbRecord: meta.rows[0] });
    } catch (err) {
        if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
        console.error('Cloudinary upload failure:', err);
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

        const filepath = target.rows[0].filepath;

        // If it is a Cloudinary URL, delete it from Cloudinary
        if (filepath.includes('cloudinary.com')) {
            try {
                // Extract public_id using regex from URL format
                const match = filepath.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
                if (match && match[1]) {
                    const publicId = match[1];
                    const isVideo = target.rows[0].mime_type.startsWith('video/');
                    await cloudinary.uploader.destroy(publicId, {
                        resource_type: isVideo ? 'video' : 'image'
                    });
                }
            } catch (cloudinaryErr) {
                console.warn('Failed to delete asset from Cloudinary:', cloudinaryErr.message);
            }
        } else {
            // Fallback for older local files
            const absoluteSysPath = path.join(__dirname, '../public', filepath);
            if (fs.existsSync(absoluteSysPath)) fs.unlinkSync(absoluteSysPath);
        }

        await db.query('DELETE FROM media_library WHERE id = $1', [req.params.id]);
        res.json({ success: 'Asset purged from media environment.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
