# MISSION_PRD.md — Adaptive Learning Assistant

> **Codename:** SprintLearn  
> **Version:** 1.0.0  
> **Last Updated:** 2026-04-25  
> **Author:** AI Solutions Architecture Team  
> **Status:** DRAFT — Hackathon Submission Target

---

## 1. Problem Statement

**Create an intelligent assistant that helps users learn new concepts effectively through personalized content and adaptive pacing.**

The modern professional faces an acute knowledge-acquisition bottleneck: complex domains (cloud architecture, GTM engineering, AI/ML ops) evolve faster than traditional learning methods can deliver. Static courses, long-form tutorials, and generic Q&A fail because they ignore the learner's **current knowledge state**, **available time**, and **optimal cognitive load**.

SprintLearn solves this by delivering micro-learning sessions (≤ 5 minutes) whose difficulty, depth, and review cadence are continuously calibrated by an AI-powered Adaptive Logic Engine.

---

## 2. User Persona & Universal Idea Model

### 2.1 Primary Persona — "The Busy Professional"

| Attribute          | Detail                                                                 |
|--------------------|------------------------------------------------------------------------|
| **Name**           | Priya Sharma (archetype)                                               |
| **Role**           | Mid-senior GTM Engineer / Solutions Architect                          |
| **Age Range**      | 28–42                                                                  |
| **Core Constraint**| ≤ 5 minutes of uninterrupted focus per learning sprint                 |
| **Learning Goal**  | Master complex GTM engineering concepts (tag management, data layers, server-side tagging, consent orchestration) |
| **Pain Points**    | Information overload; no way to gauge actual understanding; forgets concepts without spaced review |
| **Device Context** | Primarily desktop browser during work; occasional mobile during commute |
| **Accessibility**  | May rely on screen readers or keyboard-only navigation                 |

### 2.2 Universal Idea Model

The system treats every learnable topic as a **Concept Node** in a directed acyclic graph (DAG):

```
ConceptNode {
  id: string (UUID)
  title: string
  domain: string                    // e.g., "GTM Engineering"
  prerequisites: ConceptNode[]      // edges in the DAG
  difficulty_tier: "beginner" | "intermediate" | "expert"
  estimated_read_time_seconds: number  // target ≤ 300
  content_variants: {
    beginner: string                // simplified explanation
    intermediate: string            // standard technical depth
    expert: string                  // advanced nuances, edge cases
  }
  assessment: {
    questions: Question[]           // 2–3 per concept
    passing_confidence: number      // 0.0–1.0 threshold
  }
}
```

- **Prerequisite edges** ensure the learner is never shown Concept B before mastering Concept A.
- **Content variants** allow the same concept to be presented at three depth levels without creating separate courses.

---

## 3. System Architecture

### 3.1 High-Level Stack

| Layer              | Technology                     | Rationale                                                       |
|--------------------|--------------------------------|-----------------------------------------------------------------|
| **Frontend**       | Vanilla HTML/CSS/JS            | Zero build-step; maximum hackathon velocity; full WCAG control  |
| **Backend**        | Node.js (Express)              | Lightweight REST API; native JSON handling; broad ecosystem     |
| **AI Engine**      | Gemini 1.5 Pro (via API)       | Long-context window for rich prompt engineering; multimodal future-proofing |
| **State Persistence** | Firebase Realtime Database  | Zero-ops; real-time sync; generous free tier                    |
| **Testing**        | Jest + jsdom                   | Unit & integration tests; 80%+ coverage target                 |
| **CI/CD**          | GitHub Actions                 | Automated lint, test, and deploy pipeline                       |

### 3.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │  UI Layer │  │ Accessibility│  │  Local Session Cache   │    │
│  │ (Vanilla) │  │   Module     │  │  (sessionStorage)      │    │
│  └────┬─────┘  └──────┬───────┘  └──────────┬─────────────┘    │
│       │               │                      │                  │
│       └───────────────┼──────────────────────┘                  │
│                       │                                         │
│               ┌───────▼────────┐                                │
│               │  API Client    │                                │
│               │  (fetch-based) │                                │
│               └───────┬────────┘                                │
└───────────────────────┼─────────────────────────────────────────┘
                        │ HTTPS (JSON)
