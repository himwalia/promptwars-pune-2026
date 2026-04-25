/**
 * Tests — Input Validators
 * Target: 95% coverage (see PRD §5.2)
 */

const {
  validateUUID,
  validateLevel,
  validateConfidenceScore,
  validateString,
} = require("../server/utils/validators");

describe("validateUUID", () => {
  test("should accept a valid UUID v4", () => {
    const result = validateUUID("550e8400-e29b-41d4-a716-446655440000");
    expect(result.valid).toBe(true);
  });

  test("should reject an empty string", () => {
    const result = validateUUID("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("should reject null", () => {
    const result = validateUUID(null);
    expect(result.valid).toBe(false);
  });

  test("should reject a non-UUID string", () => {
    const result = validateUUID("not-a-uuid");
    expect(result.valid).toBe(false);
  });

  test("should reject a number", () => {
    const result = validateUUID(12345);
    expect(result.valid).toBe(false);
  });
});

describe("validateLevel", () => {
  test.each(["beginner", "intermediate", "expert"])(
    "should accept '%s'",
    (level) => {
      expect(validateLevel(level).valid).toBe(true);
    }
  );

  test("should reject an invalid level", () => {
    expect(validateLevel("master").valid).toBe(false);
  });

  test("should reject null", () => {
    expect(validateLevel(null).valid).toBe(false);
  });

  test("should reject empty string", () => {
    expect(validateLevel("").valid).toBe(false);
  });
});

describe("validateConfidenceScore", () => {
  test("should accept 0", () => {
    expect(validateConfidenceScore(0).valid).toBe(true);
  });

  test("should accept 1", () => {
    expect(validateConfidenceScore(1).valid).toBe(true);
  });

  test("should accept 0.5", () => {
    expect(validateConfidenceScore(0.5).valid).toBe(true);
  });

  test("should reject negative numbers", () => {
    expect(validateConfidenceScore(-0.1).valid).toBe(false);
  });

  test("should reject numbers above 1", () => {
    expect(validateConfidenceScore(1.1).valid).toBe(false);
  });

  test("should reject NaN", () => {
    expect(validateConfidenceScore(NaN).valid).toBe(false);
  });

  test("should reject strings", () => {
    expect(validateConfidenceScore("0.5").valid).toBe(false);
  });
});

describe("validateString", () => {
  test("should accept a normal string", () => {
    expect(validateString("hello", "name").valid).toBe(true);
  });

  test("should reject empty string", () => {
    expect(validateString("", "name").valid).toBe(false);
  });

  test("should reject whitespace-only string", () => {
    expect(validateString("   ", "name").valid).toBe(false);
  });

  test("should reject null", () => {
    expect(validateString(null, "name").valid).toBe(false);
  });

  test("should reject strings exceeding max length", () => {
    const long = "a".repeat(1001);
    expect(validateString(long, "name", 1000).valid).toBe(false);
  });

  test("should accept string at exactly max length", () => {
    const exact = "a".repeat(1000);
    expect(validateString(exact, "name", 1000).valid).toBe(true);
  });
});
