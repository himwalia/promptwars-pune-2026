/**
 * Rate Limiting Middleware
 *
 * Basic in-memory rate limiter for API endpoints.
 * Default: 100 requests per minute per IP (configurable via .env).
 *
 * See MISSION_PRD.md §5.3 — Security: Rate Limiting.
 */

const rateLimitStore = new Map();

/**
 * Clean up expired entries every 5 minutes.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > (entry.windowMs || 60000)) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Express rate-limiting middleware.
 */
function rateLimiter(req, res, next) {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000;
  const maxRequests =
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;

  const clientIp = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();

  let entry = rateLimitStore.get(clientIp);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 1, windowMs };
    rateLimitStore.set(clientIp, entry);
    return next();
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return res.status(429).json({
      error: {
        message: "Too many requests. Please try again later.",
        retryAfterMs: windowMs - (now - entry.windowStart),
      },
    });
  }

  next();
}

module.exports = { rateLimiter, rateLimitStore };