┌───────────────────────┼─────────────────────────────────────────┐
│                 SERVER (Node.js / Express)                       │
│                       │                                         │
│  ┌────────────────────▼──────────────────────┐                  │
│  │            REST API Router                 │                  │
│  │  POST /api/session/start                   │                  │
│  │  POST /api/session/answer                  │                  │
│  │  GET  /api/session/state                   │                  │
│  │  GET  /api/concepts/:id                    │                  │
│  └───────┬───────────────────┬───────────────┘                  │
│          │                   │                                   │
│  ┌───────▼───────┐  ┌───────▼────────────┐                      │
│  │  Adaptive     │  │  Content Generator │                      │
│  │  Logic Engine │  │  (Gemini 1.5 Pro)  │                      │
│  └───────┬───────┘  └───────┬────────────┘                      │
│          │                   │                                   │
│  ┌───────▼───────────────────▼───────────┐                      │
│  │       Firebase Realtime Database       │                      │
│  │  • User Knowledge State               │                      │
│  │  • Session History                     │                      │
│  │  • Concept Graph Metadata             │                      │
│  └───────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Directory Structure (Target)

```
promptwars-pune-2026/
├── MISSION_PRD.md
├── README.md
├── package.json
├── .env.example              # template — no real keys
├── .github/
│   └── workflows/
│       └── ci.yml
├── server/
│   ├── index.js              # Express entry point
│   ├── routes/
│   │   ├── session.js
│   │   └── concepts.js
│   ├── services/
│   │   ├── adaptiveEngine.js # Adaptive Logic Engine
│   │   ├── geminiClient.js   # Gemini 1.5 Pro wrapper
│   │   └── firebaseClient.js # Firebase CRUD abstraction
│   ├── middleware/
│   │   ├── sanitize.js       # Input sanitization
│   │   └── rateLimit.js      # Basic rate limiting
│   └── utils/
│       └── validators.js
├── client/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js            # SPA controller
│   │   ├── api.js            # fetch wrapper
│   │   ├── ui.js             # DOM manipulation
│   │   └── a11y.js           # Accessibility helpers
│   └── assets/
│       └── icons/
├── tests/
│   ├── adaptiveEngine.test.js
│   ├── geminiClient.test.js
│   ├── sanitize.test.js
│   └── validators.test.js
└── docs/
    └── API.md
```

---

## 4. Adaptive Logic Engine — Detailed Design

### 4.1 Knowledge State Model

Every user–concept pair is tracked as a **Knowledge State Record (KSR)**:

```
KnowledgeStateRecord {
  user_id: string
  concept_id: string
  level: "beginner" | "intermediate" | "expert"
  confidence_score: number          // 0.00 – 1.00
  attempts: number                  // total assessment attempts
  correct_streak: number            // consecutive correct answers
  last_reviewed: ISO8601 timestamp
  next_review_due: ISO8601 timestamp  // spaced-repetition schedule
}
```

### 4.2 Confidence Score Calculation

The **Confidence Score (CS)** is a weighted rolling metric updated after every assessment interaction:

```
CS_new = (w1 × correctness) + (w2 × CS_previous) + (w3 × streak_bonus) - (w4 × time_decay)

Where:
  correctness   = 1.0 if correct, 0.0 if incorrect
  CS_previous   = last recorded confidence score (default 0.50 for new concepts)
  streak_bonus  = min(correct_streak × 0.03, 0.15)   // caps at +0.15
  time_decay    = max(0, (days_since_last_review - 3) × 0.02)  // no penalty within 3 days

Default weights:
  w1 = 0.40   // immediate performance
  w2 = 0.35   // historical competence
  w3 = 1.00   // streak multiplier (applied to bonus)
  w4 = 1.00   // decay multiplier (applied to penalty)
```

