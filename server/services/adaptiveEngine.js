/**
 * Adaptive Logic Engine
 *
 * Core intelligence of SprintLearn. Manages:
 * - Knowledge State tracking (Beginner → Intermediate → Expert)
 * - Confidence Score calculation
 * - State transition decisions
 * - Spaced repetition scheduling
 *
 * See MISSION_PRD.md §4 for full algorithm specification.
 */

/**
 * Default weights for Confidence Score calculation.
 * CS_new = (w1 × correctness) + (w2 × CS_previous) + (w3 × streak_bonus) - (w4 × time_decay)
 */
const WEIGHTS = {
  w1: 0.40, // immediate performance
  w2: 0.35, // historical competence
  w3: 1.00, // streak multiplier
  w4: 1.00, // decay multiplier
};

/**
 * Thresholds for level promotion and review triggers.
 */
const THRESHOLDS = {
  promote: {
    beginner: 0.80,
    intermediate: 0.85,
  },
  review: {
    beginner: 0.40,
    intermediate: 0.50,
    expert: 0.60,
  },
  minAttemptsForPromotion: 3,
};

/**
 * Spaced repetition intervals (in days) by correct streak count.
 */
const REVIEW_INTERVALS = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30, // 5+ uses this value
};

/**
 * Level ordering for promotion/demotion logic.
 */
const LEVEL_ORDER = ["beginner", "intermediate", "expert"];

// ── Confidence Score ────────────────────────────────────────────────

/**
 * Calculate the new confidence score after an assessment interaction.
 *
 * Formula (PRD §4.2):
 *   CS_new = (w1 × correctness) + (w2 × CS_previous) + (w3 × streak_bonus) - (w4 × time_decay)
 *
 * @param {number} correctness     — 1.0 if correct, 0.0 if incorrect
 * @param {number} previousCS      — last recorded confidence score (default 0.50)
 * @param {number} correctStreak   — consecutive correct answers
 * @param {number} daysSinceReview — days since the concept was last reviewed
 * @returns {number} — clamped between 0.0 and 1.0
 */
function calculateConfidenceScore(
  correctness,
  previousCS = 0.5,
  correctStreak = 0,
  daysSinceReview = 0
) {
  // Guard against invalid inputs
  if (typeof correctness !== "number" || Number.isNaN(correctness)) {
    correctness = 0;
  }
  if (typeof previousCS !== "number" || Number.isNaN(previousCS)) {
    previousCS = 0.5;
  }
  if (typeof correctStreak !== "number" || Number.isNaN(correctStreak)) {
    correctStreak = 0;
  }
  if (typeof daysSinceReview !== "number" || Number.isNaN(daysSinceReview)) {
    daysSinceReview = 0;
  }

  const streakBonus = Math.min(correctStreak * 0.03, 0.15);
  const timeDecay = Math.max(0, (daysSinceReview - 3) * 0.02);

  const raw =
    WEIGHTS.w1 * correctness +
    WEIGHTS.w2 * previousCS +
    WEIGHTS.w3 * streakBonus -
    WEIGHTS.w4 * timeDecay;

  // Clamp to [0, 1]
  return Math.min(1.0, Math.max(0.0, parseFloat(raw.toFixed(4))));
}

// ── State Transitions ──────────────────────────────────────────────

/**
 * Determine the next knowledge level based on the current KSR.
 *
 * Promotion rules (PRD §4.3):
 *   - beginner → intermediate:  CS ≥ 0.80 for 3+ attempts
 *   - intermediate → expert:    CS ≥ 0.85 for 3+ attempts
 *
 * Review triggers:
 *   - beginner CS < 0.40   → REVIEW at beginner
 *   - intermediate CS < 0.50 → REVIEW at beginner (demote)
 *   - expert CS < 0.60     → REVIEW at intermediate (demote)
 *
 * @param {{ level: string, confidence_score: number, attempts: number }} ksr
 * @returns {{ action: "PROMOTE"|"REVIEW"|"STAY", newLevel: string }}
 */
