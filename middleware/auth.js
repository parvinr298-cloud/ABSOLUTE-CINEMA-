const jwt = require('jsonwebtoken');

module.exports = async function(req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ error: 'Access Denied: Missing operational token validation headers.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access Denied: Formatted security bearer segment not located.' });
    }

    try {
        // FIXED: Added fallback secret to match server.js and prevent Render crash/corruption
        const secret = if (!process.env.JWT_SECRET) {
throw new Error('JWT_SECRET is missing in .env');
}
const JWT_SECRET = process.env.JWT_SECRET;
        const verified = jwt.verify(token, secret);
        
        // Dynamic Token Integrity check validating key mismatch sequences to track forced logs logout events
        const db = req.app.get('db');
        const userRes = await db.query('SELECT id, token_version, must_change_password FROM users WHERE id = $1', [verified.id]);
        
        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Access Denied: Logged profile sequence not available in current database system.' });
        }
        
        const systemUserDataObj = userRes.rows[0];
        
        // Assess mismatch check sequence - kicks out parallel system browsers automatically
        if (verified.token_version !== undefined && verified.token_version !== systemUserDataObj.token_version) {
            return res.status(401).json({ error: 'Session Expired: You have been signed out from this channel or updated configurations invalidate token authority structures.' });
        }

        req.user = verified;
        req.user.must_change_password = systemUserDataObj.must_change_password;
        
        // Block actions except password adjustment if forced change flag is active
        if (req.user.must_change_password && req.baseUrl + req.path !== '/api/auth/change-password') {
            return res.status(403).json({ 
                error: 'Account Restriction: Immediate administrative password reset required.', 
                must_change_password: true 
            });
        }
        next();
    } catch (err) {
        res.status(400).json({ error: 'Session Expired: System Token authorization validation signature corrupted.' });
    }
};
