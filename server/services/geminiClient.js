/**
 * Gemini 1.5 Pro Client
 *
 * Wraps the @google/genai SDK to provide SprintLearn-specific methods:
 * - generateConcept(topic, level, apiKey)  — explanation + assessment in one call
 * - evaluateAnswer(question, userAnswer, correctAnswer, apiKey)
 *
 * BYOK (Bring Your Own Key):
 *   getGeminiClient(apiKey) accepts an optional key. If provided it uses that,
 *   otherwise falls back to process.env.GEMINI_API_KEY.
 *
 * Includes hallucination-check / retry logic and static fallback.
 *
 * See MISSION_PRD.md §6.1 for prompt templates and configuration.
 */

const { GoogleGenerativeAI } = require("@google/genai");
const { getFallbackConcept } = require("./adaptiveEngine");

const MODEL = "gemini-1.5-pro";

const GENERATION_CONFIG = {
  temperature: 0.4,
  topP: 0.85,
  topK: 40,
  maxOutputTokens: 1024,
  responseMimeType: "application/json",
};

const SAFETY_SETTINGS = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
];

// ── System Instructions (PRD §6.1.2) ──────────────────────────────

const CONCEPT_SYSTEM_INSTRUCTION = `You are SprintLearn, an expert tutor in GTM Engineering (Google Tag Manager).
Your job is to teach concepts at a specific difficulty level.

RULES:
1. Explain the concept in ≤ 250 words.
2. Use exactly ONE real-world analogy.
3. If level is "beginner", avoid jargon; define any technical term used.
4. If level is "intermediate", use standard technical depth.
5. If level is "expert", include edge cases and common pitfalls.
6. End the explanation with a single-sentence summary.
7. Generate a multiple-choice question with exactly 4 options.
8. Mark the correct answer by its 0-based index.

You MUST return ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "explanation": "string — the concept explanation",
  "question": "string — the assessment question",
  "options": ["string", "string", "string", "string"],
  "correct_index": 0,
  "difficulty": "beginner | intermediate | expert"
}`;

const EVALUATE_SYSTEM_INSTRUCTION = `You are SprintLearn's answer evaluator.
Given a question, the user's answer, and the correct answer, evaluate the response.

RULES:
1. Determine if the user's answer is correct (boolean).
2. Provide brief, encouraging feedback (1-2 sentences).
3. If incorrect, give a hint without revealing the answer.
4. Award partial credit (0.0 to 1.0) if the answer shows partial understanding.

You MUST return ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "correct": true,
  "feedback": "string — encouraging feedback",
  "partial_credit": 0.0
}`;

// ── Client Initialization (BYOK-aware) ─────────────────────────────

/**
 * Legacy wrapper — uses env key only.
 * @returns {{ model: GenerativeModel }}
 */
function createGeminiClient() {
  return getGeminiClient();
}

/**
 * Get a configured Gemini model instance.
 * Accepts an optional BYOK apiKey; falls back to process.env.GEMINI_API_KEY.
 *
 * @param {string} [apiKey] — user-provided API key (from x-api-key header)
 * @returns {{ model: GenerativeModel, genAI: GoogleGenerativeAI }}
 */
function getGeminiClient(apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: GENERATION_CONFIG,
    safetySettings: SAFETY_SETTINGS,
  });

  return { model, genAI };
}

// ── JSON Validation Helpers ────────────────────────────────────────

/**
 * Validate that a parsed concept response has the required shape.
 * @param {object} data — parsed JSON from Gemini
 * @returns {boolean}
 */
function isValidConceptResponse(data) {
  if (!data || typeof data !== "object") return false;
  return (
    typeof data.explanation === "string" &&
    data.explanation.length > 0 &&
    typeof data.question === "string" &&
    data.question.length > 0 &&
    Array.isArray(data.options) &&
    data.options.length === 4 &&
    data.options.every((o) => typeof o === "string" && o.length > 0) &&
    typeof data.correct_index === "number" &&
    data.correct_index >= 0 &&
    data.correct_index <= 3 &&
    typeof data.difficulty === "string"
  );
}

/**
 * Validate that a parsed evaluation response has the required shape.
 * @param {object} data — parsed JSON from Gemini
 * @returns {boolean}
 */
function isValidEvalResponse(data) {
  if (!data || typeof data !== "object") return false;
  return (
    typeof data.correct === "boolean" &&
    typeof data.feedback === "string" &&
    data.feedback.length > 0 &&
    typeof data.partial_credit === "number" &&
    data.partial_credit >= 0 &&
    data.partial_credit <= 1
  );
}

/**
 * Safely parse a JSON string, returning null on failure.
 * Handles cases where Gemini wraps JSON in markdown code blocks.
 * @param {string} text
 * @returns {object|null}
 */