function determineStateTransition(ksr) {
  const { level, confidence_score, attempts } = ksr;
  const levelIndex = LEVEL_ORDER.indexOf(level);

  // Check for promotion
  if (levelIndex < LEVEL_ORDER.length - 1) {
    const promoteThreshold = THRESHOLDS.promote[level];
    if (
      promoteThreshold &&
      confidence_score >= promoteThreshold &&
      attempts >= THRESHOLDS.minAttemptsForPromotion
    ) {
      return {
        action: "PROMOTE",
        newLevel: LEVEL_ORDER[levelIndex + 1],
      };
    }
  }

  // Check for review (demotion)
  const reviewThreshold = THRESHOLDS.review[level];
  if (reviewThreshold && confidence_score < reviewThreshold) {
    const demotedLevel =
      levelIndex > 0 ? LEVEL_ORDER[levelIndex - 1] : level;
    return {
      action: "REVIEW",
      newLevel: demotedLevel,
    };
  }

  // Stay at current level
  return {
    action: "STAY",
    newLevel: level,
  };
}

// ── Spaced Repetition ──────────────────────────────────────────────

/**
 * Calculate the next review date based on the correct streak.
 * An incorrect answer (streak = 0) schedules review in 4 hours.
 *
 * @param {number} correctStreak
 * @param {Date} [fromDate] — defaults to now
 * @returns {string} — ISO8601 timestamp
 */
function getNextReviewDate(correctStreak = 0, fromDate = new Date()) {
  if (correctStreak <= 0) {
    // Incorrect answer: review in 4 hours
    const next = new Date(fromDate.getTime() + 4 * 60 * 60 * 1000);
    return next.toISOString();
  }

  const cappedStreak = Math.min(correctStreak, 5);
  const intervalDays = REVIEW_INTERVALS[cappedStreak] || 30;
  const next = new Date(
    fromDate.getTime() + intervalDays * 24 * 60 * 60 * 1000
  );
  return next.toISOString();
}

// ── Next Action Selection ──────────────────────────────────────────

/**
 * Select the next action for a user given their current knowledge state.
 *
 * Priority (PRD §4.3 pseudocode):
 *   1. Serve overdue reviews first
 *   2. Find next concept based on current level
 *   3. Confidence-based branching (review vs learn)
 *
 * @param {object|null} ksr — current KnowledgeStateRecord (null for new user)
 * @param {string} conceptId — the concept to evaluate
 * @returns {{ action: "LEARN"|"REVIEW"|"PROMOTE", variant: string, levelChange: string|null }}
 */
function selectNextAction(ksr, conceptId) {
  // New user / new concept — start at beginner
  if (!ksr) {
    return {
      action: "LEARN",
      variant: "beginner",
      levelChange: null,
    };
  }

  const transition = determineStateTransition(ksr);

  if (transition.action === "PROMOTE") {
    return {
      action: "LEARN",
      variant: transition.newLevel,
      levelChange: "PROMOTED",
    };
  }

  if (transition.action === "REVIEW") {
    return {
      action: "REVIEW",
      variant: transition.newLevel,
      levelChange: "REVIEW_TRIGGERED",
    };
  }

  // STAY — continue at current level
  return {
    action: "LEARN",
    variant: ksr.level,
    levelChange: null,
  };
}

// ── KSR Update Helper ──────────────────────────────────────────────

/**
 * Build an updated Knowledge State Record after an answer.
 *
 * @param {object|null} existingKsr — existing record or null for first attempt
 * @param {boolean} isCorrect — whether the answer was correct
 * @returns {object} — updated KSR fields
 */
