// securityShield.js - FULL FILE
const crypto = require('crypto');

// 1. NEUTRALIZE THE JWT FALLBACK
// If your environment variable is missing or using the insecure default fallback, 
// we overwrite it in memory with a secure random string right at boot time.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'super_secret_fallback_key_123!') {
    console.warn("⚠️ SECURITY NOTICE: JWT_SECRET was missing or insecure. Automatically generating a cryptographically secure key for this session.");
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
}

// 2. AUTOMATIC PHONE SANITIZATION MIDDLEWARE
// Intercepts all incoming requests and cleanses the phone field before your controllers execute.
const securityShield = (req, res, next) => {
    if (req.body && req.body.phone) {
        req.body.phone = String(req.body.phone)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;");
    }
    next();
};

module.exports = securityShield;