### 4.3 State Transition Rules

```
┌───────────┐    CS ≥ 0.80 for    ┌──────────────┐    CS ≥ 0.85 for    ┌──────────┐
│  BEGINNER │ ──────────────────► │ INTERMEDIATE │ ──────────────────► │  EXPERT  │
│           │    3+ attempts      │              │    3+ attempts      │          │
└─────┬─────┘                     └──────┬───────┘                     └────┬─────┘
      │                                  │                                  │
      │  CS drops below 0.40             │  CS drops below 0.50             │  CS drops below 0.60
      │  ┌───────────────────┐           │  ┌───────────────────┐           │  ┌───────────────────┐
      └─►│   REVIEW MODE     │           └─►│   REVIEW MODE     │           └─►│   REVIEW MODE     │
         │ (re-serve concept │              │ (re-serve concept │              │ (re-serve concept │
         │  at current level)│              │  at current level)│              │  at lower level)  │
         └───────────────────┘              └───────────────────┘              └───────────────────┘
```

**Decision algorithm (pseudocode):**

```
function selectNextAction(user, conceptGraph):
  // 1. Check for overdue reviews (spaced repetition)
  overdue = getOverdueReviews(user)
  if overdue.length > 0:
    return { action: "REVIEW", concept: overdue.sortByUrgency()[0] }

  // 2. Find next unlocked concept in DAG
  next = conceptGraph.getNextUnlocked(user)
  if next is null:
    return { action: "COMPLETE", message: "All concepts mastered!" }

  // 3. Determine content depth from Knowledge State
  ksr = getKnowledgeState(user, next.id)
  variant = ksr ? ksr.level : "beginner"

  // 4. Confidence-based branching
  if ksr and ksr.confidence_score < getLevelThreshold(ksr.level):
    return { action: "REVIEW", concept: next, variant: demote(variant) }
  else:
    return { action: "LEARN", concept: next, variant: variant }
```

### 4.4 Spaced Repetition Schedule

Review intervals follow a modified Leitner system:

| Correct Streak | Next Review Interval |
|----------------|----------------------|
| 1              | 1 day                |
| 2              | 3 days               |
| 3              | 7 days               |
| 4              | 14 days              |
| 5+             | 30 days              |

An incorrect answer resets the streak to `0` and schedules review in **4 hours**.

---

## 5. Evaluation Matrix — Hackathon Scoring Goals

### 5.1 Accessibility (WCAG 2.1 AA)

| Criterion                        | Implementation                                                          | Verification                        |
|----------------------------------|-------------------------------------------------------------------------|-------------------------------------|
| **Perceivable — Text Alternatives** | All images have descriptive `alt` attributes; icon buttons use `aria-label` | axe-core automated scan             |
| **Perceivable — Color Contrast** | Minimum 4.5:1 contrast ratio for normal text; 3:1 for large text       | Chrome DevTools Contrast Checker    |
| **Operable — Keyboard Navigation** | All interactive elements focusable; visible focus indicators; logical tab order | Manual keyboard-only walkthrough    |
| **Operable — Skip Navigation**   | "Skip to main content" link as first focusable element                  | Manual verification                 |
| **Understandable — Error Identification** | Form errors announced via `aria-live="assertive"` regions        | Screen reader testing (NVDA)        |
| **Understandable — Labels**      | Every `<input>` has an associated `<label>` with matching `for`/`id`    | HTML validator + axe-core           |
| **Robust — Semantic HTML**       | Proper heading hierarchy (`h1`→`h2`→`h3`); landmark roles (`<main>`, `<nav>`, `<aside>`) | axe-core + manual audit    |
| **Robust — ARIA**                | `role`, `aria-expanded`, `aria-controls` for dynamic widgets            | axe-core + screen reader testing    |

### 5.2 Testing (Jest — 80%+ Coverage Target)

