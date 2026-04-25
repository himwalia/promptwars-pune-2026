/**
 * Input Validators
 *
 * Pure validation functions used by routes and middleware.
 * No side effects — returns { valid: boolean, error?: string }.
 *
 * See MISSION_PRD.md §5.3 — Security: Injection Prevention.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a UUID string.
 * @param {string} id
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUUID(id) {
  if (!id || typeof id !== "string") {
    return { valid: false, error: "ID is required and must be a string." };
  }
  if (!UUID_REGEX.test(id)) {
    return { valid: false, error: "ID must be a valid UUID v1–v5." };
  }
  return { valid: true };
}

/**
 * Validate that a string is a recognised knowledge level.
 * @param {string} level
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLevel(level) {
  const allowed = ["beginner", "intermediate", "expert"];
  if (!level || !allowed.includes(level)) {
    return {
      valid: false,
      error: `Level must be one of: ${allowed.join(", ")}`,
    };
  }
  return { valid: true };
}

/**
 * Validate a confidence score (0.0 – 1.0).
 * @param {number} score
 * @returns {{ valid: boolean, error?: string }}
 */
function validateConfidenceScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return { valid: false, error: "Confidence score must be a number." };
  }
  if (score < 0 || score > 1) {
    return { valid: false, error: "Confidence score must be between 0 and 1." };
  }
  return { valid: true };
}

/**
 * Validate a non-empty string within a max length.
 * @param {string} value
 * @param {string} fieldName
 * @param {number} [maxLength=1000]
 * @returns {{ valid: boolean, error?: string }}
 */
function validateString(value, fieldName, maxLength = 1000) {
  if (!value || typeof value !== "string") {
    return { valid: false, error: `${fieldName} is required and must be a string.` };
  }
  if (value.trim().length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty.` };
  }
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must not exceed ${maxLength} characters.`,
    };
  }
  return { valid: true };
}

module.exports = {
  validateUUID,
  validateLevel,
  validateConfidenceScore,
  validateString,
  UUID_REGEX,
};
