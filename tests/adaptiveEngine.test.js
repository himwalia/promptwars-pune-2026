/**
 * Tests — Adaptive Logic Engine
 * Target: 90% coverage (see PRD §5.2)
 */

const {
  WEIGHTS,
  THRESHOLDS,
  REVIEW_INTERVALS,
  LEVEL_ORDER,
  calculateConfidenceScore,
  determineStateTransition,
  selectNextAction,
  getNextReviewDate,
  buildUpdatedKsr,
  getFallbackConcept,
  FALLBACK_CONCEPTS,
} = require("../server/services/adaptiveEngine");

// ── Constants ──────────────────────────────────────────────────────

describe("Adaptive Engine — Constants", () => {
  test("WEIGHTS should have all four weight keys", () => {
    expect(WEIGHTS).toHaveProperty("w1");
    expect(WEIGHTS).toHaveProperty("w2");
    expect(WEIGHTS).toHaveProperty("w3");
    expect(WEIGHTS).toHaveProperty("w4");
  });

  test("WEIGHTS values should match PRD specification", () => {
    expect(WEIGHTS.w1).toBe(0.40);
    expect(WEIGHTS.w2).toBe(0.35);
    expect(WEIGHTS.w3).toBe(1.00);
    expect(WEIGHTS.w4).toBe(1.00);
  });

  test("THRESHOLDS should define promote and review levels", () => {
    expect(THRESHOLDS.promote).toBeDefined();
    expect(THRESHOLDS.review).toBeDefined();
    expect(THRESHOLDS.minAttemptsForPromotion).toBe(3);
  });

  test("THRESHOLDS promote values should match PRD", () => {
    expect(THRESHOLDS.promote.beginner).toBe(0.80);
    expect(THRESHOLDS.promote.intermediate).toBe(0.85);
  });

  test("THRESHOLDS review values should match PRD", () => {
    expect(THRESHOLDS.review.beginner).toBe(0.40);
    expect(THRESHOLDS.review.intermediate).toBe(0.50);
    expect(THRESHOLDS.review.expert).toBe(0.60);
  });

  test("REVIEW_INTERVALS should define intervals for streaks 1–5", () => {
    expect(REVIEW_INTERVALS[1]).toBe(1);
    expect(REVIEW_INTERVALS[2]).toBe(3);
    expect(REVIEW_INTERVALS[3]).toBe(7);
    expect(REVIEW_INTERVALS[4]).toBe(14);
    expect(REVIEW_INTERVALS[5]).toBe(30);
  });

  test("LEVEL_ORDER should be beginner → intermediate → expert", () => {
    expect(LEVEL_ORDER).toEqual(["beginner", "intermediate", "expert"]);
  });
});

// ── calculateConfidenceScore ───────────────────────────────────────