| Test Category       | Files Under Test                      | Coverage Target | Key Scenarios                                                    |
|---------------------|---------------------------------------|-----------------|------------------------------------------------------------------|
| **Unit — Engine**   | `adaptiveEngine.js`                   | 90%             | State transitions; confidence score math; edge cases (NaN, negative) |
| **Unit — Sanitize** | `sanitize.js`, `validators.js`        | 95%             | XSS payloads; SQL injection strings; empty/null inputs; max-length |
| **Unit — Gemini**   | `geminiClient.js` (mocked API)        | 80%             | Successful generation; API timeout; malformed response; rate limit |
| **Unit — Firebase** | `firebaseClient.js` (mocked SDK)      | 80%             | CRUD operations; connection failure; concurrent writes            |
| **Integration**     | `routes/session.js`, `routes/concepts.js` | 75%         | End-to-end request→response; auth header validation; 400/404/500 |

**Jest Configuration Highlights:**

```json
{
  "collectCoverage": true,
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "testEnvironment": "node"
}
```

### 5.3 Security

| Threat                     | Mitigation                                                                | Implementation Detail                                       |
|----------------------------|---------------------------------------------------------------------------|-------------------------------------------------------------|
| **XSS (Cross-Site Scripting)** | Server-side input sanitization on all user inputs                     | `sanitize.js` middleware using allowlist approach; HTML entity encoding on render |
| **Injection Attacks**      | Parameterized queries; no string concatenation in Firebase paths          | Validate all IDs against UUID regex before use               |
| **Hardcoded Secrets**      | All API keys and credentials loaded from environment variables            | `.env` file excluded via `.gitignore`; `.env.example` committed with placeholder values |
| **API Key Exposure**       | Gemini API calls made server-side only; never exposed to client           | Client → Node.js → Gemini; no direct client-to-Gemini calls |
| **Rate Limiting**          | Express rate limiter on all API endpoints                                 | `rateLimit.js` middleware: 100 requests/min per IP           |
| **Dependency Vulnerabilities** | `npm audit` in CI pipeline; lock file committed                      | GitHub Actions step: `npm audit --audit-level=high`          |
| **CORS**                   | Restrictive CORS policy; only allow known origins                         | Express `cors()` with explicit origin allowlist              |
| **Content Security Policy**| CSP headers to prevent inline script injection                            | Helmet.js middleware with strict CSP directives              |

---

## 6. Google Services Integration Strategy

### 6.1 Gemini 1.5 Pro — Content Generation & Assessment

#### 6.1.1 Integration Points

| Feature                     | Gemini Role                                                               | Prompt Strategy                                              |
|-----------------------------|---------------------------------------------------------------------------|--------------------------------------------------------------|
| **Concept Explanation**     | Generate beginner/intermediate/expert explanations for a given topic      | System prompt defines persona + depth level; user prompt is the topic title + prerequisites context |
| **Assessment Generation**   | Create 2–3 multiple-choice or short-answer questions per concept          | Few-shot examples in system prompt; structured JSON output enforced via response schema |
| **Answer Evaluation**       | Evaluate free-text answers for correctness and provide feedback           | Rubric included in prompt; returns `{ correct: boolean, feedback: string, partial_credit: number }` |
| **Adaptive Hint Generation**| When a user answers incorrectly, generate a targeted hint (not the answer)| Chain-of-thought prompting with instruction to avoid revealing the answer directly |

#### 6.1.2 Prompt Engineering Standards

```
SYSTEM_PROMPT_TEMPLATE:
  "You are SprintLearn, an expert tutor in {domain}.
   Your current student is at the {level} level.
   
   RULES:
   1. Explain concepts in ≤ 250 words.
   2. Use exactly ONE real-world analogy.
   3. If level is 'beginner', avoid jargon; define any technical term used.
   4. If level is 'expert', include edge cases and common pitfalls.
   5. End with a single-sentence summary.
   6. Output valid JSON matching the provided schema."
```

#### 6.1.3 API Configuration

```javascript
// geminiClient.js — Configuration
const MODEL = "gemini-1.5-pro";
const GENERATION_CONFIG = {
  temperature: 0.4,          // lower for factual accuracy
  topP: 0.85,
  topK: 40,
  maxOutputTokens: 1024,
  responseMimeType: "application/json"
};
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
];
```

