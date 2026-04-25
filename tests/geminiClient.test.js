/**
 * Tests — Gemini Client
 * Target: 80% coverage (see PRD §5.2)
 * All Gemini API calls are mocked — no real API usage in tests.
 */

const {
  createGeminiClient,
  generateConcept,
  evaluateAnswer,
  MODEL,
  GENERATION_CONFIG,
  SAFETY_SETTINGS,
  CONCEPT_SYSTEM_INSTRUCTION,
  EVALUATE_SYSTEM_INSTRUCTION,
  isValidConceptResponse,
  isValidEvalResponse,
  safeJsonParse,
} = require("../server/services/geminiClient");

// ── Configuration Tests ────────────────────────────────────────────

describe("Gemini Client — Configuration", () => {
  test("MODEL should be gemini-1.5-pro", () => {
    expect(MODEL).toBe("gemini-1.5-pro");
  });

  test("GENERATION_CONFIG should use low temperature for factual accuracy", () => {
    expect(GENERATION_CONFIG.temperature).toBe(0.4);
    expect(GENERATION_CONFIG.responseMimeType).toBe("application/json");
    expect(GENERATION_CONFIG.maxOutputTokens).toBe(1024);
  });

  test("GENERATION_CONFIG should have topP and topK", () => {
    expect(GENERATION_CONFIG.topP).toBe(0.85);
    expect(GENERATION_CONFIG.topK).toBe(40);
  });

  test("SAFETY_SETTINGS should block medium and above for all categories", () => {
    expect(SAFETY_SETTINGS.length).toBeGreaterThanOrEqual(3);
    SAFETY_SETTINGS.forEach((setting) => {
      expect(setting.threshold).toBe("BLOCK_MEDIUM_AND_ABOVE");
    });
  });

  test("createGeminiClient should throw if GEMINI_API_KEY is not set", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(() => createGeminiClient()).toThrow("GEMINI_API_KEY");

    // Restore
    if (original) process.env.GEMINI_API_KEY = original;
  });

  test("CONCEPT_SYSTEM_INSTRUCTION should enforce JSON output", () => {
    expect(CONCEPT_SYSTEM_INSTRUCTION).toContain("valid JSON");
    expect(CONCEPT_SYSTEM_INSTRUCTION).toContain("explanation");
    expect(CONCEPT_SYSTEM_INSTRUCTION).toContain("question");
    expect(CONCEPT_SYSTEM_INSTRUCTION).toContain("options");
    expect(CONCEPT_SYSTEM_INSTRUCTION).toContain("correct_index");
  });

  test("EVALUATE_SYSTEM_INSTRUCTION should enforce JSON output", () => {
    expect(EVALUATE_SYSTEM_INSTRUCTION).toContain("valid JSON");
    expect(EVALUATE_SYSTEM_INSTRUCTION).toContain("correct");
    expect(EVALUATE_SYSTEM_INSTRUCTION).toContain("feedback");
    expect(EVALUATE_SYSTEM_INSTRUCTION).toContain("partial_credit");
  });
});

// ── safeJsonParse ──────────────────────────────────────────────────

describe("safeJsonParse", () => {
  test("should parse valid JSON string", () => {
    const result = safeJsonParse('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  test("should return null for invalid JSON", () => {
    expect(safeJsonParse("not json")).toBeNull();
  });

  test("should return null for null input", () => {
    expect(safeJsonParse(null)).toBeNull();
  });

  test("should return null for empty string", () => {
    expect(safeJsonParse("")).toBeNull();
  });

  test("should return null for non-string input", () => {
    expect(safeJsonParse(42)).toBeNull();
  });

  test("should strip ```json code fences", () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = safeJsonParse(input);
    expect(result).toEqual({ key: "value" });
  });

  test("should strip ``` code fences without language tag", () => {
    const input = '```\n{"key": "value"}\n```';
    const result = safeJsonParse(input);
    expect(result).toEqual({ key: "value" });
  });

  test("should handle whitespace around JSON", () => {
    const input = '   {"key": "value"}   ';
    const result = safeJsonParse(input);
    expect(result).toEqual({ key: "value" });
  });
});

// ── isValidConceptResponse ─────────────────────────────────────────

describe("isValidConceptResponse", () => {
  const validConcept = {
    explanation: "GTM is a tool...",
    question: "What is GTM?",
    options: ["A", "B", "C", "D"],
    correct_index: 1,
    difficulty: "beginner",
  };

  test("should accept a valid concept response", () => {
    expect(isValidConceptResponse(validConcept)).toBe(true);
  });

  test("should reject null", () => {
    expect(isValidConceptResponse(null)).toBe(false);
  });

  test("should reject missing explanation", () => {
    const bad = { ...validConcept, explanation: "" };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject missing question", () => {
    const bad = { ...validConcept, question: "" };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject wrong number of options", () => {
    const bad = { ...validConcept, options: ["A", "B"] };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject empty option strings", () => {
    const bad = { ...validConcept, options: ["A", "", "C", "D"] };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject non-array options", () => {
    const bad = { ...validConcept, options: "not array" };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject correct_index out of range", () => {
    const bad = { ...validConcept, correct_index: 5 };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject negative correct_index", () => {
    const bad = { ...validConcept, correct_index: -1 };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject non-number correct_index", () => {
    const bad = { ...validConcept, correct_index: "one" };
    expect(isValidConceptResponse(bad)).toBe(false);
  });

  test("should reject missing difficulty", () => {
    const bad = { ...validConcept, difficulty: 123 };
    expect(isValidConceptResponse(bad)).toBe(false);
  });
});

