const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
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
