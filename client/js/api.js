/**
 * SprintLearn — API Client
 *
 * Fetch-based wrapper for all server API calls.
 * Centralizes error handling and response parsing.
 * Supports BYOK by reading key from sessionStorage.
 */

const API_BASE = "/api";

/**
 * Generic fetch wrapper with error handling.
 * @param {string} endpoint — relative path (e.g., "/session/start")
 * @param {object} [options] — fetch options
 * @returns {Promise<object>} — parsed JSON response
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // BYOK: Retrieve key from session storage
  const geminiKey = sessionStorage.getItem("gemini_key");
  
  const headers = { "Content-Type": "application/json" };
  if (geminiKey) {
    headers["x-api-key"] = geminiKey;
  }

  const config = {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (err) {
    console.error(`[API] ${options.method || "GET"} ${endpoint} failed:`, err.message);
    throw err;
  }
}

/**
 * Start a new learning session.
 * @param {string} userId
 */
async function startSession(userId) {
  return apiRequest("/session/start", {
    method: "POST",
    body: JSON.stringify({ user_id: userId })
  });
}

/**
 * Submit an answer and get the evaluation + next action.
 * @param {string} sessionId
 * @param {string} conceptId
 * @param {string|number} answer
 * @param {number} timeTakenSeconds
 */
async function submitAnswer(sessionId, conceptId, answer, timeTakenSeconds) {
  return apiRequest("/session/answer", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      concept_id: conceptId,
      answer: answer,
      time_taken_seconds: timeTakenSeconds
    })
  });
}

/**
 * Get the user's full knowledge map state.
 * @param {string} userId
 */
async function getSessionState(userId) {
  return apiRequest(`/session/state?user_id=${encodeURIComponent(userId)}`);
}

// Export for use in other modules
window.SprintLearnAPI = {
  startSession,
  submitAnswer,
  getSessionState
};