#### 6.1.4 Error Handling & Fallbacks

| Failure Mode             | Detection                              | Fallback                                                     |
|--------------------------|----------------------------------------|--------------------------------------------------------------|
| API timeout (>10s)       | Axios/fetch timeout config             | Serve pre-cached static content for the concept              |
| Rate limit (429)         | HTTP status code check                 | Exponential backoff (1s, 2s, 4s); max 3 retries             |
| Safety filter triggered  | `finishReason: "SAFETY"`              | Serve static content; log for manual review                  |
| Malformed JSON response  | JSON.parse try/catch                   | Retry once with stricter schema instruction; then static fallback |

### 6.2 Firebase Realtime Database — State Persistence

#### 6.2.1 Data Schema

```
firebase-root/
├── users/
│   └── {user_id}/
│       ├── profile/
│       │   ├── display_name: string
│       │   ├── created_at: ISO8601
│       │   └── preferences/
│       │       ├── theme: "light" | "dark"
│       │       └── session_duration_target: number (seconds)
│       ├── knowledge_state/
│       │   └── {concept_id}/
│       │       ├── level: "beginner" | "intermediate" | "expert"
│       │       ├── confidence_score: number
│       │       ├── attempts: number
│       │       ├── correct_streak: number
│       │       ├── last_reviewed: ISO8601
│       │       └── next_review_due: ISO8601
│       └── session_history/
│           └── {session_id}/
│               ├── started_at: ISO8601
│               ├── ended_at: ISO8601
│               ├── concepts_covered: string[]
│               └── score_summary: { correct: number, total: number }
├── concepts/
│   └── {concept_id}/
│       ├── title: string
│       ├── domain: string
│       ├── difficulty_tier: string
│       ├── prerequisites: string[]
│       ├── estimated_read_time_seconds: number
│       └── static_fallback_content/
│           ├── beginner: string
│           ├── intermediate: string
│           └── expert: string
└── metadata/
    ├── concept_count: number
    └── last_updated: ISO8601
```

#### 6.2.2 Security Rules

```json
{
  "rules": {
    "users": {
      "$user_id": {
        ".read": "auth !== null && auth.uid === $user_id",
        ".write": "auth !== null && auth.uid === $user_id",
        ".validate": "newData.hasChildren(['profile', 'knowledge_state'])"
      }
    },
    "concepts": {
      ".read": "auth !== null",
      ".write": false
    },
    "metadata": {
      ".read": true,
      ".write": false
    }
  }
}
```

#### 6.2.3 Integration Pattern

```javascript
// firebaseClient.js — Abstraction Layer
class FirebaseClient {
  async getUserKnowledgeState(userId, conceptId) { /* ... */ }
  async updateKnowledgeState(userId, conceptId, ksr) { /* ... */ }
  async logSession(userId, sessionData) { /* ... */ }
  async getConceptById(conceptId) { /* ... */ }
  async getOverdueReviews(userId, currentTime) { /* ... */ }
}
```

All Firebase interactions are abstracted behind this client class to:
- Enable easy mocking in Jest tests
- Centralize error handling and retry logic
- Allow future migration to Firestore without touching business logic

---

## 7. API Contract (Summary)

### `POST /api/session/start`

Initializes a new 5-minute learning sprint.

**Request:**
```json
{ "user_id": "uuid-string" }
```

**Response:**
```json
{
  "session_id": "uuid-string",
  "first_action": {
    "type": "LEARN | REVIEW",
    "concept_id": "uuid-string",
    "variant": "beginner | intermediate | expert",
    "content": "AI-generated explanation...",
    "assessment": {
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "correct_index": 2
    }
  },
  "session_timer_seconds": 300
}
```

### `POST /api/session/answer`

Submits an answer and receives the next action.

**Request:**
```json
{
  "session_id": "uuid-string",
  "concept_id": "uuid-string",
  "answer": "string | number",
  "time_taken_seconds": 12
}
```

