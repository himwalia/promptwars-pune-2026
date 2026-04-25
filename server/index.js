/**
 * SprintLearn — Server Entry Point
 *
 * Initializes Express, loads environment variables, validates required
 * configuration, and mounts route handlers.
 */

const dotenv = require("dotenv");

// ── 1. Load environment variables FIRST ─────────────────────────────
dotenv.config();

// ── 2. Check for environment variables (warn if missing — BYOK can supply) ──
const RECOMMENDED_ENV_VARS = ["GEMINI_API_KEY"];

const missing = RECOMMENDED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.warn(
    "\n⚠️  Missing recommended environment variables:"
  );
  missing.forEach((key) => {
    console.warn(`   • ${key}`);
  });
  console.warn(
    "   Users can supply their own key via the Settings (BYOK) modal.\n"
  );
}

// ── 3. Import dependencies (after env validation) ───────────────────
const express = require("express");
const path = require("path");

// Middleware
const { sanitizeInput } = require("./middleware/sanitize");
const { rateLimiter } = require("./middleware/rateLimit");

// Routes
const sessionRoutes = require("./routes/session");
const conceptRoutes = require("./routes/concepts");

// ── 4. Create Express application ──────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ── 5. Global middleware ────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(sanitizeInput);
app.use(rateLimiter);

// Serve static client files
app.use(express.static(path.join(__dirname, "..", "client")));

// ── 6. API routes ──────────────────────────────────────────────────
app.use("/api/session", sessionRoutes);
app.use("/api/concepts", conceptRoutes);

// ── 7. Health check ─────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: require("../package.json").version,
  });
});

// ── 8. Catch-all: serve client index.html for SPA routing ──────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

// ── 9. Global error handler ────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(err.status || 500).json({
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    },
  });
});

// ── 10. Start server ───────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 SprintLearn server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}\n`);
  });
}

module.exports = app;