function safeJsonParse(text) {
  if (!text || typeof text !== "string") return null;

  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── Core API Methods ───────────────────────────────────────────────

/**
 * Generate a concept explanation + assessment question via Gemini.
 *
 * Includes hallucination check: validates JSON schema, retries once,
 * then falls back to a static local concept node.
 *
 * @param {string} topic — concept title / topic to teach
 * @param {string} level — "beginner" | "intermediate" | "expert"
 * @param {object} [modelOverride] — optional { model } instance (for testing)
 * @param {string} [apiKey] — optional BYOK key
 * @returns {Promise<object>} — { explanation, question, options, correct_index, difficulty, _source }
 */
async function generateConcept(topic, level = "beginner", modelOverride = null, apiKey = null) {
  const userPrompt = `Teach the following concept at the "${level}" level:\n\nTopic: ${topic}`;

  const attempt = async (model) => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: CONCEPT_SYSTEM_INSTRUCTION }] },
    });

    const response = result.response;

    // Check for safety filter block
    if (
      response.candidates &&
      response.candidates[0] &&
      response.candidates[0].finishReason === "SAFETY"
    ) {
      throw new Error("SAFETY_FILTER_TRIGGERED");
    }

    const text = response.text();
    const parsed = safeJsonParse(text);

    if (!parsed || !isValidConceptResponse(parsed)) {
      throw new Error("MALFORMED_RESPONSE");
    }

    return { ...parsed, _source: "gemini" };
  };

  try {
    const { model } = modelOverride || getGeminiClient(apiKey);
    return await attempt(model);
  } catch (firstError) {
    console.warn(
      `[GeminiClient] First attempt failed (${firstError.message}). Retrying once...`
    );

    // Retry once (hallucination check — PRD §6.1.4)
    try {
      const { model } = modelOverride || getGeminiClient(apiKey);
      return await attempt(model);
    } catch (retryError) {
      console.error(
        `[GeminiClient] Retry failed (${retryError.message}). Falling back to static content.`
      );

      // Fallback to local concept node
      const fallback = getFallbackConcept(level);
      return {
        explanation: fallback.content.explanation,
        question: fallback.content.question,
        options: fallback.content.options,
        correct_index: fallback.content.correct_index,
        difficulty: fallback.content.difficulty,
        _source: "fallback",
      };
    }
  }
}

/**
 * Evaluate a user's answer via Gemini.
 *
 * Falls back to simple string matching if Gemini is unavailable.
 *
 * @param {string} question — the original question
 * @param {string|number} userAnswer — the user's answer (text or option index)
 * @param {string|number} correctAnswer — the correct answer (text or option index)
 * @param {object} [modelOverride] — optional model instance (for testing)
 * @param {string} [apiKey] — optional BYOK key
 * @returns {Promise<object>} — { correct, feedback, partial_credit, _source }
 */
async function evaluateAnswer(
  question,
  userAnswer,
  correctAnswer,
  modelOverride = null,
  apiKey = null
) {
  const userPrompt = `Question: ${question}\nUser's answer: ${userAnswer}\nCorrect answer: ${correctAnswer}\n\nEvaluate the user's response.`;

  const attempt = async (model) => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: EVALUATE_SYSTEM_INSTRUCTION }] },
    });

    const response = result.response;
    const text = response.text();
    const parsed = safeJsonParse(text);

    if (!parsed || !isValidEvalResponse(parsed)) {
      throw new Error("MALFORMED_EVAL_RESPONSE");
    }

    return { ...parsed, _source: "gemini" };
  };

  try {
    const { model } = modelOverride || getGeminiClient(apiKey);
    return await attempt(model);
  } catch (firstError) {
    console.warn(
      `[GeminiClient] Eval first attempt failed (${firstError.message}). Retrying...`
    );

    try {
      const { model } = modelOverride || getGeminiClient(apiKey);
      return await attempt(model);
    } catch (retryError) {
      console.error(
        `[GeminiClient] Eval retry failed (${retryError.message}). Using local evaluation.`
      );

      // Local fallback: simple comparison
      const isCorrect =
        String(userAnswer).trim().toLowerCase() ===
        String(correctAnswer).trim().toLowerCase();

      return {
        correct: isCorrect,
        feedback: isCorrect
          ? "Correct! Great job."
          : "Not quite right. Review the concept and try again.",
        partial_credit: isCorrect ? 1.0 : 0.0,
        _source: "fallback",
      };
    }
  }
}

module.exports = {
  createGeminiClient,
  getGeminiClient,
  generateConcept,
  evaluateAnswer,
  MODEL,
  GENERATION_CONFIG,
  SAFETY_SETTINGS,
  CONCEPT_SYSTEM_INSTRUCTION,
  EVALUATE_SYSTEM_INSTRUCTION,
  // Exported for testing
  isValidConceptResponse,
  isValidEvalResponse,
  safeJsonParse,
};