describe("calculateConfidenceScore", () => {
  test("correct answer with no history should produce score > 0.5", () => {
    const score = calculateConfidenceScore(1.0, 0.5, 0, 0);
    expect(score).toBeGreaterThan(0.5);
  });

  test("incorrect answer with no history should produce score < 0.5", () => {
    const score = calculateConfidenceScore(0.0, 0.5, 0, 0);
    expect(score).toBeLessThan(0.5);
  });

  test("correct answer with streak should include streak bonus", () => {
    const noStreak = calculateConfidenceScore(1.0, 0.5, 0, 0);
    const withStreak = calculateConfidenceScore(1.0, 0.5, 3, 0);
    expect(withStreak).toBeGreaterThan(noStreak);
  });

  test("streak bonus should cap at 0.15 (5 streak)", () => {
    const streak5 = calculateConfidenceScore(1.0, 0.5, 5, 0);
    const streak10 = calculateConfidenceScore(1.0, 0.5, 10, 0);
    expect(streak5).toBe(streak10);
  });

  test("time decay should not apply within 3 days", () => {
    const day0 = calculateConfidenceScore(1.0, 0.5, 0, 0);
    const day3 = calculateConfidenceScore(1.0, 0.5, 0, 3);
    expect(day0).toBe(day3);
  });

  test("time decay should apply after 3 days", () => {
    const day3 = calculateConfidenceScore(1.0, 0.5, 0, 3);
    const day10 = calculateConfidenceScore(1.0, 0.5, 0, 10);
    expect(day10).toBeLessThan(day3);
  });

  test("score should be clamped to minimum 0", () => {
    const score = calculateConfidenceScore(0.0, 0.0, 0, 100);
    expect(score).toBe(0);
  });

  test("score should be clamped to maximum 1", () => {
    const score = calculateConfidenceScore(1.0, 1.0, 10, 0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test("should handle NaN correctness gracefully", () => {
    const score = calculateConfidenceScore(NaN, 0.5, 0, 0);
    expect(typeof score).toBe("number");
    expect(Number.isNaN(score)).toBe(false);
  });

  test("should handle NaN previousCS gracefully", () => {
    const score = calculateConfidenceScore(1.0, NaN, 0, 0);
    expect(typeof score).toBe("number");
    expect(Number.isNaN(score)).toBe(false);
  });

  test("should handle NaN streak gracefully", () => {
    const score = calculateConfidenceScore(1.0, 0.5, NaN, 0);
    expect(typeof score).toBe("number");
    expect(Number.isNaN(score)).toBe(false);
  });

  test("should handle NaN daysSinceReview gracefully", () => {
    const score = calculateConfidenceScore(1.0, 0.5, 0, NaN);
    expect(typeof score).toBe("number");
    expect(Number.isNaN(score)).toBe(false);
  });

  test("formula result should match manual calculation", () => {
    // correctness=1, prev=0.6, streak=2, days=5
    // streakBonus = min(2*0.03, 0.15) = 0.06
    // timeDecay = max(0, (5-3)*0.02) = 0.04
    // raw = 0.40*1 + 0.35*0.6 + 1.00*0.06 - 1.00*0.04
    //     = 0.40 + 0.21 + 0.06 - 0.04 = 0.63
    const score = calculateConfidenceScore(1.0, 0.6, 2, 5);
    expect(score).toBeCloseTo(0.63, 2);
  });
});

// ── determineStateTransition ───────────────────────────────────────

describe("determineStateTransition", () => {
  test("beginner with high score and enough attempts should PROMOTE", () => {
    const result = determineStateTransition({
      level: "beginner",
      confidence_score: 0.85,
      attempts: 5,
    });
    expect(result.action).toBe("PROMOTE");
    expect(result.newLevel).toBe("intermediate");
  });

  test("beginner with high score but too few attempts should STAY", () => {
    const result = determineStateTransition({
      level: "beginner",
      confidence_score: 0.85,
      attempts: 2,
    });
    expect(result.action).toBe("STAY");
    expect(result.newLevel).toBe("beginner");
  });

  test("intermediate with score >= 0.85 and 3+ attempts should PROMOTE to expert", () => {
    const result = determineStateTransition({
      level: "intermediate",
      confidence_score: 0.90,
      attempts: 4,
    });
    expect(result.action).toBe("PROMOTE");
    expect(result.newLevel).toBe("expert");
  });

  test("expert should never PROMOTE (already at max)", () => {
    const result = determineStateTransition({
      level: "expert",
      confidence_score: 0.99,
      attempts: 10,
    });
    expect(result.action).not.toBe("PROMOTE");
  });

  test("beginner with low score should trigger REVIEW (stay at beginner)", () => {
    const result = determineStateTransition({
      level: "beginner",
      confidence_score: 0.30,
      attempts: 5,
    });
    expect(result.action).toBe("REVIEW");
    expect(result.newLevel).toBe("beginner");
  });

  test("intermediate with low score should REVIEW (demote to beginner)", () => {
    const result = determineStateTransition({
      level: "intermediate",
      confidence_score: 0.40,
      attempts: 5,
    });
    expect(result.action).toBe("REVIEW");
    expect(result.newLevel).toBe("beginner");
  });

  test("expert with low score should REVIEW (demote to intermediate)", () => {
    const result = determineStateTransition({
      level: "expert",
      confidence_score: 0.50,
      attempts: 5,
    });
    expect(result.action).toBe("REVIEW");
    expect(result.newLevel).toBe("intermediate");
  });

  test("mid-range score should STAY", () => {
    const result = determineStateTransition({
      level: "beginner",
      confidence_score: 0.60,
      attempts: 2,
    });
    expect(result.action).toBe("STAY");
    expect(result.newLevel).toBe("beginner");
  });

  test("score exactly at promote threshold should PROMOTE", () => {
    const result = determineStateTransition({
      level: "beginner",
      confidence_score: 0.80,
      attempts: 3,
    });
    expect(result.action).toBe("PROMOTE");
  });

  test("score exactly at review threshold should STAY (< not <=)", () => {
    // review threshold for beginner is 0.40, score 0.40 means NOT below threshold
    const result = determineStateTransition({
      level: "beginner",
      confidence_score: 0.40,
      attempts: 1,
    });
    expect(result.action).toBe("STAY");
  });
});

// ── selectNextAction ───────────────────────────────────────────────

describe("selectNextAction", () => {
  test("null KSR (new user) should return LEARN at beginner", () => {
    const result = selectNextAction(null, "some-concept-id");
    expect(result.action).toBe("LEARN");
    expect(result.variant).toBe("beginner");
    expect(result.levelChange).toBeNull();
  });

  test("KSR indicating promotion should return LEARN at next level with PROMOTED", () => {
    const result = selectNextAction(
      { level: "beginner", confidence_score: 0.85, attempts: 5 },
      "concept-1"
    );
    expect(result.action).toBe("LEARN");
    expect(result.variant).toBe("intermediate");
    expect(result.levelChange).toBe("PROMOTED");
  });

  test("KSR indicating review should return REVIEW with REVIEW_TRIGGERED", () => {
    const result = selectNextAction(
      { level: "intermediate", confidence_score: 0.30, attempts: 5 },
      "concept-1"
    );
    expect(result.action).toBe("REVIEW");
    expect(result.variant).toBe("beginner");
    expect(result.levelChange).toBe("REVIEW_TRIGGERED");
  });

  test("KSR in mid-range should return LEARN at same level, no change", () => {
    const result = selectNextAction(
      { level: "beginner", confidence_score: 0.60, attempts: 2 },
      "concept-1"
    );
    expect(result.action).toBe("LEARN");
    expect(result.variant).toBe("beginner");
    expect(result.levelChange).toBeNull();
  });
});

// ── getNextReviewDate ──────────────────────────────────────────────

describe("getNextReviewDate", () => {
  const baseDate = new Date("2026-04-25T12:00:00Z");

  test("streak 0 should schedule review in 4 hours", () => {
    const result = getNextReviewDate(0, baseDate);
    const expected = new Date(baseDate.getTime() + 4 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("streak 1 should schedule review in 1 day", () => {
    const result = getNextReviewDate(1, baseDate);
    const expected = new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("streak 2 should schedule review in 3 days", () => {
    const result = getNextReviewDate(2, baseDate);
    const expected = new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("streak 3 should schedule review in 7 days", () => {
    const result = getNextReviewDate(3, baseDate);
    const expected = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("streak 4 should schedule review in 14 days", () => {
    const result = getNextReviewDate(4, baseDate);
    const expected = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("streak 5+ should schedule review in 30 days", () => {
    const result = getNextReviewDate(5, baseDate);
    const expected = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("streak 10 (over 5) should also schedule 30 days", () => {
    const result = getNextReviewDate(10, baseDate);
    const expected = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("negative streak should schedule 4-hour review", () => {
    const result = getNextReviewDate(-1, baseDate);
    const expected = new Date(baseDate.getTime() + 4 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  test("should return a valid ISO8601 string", () => {
    const result = getNextReviewDate(1);
    expect(new Date(result).toISOString()).toBe(result);
  });
});

// ── buildUpdatedKsr ────────────────────────────────────────────────

describe("buildUpdatedKsr", () => {
  test("first correct answer should create a new KSR with streak 1", () => {
    const result = buildUpdatedKsr(null, true);
    expect(result.level).toBe("beginner");
    expect(result.correct_streak).toBe(1);
    expect(result.attempts).toBe(1);
    expect(result.confidence_score).toBeGreaterThan(0.5);
    expect(result.last_reviewed).toBeDefined();
    expect(result.next_review_due).toBeDefined();
  });

  test("first incorrect answer should create KSR with streak 0", () => {
    const result = buildUpdatedKsr(null, false);
    expect(result.correct_streak).toBe(0);
    expect(result.attempts).toBe(1);
    expect(result.confidence_score).toBeLessThan(0.5);
  });

  test("correct answer should increment streak", () => {
    const existing = {
      level: "beginner",
      confidence_score: 0.6,
      attempts: 3,
      correct_streak: 2,
      last_reviewed: new Date().toISOString(),
    };
    const result = buildUpdatedKsr(existing, true);
    expect(result.correct_streak).toBe(3);
    expect(result.attempts).toBe(4);
  });

  test("incorrect answer should reset streak to 0", () => {
    const existing = {
      level: "beginner",
      confidence_score: 0.7,
      attempts: 5,
      correct_streak: 4,
      last_reviewed: new Date().toISOString(),
    };
    const result = buildUpdatedKsr(existing, false);
    expect(result.correct_streak).toBe(0);
  });

  test("high enough score should trigger PROMOTE transition", () => {
    const existing = {
      level: "beginner",
      confidence_score: 0.85,
      attempts: 3,
      correct_streak: 3,
      last_reviewed: new Date().toISOString(),
    };
    const result = buildUpdatedKsr(existing, true);
    // After a correct answer at 0.85 with streak 4, score will rise
    // and with 4 attempts >= 3, should promote
    expect(result._transition).toBe("PROMOTE");
    expect(result.level).toBe("intermediate");
  });

  test("_transition field should be present", () => {
    const result = buildUpdatedKsr(null, true);
    expect(["PROMOTE", "REVIEW", "STAY"]).toContain(result._transition);
  });
});

// ── getFallbackConcept ─────────────────────────────────────────────

describe("getFallbackConcept", () => {
  test("should return beginner fallback by default", () => {
    const concept = getFallbackConcept();
    expect(concept.difficulty_tier).toBe("beginner");
  });

  test("should return intermediate fallback", () => {
    const concept = getFallbackConcept("intermediate");
    expect(concept.difficulty_tier).toBe("intermediate");
  });

  test("should return expert fallback", () => {
    const concept = getFallbackConcept("expert");
    expect(concept.difficulty_tier).toBe("expert");
  });

  test("should fall back to beginner for unknown level", () => {
    const concept = getFallbackConcept("master");
    expect(concept.difficulty_tier).toBe("beginner");
  });

  test("fallback concept should have valid content structure", () => {
    const concept = getFallbackConcept("beginner");
    expect(concept.content.explanation).toBeDefined();
    expect(concept.content.question).toBeDefined();
    expect(concept.content.options).toHaveLength(4);
    expect(typeof concept.content.correct_index).toBe("number");
  });

  test("FALLBACK_CONCEPTS should have 3 concepts", () => {
    expect(FALLBACK_CONCEPTS).toHaveLength(3);
  });
});
