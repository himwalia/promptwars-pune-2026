/**
 * Tests — Input Sanitization
 * Target: 95% coverage (see PRD §5.2)
 */

const { sanitizeValue, sanitizeInput } = require("../server/middleware/sanitize");

describe("sanitizeValue", () => {
  test("should encode HTML angle brackets", () => {
    expect(sanitizeValue("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
    );
  });

  test("should encode ampersands", () => {
    expect(sanitizeValue("a & b")).toBe("a &amp; b");
  });

  test("should encode double quotes", () => {
    expect(sanitizeValue('he said "hello"')).toBe("he said &quot;hello&quot;");
  });

  test("should encode single quotes", () => {
    expect(sanitizeValue("it's")).toBe("it&#x27;s");
  });

  test("should encode forward slashes", () => {
    expect(sanitizeValue("path/to/file")).toBe("path&#x2F;to&#x2F;file");
  });

  test("should return numbers unchanged", () => {
    expect(sanitizeValue(42)).toBe(42);
  });

  test("should return null unchanged", () => {
    expect(sanitizeValue(null)).toBe(null);
  });

  test("should return booleans unchanged", () => {
    expect(sanitizeValue(true)).toBe(true);
  });

  test("should recursively sanitize arrays", () => {
    const input = ["<b>bold</b>", "normal", 123];
    const result = sanitizeValue(input);
    expect(result[0]).toBe("&lt;b&gt;bold&lt;&#x2F;b&gt;");
    expect(result[1]).toBe("normal");
    expect(result[2]).toBe(123);
  });

  test("should recursively sanitize nested objects", () => {
    const input = { name: "<script>", nested: { val: "a&b" } };
    const result = sanitizeValue(input);
    expect(result.name).toBe("&lt;script&gt;");
    expect(result.nested.val).toBe("a&amp;b");
  });

  test("should handle empty string", () => {
    expect(sanitizeValue("")).toBe("");
  });
});

describe("sanitizeInput middleware", () => {
  test("should sanitize req.body and call next()", () => {
    const req = {
      body: { name: "<img onerror=alert(1)>" },
      query: {},
      params: {},
    };
    const next = jest.fn();

    sanitizeInput(req, {}, next);

    expect(req.body.name).not.toContain("<");
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should handle missing body gracefully", () => {
    const req = { body: null, query: {}, params: {} };
    const next = jest.fn();

    sanitizeInput(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
