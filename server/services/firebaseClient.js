/**
 * Firebase Realtime Database Client
 *
 * Abstraction layer over firebase-admin SDK.
 * All Firebase interactions go through this module to:
 * - Enable easy mocking in Jest tests
 * - Centralize error handling and retry logic
 * - Allow future migration to Firestore without touching business logic
 *
 * See MISSION_PRD.md §6.2 for data schema.
 */

const admin = require("firebase-admin");

let db = null;
let _initialized = false;

/**
 * Initialize Firebase Admin SDK.
 * Uses environment variables for credentials — no hardcoded keys.
 */
function initializeFirebase() {
  if (_initialized && admin.apps.length > 0) {
    db = admin.database();
    return db;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !databaseURL) {
    console.warn(
      "[FirebaseClient] Missing Firebase config — state persistence disabled."
    );
    return null;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL,
  });

  _initialized = true;
  db = admin.database();
  return db;
}

/**
 * Get the database instance (lazy-init).
 */
function getDb() {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

// ── User Knowledge State CRUD ──────────────────────────────────────

/**
 * Get a user's knowledge state for a specific concept.
 * @param {string} userId
 * @param {string} conceptId
 * @returns {Promise<object|null>} — KSR or null if not found
 */
async function getUserKnowledgeState(userId, conceptId) {
  const database = getDb();
  if (!database) return null;

  try {
    const ref = database.ref(`users/${userId}/knowledge_state/${conceptId}`);
    const snapshot = await ref.once("value");
    return snapshot.val();
  } catch (err) {
    console.error(
      `[FirebaseClient] getUserKnowledgeState failed: ${err.message}`
    );
    return null;
  }
}

/**
 * Update (or create) a user's knowledge state for a concept.
 * @param {string} userId
 * @param {string} conceptId
 * @param {object} ksr — Knowledge State Record fields to write
 * @returns {Promise<boolean>} — true if successful
 */
async function updateKnowledgeState(userId, conceptId, ksr) {
  const database = getDb();
  if (!database) return false;

  try {
    const ref = database.ref(`users/${userId}/knowledge_state/${conceptId}`);
    await ref.set(ksr);
    return true;
  } catch (err) {
    console.error(
      `[FirebaseClient] updateKnowledgeState failed: ${err.message}`
    );
    return false;
  }
}

/**
 * Log a completed session.
 * @param {string} userId
 * @param {object} sessionData — { session_id, started_at, ended_at, concepts_covered, score_summary }
 * @returns {Promise<boolean>}
 */
async function logSession(userId, sessionData) {
  const database = getDb();
  if (!database) return false;

  try {
    const ref = database.ref(
      `users/${userId}/session_history/${sessionData.session_id}`
    );
    await ref.set(sessionData);
    return true;
  } catch (err) {
    console.error(`[FirebaseClient] logSession failed: ${err.message}`);
    return false;
  }
}

/**
 * Get a concept by its ID from the concepts collection.
 * @param {string} conceptId
 * @returns {Promise<object|null>}
 */
async function getConceptById(conceptId) {
  const database = getDb();
  if (!database) return null;

  try {
    const ref = database.ref(`concepts/${conceptId}`);
    const snapshot = await ref.once("value");
    return snapshot.val();
  } catch (err) {
    console.error(`[FirebaseClient] getConceptById failed: ${err.message}`);
    return null;
  }
}

/**
 * Get all overdue reviews for a user.
 * @param {string} userId
 * @param {Date} [currentTime] — defaults to now
 * @returns {Promise<Array<{conceptId: string, ksr: object}>>}
 */
async function getOverdueReviews(userId, currentTime = new Date()) {
  const database = getDb();
  if (!database) return [];

  try {
    const ref = database.ref(`users/${userId}/knowledge_state`);
    const snapshot = await ref.once("value");
    const allStates = snapshot.val();

    if (!allStates) return [];

    const overdue = [];
    const nowISO = currentTime.toISOString();

    for (const [conceptId, ksr] of Object.entries(allStates)) {
      if (ksr.next_review_due && ksr.next_review_due <= nowISO) {
        overdue.push({ conceptId, ksr });
      }
    }

    // Sort by most overdue first
    overdue.sort((a, b) =>
      (a.ksr.next_review_due || "").localeCompare(b.ksr.next_review_due || "")
    );

    return overdue;
  } catch (err) {
    console.error(`[FirebaseClient] getOverdueReviews failed: ${err.message}`);
    return [];
  }
}

/**
 * Get a user's full knowledge map (all concept states).
 * @param {string} userId
 * @returns {Promise<object|null>} — map of conceptId → KSR
 */
async function getAllKnowledgeStates(userId) {
  const database = getDb();
  if (!database) return null;

  try {
    const ref = database.ref(`users/${userId}/knowledge_state`);
    const snapshot = await ref.once("value");
    return snapshot.val();
  } catch (err) {
    console.error(
      `[FirebaseClient] getAllKnowledgeStates failed: ${err.message}`
    );
    return null;
  }
}

module.exports = {
  initializeFirebase,
  getDb,
  getUserKnowledgeState,
  updateKnowledgeState,
  logSession,
  getConceptById,
  getOverdueReviews,
  getAllKnowledgeStates,
};
