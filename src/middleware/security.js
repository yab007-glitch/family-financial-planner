const { error } = require('../utils/response');

/**
 * Custom rate limiter (no external dependency)
 * Tracks requests per IP and rejects if over limit
 */
const requestStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

function rateLimit(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!requestStore.has(clientIp)) {
    requestStore.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const clientData = requestStore.get(clientIp);

  // Reset if window expired
  if (now > clientData.resetTime) {
    requestStore.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  // Check limit
  if (clientData.count >= RATE_LIMIT_MAX) {
    return res.status(429).json(error('Too many requests. Please try again later.', 429));
  }

  clientData.count++;
  next();
}

/**
 * Security headers middleware (replaces helmet.js)
 */
function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
  );

  // Permissions policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  next();
}

/**
 * Input validation helpers
 */
function sanitizeString(value, maxLength = 255) {
  if (typeof value !== 'string') return String(value || '');
  return value.trim().substring(0, maxLength).replace(/[<>]/g, '');
}

function validateRequired(fields) {
  return (req, res, next) => {
    const missing = fields.filter(field => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return res.status(400).json(error(`Missing required fields: ${missing.join(', ')}`));
    }
    next();
  };
}

function sanitizeBody(allowedFields) {
  return (req, res, next) => {
    const sanitized = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] === 'number') {
          sanitized[field] = req.body[field];
        } else if (typeof req.body[field] === 'string') {
          sanitized[field] = sanitizeString(req.body[field]);
        } else {
          sanitized[field] = req.body[field];
        }
      }
    }
    req.body = sanitized;
    next();
  };
}

function validateNumber(field, min, max) {
  return (req, res, next) => {
    const value = req.body[field];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (isNaN(num)) {
        return res.status(400).json(error(`${field} must be a valid number`));
      }
      if (min !== undefined && num < min) {
        return res.status(400).json(error(`${field} must be at least ${min}`));
      }
      if (max !== undefined && num > max) {
        return res.status(400).json(error(`${field} must be at most ${max}`));
      }
      req.body[field] = num;
    }
    next();
  };
}

function validateId(paramName = 'id') {
  return (req, res, next) => {
    const id = Number(req.params[paramName]);
    if (isNaN(id) || id < 1) {
      return res.status(400).json(error(`Invalid ${paramName}`));
    }
    req.params[paramName] = id;
    next();
  };
}

/**
 * Sanitize error messages based on environment
 */
function sanitizeError(err) {
  if (process.env.NODE_ENV === 'production') {
    return 'Something went wrong. Please try again later.';
  }
  return err.message || 'Internal server error';
}

/**
 * Session secret validation
 */
function validateSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === 'dev-secret-change-me') {
    console.error('WARNING: SESSION_SECRET is not set or is using default value.');
    console.error('Please set a strong SESSION_SECRET in your .env file.');
    console.error('Run: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    return false;
  }
  return true;
}

module.exports = {
  rateLimit,
  securityHeaders,
  sanitizeString,
  validateRequired,
  sanitizeBody,
  validateNumber,
  validateId,
  sanitizeError,
  validateSessionSecret
};
