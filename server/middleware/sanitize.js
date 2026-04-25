/**
 * Input Sanitization Middleware
 *
 * Sanitizes all incoming request bodies to prevent XSS and injection attacks.
 * Uses an allowlist approach: strips HTML tags, encodes special characters.
 *
 * See MISSION_PRD.md §5.3 — Security Evaluation Matrix.
 */

/**
 * Recursively sanitize all string values in an object.
 * @param {*} value — Value to sanitize
 * @returns {*} — Sanitized value
 */
function sanitizeValue(value) {
  if (typeof value === "string") {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 */
function sanitizeInput(req, _res, next) {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
}

module.exports = { sanitizeInput, sanitizeValue };
