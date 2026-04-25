/**
 * Tests — Rate Limiter Middleware
 */

const { rateLimiter, rateLimitStore } = require("../server/middleware/rateLimit");

describe("rateLimiter", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  function createMockReq(ip = "127.0.0.1") {
    return { ip, connection: { remoteAddress: ip } };
  }

  function createMockRes() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  }

  test("should allow requests within limit", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = jest.fn();

    rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("should track request counts per IP", () => {
    const next = jest.fn();

    // 5 requests from the same IP
    for (let i = 0; i < 5; i++) {
      rateLimiter(createMockReq("10.0.0.1"), createMockRes(), next);
    }

    expect(next).toHaveBeenCalledTimes(5);
  });

  test("should block requests over limit", () => {
    const savedMax = process.env.RATE_LIMIT_MAX_REQUESTS;
    process.env.RATE_LIMIT_MAX_REQUESTS = "3";

    const next = jest.fn();
    const ip = "10.0.0.99";

    // First 3 should pass
    for (let i = 0; i < 3; i++) {
      rateLimiter(createMockReq(ip), createMockRes(), next);
    }
    expect(next).toHaveBeenCalledTimes(3);

    // 4th should be blocked
    const res = createMockRes();
    rateLimiter(createMockReq(ip), res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining("Too many requests"),
        }),
      })
    );

    // Restore
    if (savedMax) {
      process.env.RATE_LIMIT_MAX_REQUESTS = savedMax;
    } else {
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
    }
  });

  test("different IPs should have independent limits", () => {
    const savedMax = process.env.RATE_LIMIT_MAX_REQUESTS;
    process.env.RATE_LIMIT_MAX_REQUESTS = "2";

    const next = jest.fn();

    // 2 from IP A (should pass)
    rateLimiter(createMockReq("1.1.1.1"), createMockRes(), next);
    rateLimiter(createMockReq("1.1.1.1"), createMockRes(), next);

    // 3rd from IP A (should block)
    const res = createMockRes();
    rateLimiter(createMockReq("1.1.1.1"), res, next);
    expect(res.status).toHaveBeenCalledWith(429);

    // IP B should still work
    const nextB = jest.fn();
    rateLimiter(createMockReq("2.2.2.2"), createMockRes(), nextB);
    expect(nextB).toHaveBeenCalledTimes(1);

    if (savedMax) {
      process.env.RATE_LIMIT_MAX_REQUESTS = savedMax;
    } else {
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
    }
  });

  test("should handle missing ip gracefully", () => {
    const req = { ip: undefined, connection: {} };
    const res = createMockRes();
    const next = jest.fn();

    rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