// ── isValidEvalResponse ────────────────────────────────────────────

describe("isValidEvalResponse", () => {
  const validEval = {
    correct: true,
    feedback: "Great job!",
    partial_credit: 1.0,
  };

  test("should accept a valid eval response", () => {
    expect(isValidEvalResponse(validEval)).toBe(true);
  });

  test("should reject null", () => {
    expect(isValidEvalResponse(null)).toBe(false);
  });

  test("should reject non-boolean correct", () => {
    const bad = { ...validEval, correct: "yes" };
    expect(isValidEvalResponse(bad)).toBe(false);
  });

  test("should reject empty feedback", () => {
    const bad = { ...validEval, feedback: "" };
    expect(isValidEvalResponse(bad)).toBe(false);
  });

  test("should reject partial_credit > 1", () => {
    const bad = { ...validEval, partial_credit: 1.5 };
    expect(isValidEvalResponse(bad)).toBe(false);
  });

  test("should reject partial_credit < 0", () => {
    const bad = { ...validEval, partial_credit: -0.1 };
    expect(isValidEvalResponse(bad)).toBe(false);
  });

  test("should reject non-number partial_credit", () => {
    const bad = { ...validEval, partial_credit: "half" };
    expect(isValidEvalResponse(bad)).toBe(false);
  });
});

// ── generateConcept (mocked) ───────────────────────────────────────

describe("generateConcept — with mocked Gemini", () => {
  test("should return fallback content when Gemini model throws", async () => {
    const mockModel = {
      generateContent: jest.fn().mockRejectedValue(new Error("API_ERROR")),
    };

    const result = await generateConcept("GTM Basics", "beginner", {
      model: mockModel,
    });

    expect(result._source).toBe("fallback");
    expect(result.explanation).toBeDefined();
    expect(result.question).toBeDefined();
    expect(result.options).toHaveLength(4);
    expect(typeof result.correct_index).toBe("number");
  });

  test("should return fallback on malformed Gemini response", async () => {
    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => '{"bad": "data"}',
          candidates: [{ finishReason: "STOP" }],
        },
      }),
    };

    const result = await generateConcept("GTM Basics", "beginner", {
      model: mockModel,
    });

    // Malformed → retry → still malformed → fallback
    expect(result._source).toBe("fallback");
  });

  test("should return gemini content on valid response", async () => {
    const validResponse = JSON.stringify({
      explanation: "GTM is a tool for managing tags...",
      question: "What does GTM stand for?",
      options: [
        "Google Tag Manager",
        "Global Traffic Monitor",
        "Grouped Task Manager",
        "Generic Tracking Module",
      ],
      correct_index: 0,
      difficulty: "beginner",
    });

    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => validResponse,
          candidates: [{ finishReason: "STOP" }],
        },
      }),
    };

    const result = await generateConcept("GTM Basics", "beginner", {
      model: mockModel,
    });

    expect(result._source).toBe("gemini");
    expect(result.explanation).toContain("GTM");
    expect(result.options).toHaveLength(4);
  });

  test("should return fallback when safety filter triggers", async () => {
    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => "",
          candidates: [{ finishReason: "SAFETY" }],
        },
      }),
    };

    const result = await generateConcept("GTM Basics", "beginner", {
      model: mockModel,
    });

    expect(result._source).toBe("fallback");
  });

  test("should use correct fallback level", async () => {
    const mockModel = {
      generateContent: jest.fn().mockRejectedValue(new Error("FAIL")),
    };

    const expert = await generateConcept("Topic", "expert", {
      model: mockModel,
    });
    expect(expert.difficulty).toBe("expert");

    const beginner = await generateConcept("Topic", "beginner", {
      model: mockModel,
    });
    expect(beginner.difficulty).toBe("beginner");
  });
});

// ── evaluateAnswer (mocked) ────────────────────────────────────────

describe("evaluateAnswer — with mocked Gemini", () => {
  test("should return fallback evaluation when Gemini throws", async () => {
    const mockModel = {
      generateContent: jest.fn().mockRejectedValue(new Error("API_ERROR")),
    };

    const result = await evaluateAnswer(
      "What is GTM?",
      "Google Tag Manager",
      "Google Tag Manager",
      { model: mockModel }
    );

    expect(result._source).toBe("fallback");
    expect(result.correct).toBe(true);
    expect(result.feedback).toBeDefined();
  });

  test("fallback should detect incorrect answers", async () => {
    const mockModel = {
      generateContent: jest.fn().mockRejectedValue(new Error("API_ERROR")),
    };

    const result = await evaluateAnswer(
      "What is GTM?",
      "wrong answer",
      "Google Tag Manager",
      { model: mockModel }
    );

    expect(result._source).toBe("fallback");
    expect(result.correct).toBe(false);
    expect(result.partial_credit).toBe(0.0);
  });

  test("should return gemini evaluation on valid response", async () => {
    const validEval = JSON.stringify({
      correct: true,
      feedback: "Excellent! That's correct.",
      partial_credit: 1.0,
    });

    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => validEval,
        },
      }),
    };

    const result = await evaluateAnswer(
      "What is GTM?",
      "Google Tag Manager",
      "Google Tag Manager",
      { model: mockModel }
    );

    expect(result._source).toBe("gemini");
    expect(result.correct).toBe(true);
    expect(result.feedback).toContain("Excellent");
  });

  test("should fallback on malformed eval response", async () => {
    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => '{"bad": "response"}',
        },
      }),
    };

    const result = await evaluateAnswer(
      "Question?",
      "answer",
      "correct",
      { model: mockModel }
    );

    expect(result._source).toBe("fallback");
  });
});