function buildUpdatedKsr(existingKsr, isCorrect) {
  const now = new Date();
  const correctness = isCorrect ? 1.0 : 0.0;

  const previousCS = existingKsr ? existingKsr.confidence_score : 0.5;
  const previousStreak = existingKsr ? existingKsr.correct_streak : 0;
  const previousAttempts = existingKsr ? existingKsr.attempts : 0;
  const previousLevel = existingKsr ? existingKsr.level : "beginner";

  const newStreak = isCorrect ? previousStreak + 1 : 0;

  // Calculate days since last review
  let daysSinceReview = 0;
  if (existingKsr && existingKsr.last_reviewed) {
    const lastReviewed = new Date(existingKsr.last_reviewed);
    daysSinceReview = (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);
  }

  const newCS = calculateConfidenceScore(
    correctness,
    previousCS,
    newStreak,
    daysSinceReview
  );

  const newAttempts = previousAttempts + 1;

  // Determine if level changes
  const tempKsr = {
    level: previousLevel,
    confidence_score: newCS,
    attempts: newAttempts,
  };
  const transition = determineStateTransition(tempKsr);

  const newLevel = transition.newLevel;
  const nextReviewDate = getNextReviewDate(newStreak, now);

  return {
    level: newLevel,
    confidence_score: newCS,
    attempts: newAttempts,
    correct_streak: newStreak,
    last_reviewed: now.toISOString(),
    next_review_due: nextReviewDate,
    _transition: transition.action, // internal flag: PROMOTE | REVIEW | STAY
  };
}

// ── Default / Fallback Concept Nodes ───────────────────────────────

/**
 * Static fallback concepts used when Gemini is unavailable.
 * These are "safe" local concept nodes per PRD §6.1.4.
 */
const FALLBACK_CONCEPTS = [
  {
    id: "fallback-gtm-basics",
    title: "Google Tag Manager Basics",
    domain: "GTM Engineering",
    difficulty_tier: "beginner",
    content: {
      explanation:
        "Google Tag Manager (GTM) is a free tool from Google that lets you manage and deploy marketing tags (snippets of code) on your website or mobile app without having to modify the code directly. Think of it as a container that holds all your tracking codes in one place — like a toolbox for your website's measurement tools.",
      question: "What is the primary purpose of Google Tag Manager?",
      options: [
        "To design web pages",
        "To manage and deploy marketing tags without modifying site code",
        "To host websites",
        "To create email campaigns",
      ],
      correct_index: 1,
      difficulty: "beginner",
    },
  },
  {
    id: "fallback-data-layer",
    title: "The Data Layer",
    domain: "GTM Engineering",
    difficulty_tier: "intermediate",
    content: {
      explanation:
        "The Data Layer is a JavaScript object (array) that acts as a bridge between your website and Google Tag Manager. It temporarily holds data like page names, product details, or user actions, which GTM can then read and use to fire specific tags. Think of it as a message board where your website posts notes, and GTM reads them to decide what to do.",
      question:
        "What data structure does the Data Layer use in Google Tag Manager?",
      options: [
        "A linked list",
        "A JavaScript object (array)",
        "A SQL database table",
        "A CSS stylesheet",
      ],
      correct_index: 1,
      difficulty: "intermediate",
    },
  },
  {
    id: "fallback-server-side-tagging",
    title: "Server-Side Tagging",
    domain: "GTM Engineering",
    difficulty_tier: "expert",
    content: {
      explanation:
        "Server-Side Tagging moves tag processing from the user's browser to a server you control (via Google Cloud). This improves page load speed, enhances data security (sensitive data never reaches the client), and gives you more control over what data is sent to third-party vendors. The key trade-off is increased infrastructure cost and setup complexity.",
      question: "What is a primary benefit of server-side tagging over client-side tagging?",
      options: [
        "It is always free to use",
        "It eliminates the need for any tags",
        "It improves page load speed and data security",
        "It only works with Google Analytics",
      ],
      correct_index: 2,
      difficulty: "expert",
    },
  },
];

/**
 * Get a fallback concept by difficulty level.
 * @param {string} level — "beginner" | "intermediate" | "expert"
 * @returns {object} — fallback concept node
 */
function getFallbackConcept(level = "beginner") {
  const match = FALLBACK_CONCEPTS.find((c) => c.difficulty_tier === level);
  return match || FALLBACK_CONCEPTS[0];
}

module.exports = {
  WEIGHTS,
  THRESHOLDS,
  REVIEW_INTERVALS,
  LEVEL_ORDER,
  FALLBACK_CONCEPTS,
  calculateConfidenceScore,
  determineStateTransition,
  selectNextAction,
  getNextReviewDate,
  buildUpdatedKsr,
  getFallbackConcept,
};