**Response:**
```json
{
  "result": {
    "correct": true,
    "feedback": "Great! ...",
    "new_confidence_score": 0.82,
    "level_change": null | "PROMOTED" | "REVIEW_TRIGGERED"
  },
  "next_action": { /* same shape as first_action */ } | null
}
```

### `GET /api/session/state`

Returns the user's full knowledge map for dashboard rendering.

**Query:** `?user_id=uuid-string`

**Response:**
```json
{
  "user_id": "uuid-string",
  "total_concepts": 24,
  "mastered": 8,
  "in_progress": 5,
  "not_started": 11,
  "overall_confidence": 0.67,
  "concepts": [ /* array of KSR objects */ ]
}
```

---

## 8. Non-Functional Requirements

| Requirement        | Target                                              |
|--------------------|-----------------------------------------------------|
| **Response Time**  | API responses ≤ 2s (p95), excluding Gemini latency  |
| **Gemini Latency** | ≤ 5s for content generation (with streaming fallback)|
| **Availability**   | N/A (hackathon demo); graceful degradation via static fallback content |
| **Browser Support**| Chrome 120+, Firefox 120+, Safari 17+, Edge 120+    |
| **Mobile**         | Responsive layout; minimum 320px viewport width     |
| **Bundle Size**    | No client-side build step; total JS < 50 KB         |

---

## 9. Success Metrics (Hackathon Demo)

| Metric                           | Target                              |
|----------------------------------|-------------------------------------|
| Concept delivered in ≤ 5 min     | 100% of sessions                    |
| Adaptive state transition demo   | Show beginner → intermediate live   |
| WCAG 2.1 AA violations           | 0 critical, 0 serious (axe-core)    |
| Jest coverage                    | ≥ 80% lines, branches, functions    |
| Hardcoded secrets in codebase    | 0                                   |
| Live Gemini integration          | Content generated in real-time      |
| Firebase state persists          | Refresh browser; state retained     |

---

## 10. Risks & Mitigations

| Risk                                  | Likelihood | Impact | Mitigation                                                    |
|---------------------------------------|------------|--------|---------------------------------------------------------------|
| Gemini API quota exhaustion           | Medium     | High   | Pre-cache 10 concept explanations as static fallback          |
| Firebase free tier limits             | Low        | Medium | Minimal writes; read-heavy pattern; local cache               |
| Accessibility audit reveals issues late| Medium    | High   | Integrate axe-core into CI; test continuously, not at the end |
| Scope creep during hackathon          | High       | High   | PRD is the contract; no features outside this document        |
| Gemini generates inaccurate content   | Medium     | Medium | Low temperature (0.4); domain-specific few-shot examples; human review for seed concepts |

---

## 11. Out of Scope (v1.0)

- User authentication (using simple anonymous IDs for hackathon)
- Multi-language support
- Voice-based interaction
- Collaborative/social learning features
- Custom concept authoring by end-users
- Native mobile applications
- Analytics dashboard beyond basic knowledge state view

---

## 12. Glossary

| Term                    | Definition                                                                                 |
|-------------------------|--------------------------------------------------------------------------------------------|
| **Concept Node**        | A single learnable unit in the knowledge graph                                              |
| **KSR**                 | Knowledge State Record — per-user, per-concept tracking object                              |
| **Confidence Score**    | Rolling 0.0–1.0 metric representing mastery of a concept                                    |
| **Sprint**              | A single ≤ 5-minute learning session                                                        |
| **DAG**                 | Directed Acyclic Graph — prerequisite structure of concepts                                 |
| **GTM Engineering**     | Google Tag Manager Engineering — the demo domain for this assistant                         |
| **Spaced Repetition**   | Evidence-based learning technique that schedules reviews at increasing intervals             |
| **Content Variant**     | One of three depth levels (beginner/intermediate/expert) for the same concept               |

---

*This PRD serves as the single source of truth for the SprintLearn project. All implementation decisions should trace back to a requirement in this document.*
