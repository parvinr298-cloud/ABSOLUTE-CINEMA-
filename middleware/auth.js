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
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        
        // Fetch database connection pool
        const db = req.app.get('db');
        const userCheck = await db.query('SELECT token_version, must_change_password FROM users WHERE id = $1', [req.user.id]);
        
        if (userCheck.rows.length === 0) {
            return res.status(401).json({ error: 'Access Denied: Associated account no longer exists.' });
        }
        
        const dbUser = userCheck.rows[0];
        
        // Compare token_version to prevent reuse of revoked sessions
        if ((dbUser.token_version || 0) !== (req.user.token_version || 0)) {
            return res.status(401).json({ error: 'Session Expired: This session was terminated by an external administrator or session revoker.' });
        }
        
        // Block actions except password adjustment if forced change flag is active
        if (dbUser.must_change_password && req.baseUrl + req.path !== '/api/auth/change-password') {
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
