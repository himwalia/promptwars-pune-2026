/**
 * SprintLearn — Main Application Controller
 *
 * Orchestrates UI rendering, API calls, and session state.
 * Entry point loaded last in index.html.
 */

const App = {
  state: {
    userId: "local-user-" + Math.floor(Math.random() * 1000000), // Hackathon stand-in
    sessionId: null,
    currentConceptId: null,
    timerInterval: null,
    secondsRemaining: 300,
    startTime: 0,
    score: { correct: 0, total: 0 }
  },

  async init() {
    console.log("[SprintLearn] App initializing...");
    this.bindEvents();
    
    // Check if user has an existing session / dashboard state
    try {
      const state = await window.SprintLearnAPI.getSessionState(this.state.userId);
      window.SprintLearnUI.renderDashboard(state);
    } catch (err) {
      console.warn("Could not load initial state (expected for new users).");
    }
  },

  bindEvents() {
    // Welcome Screen
    document.getElementById("btn-start-session").addEventListener("click", () => this.startSprint());

    // Learning / Assessment
    document.getElementById("btn-submit-answer").addEventListener("click", () => this.submitAnswer());
    document.getElementById("btn-next-concept").addEventListener("click", () => this.handleNextAction());
    
    // BYOK Settings Modal
    document.getElementById("btn-settings").addEventListener("click", () => window.SprintLearnUI.openModal());
    document.getElementById("btn-modal-close").addEventListener("click", () => window.SprintLearnUI.closeModal());
    
    document.getElementById("btn-toggle-key").addEventListener("click", (e) => {
      const input = document.getElementById("gemini-key-input");
      if (input.type === "password") {
        input.type = "text";
        e.target.textContent = "Hide";
      } else {
        input.type = "password";
        e.target.textContent = "Show";
      }
    });

    document.getElementById("btn-save-key").addEventListener("click", () => {
      const val = document.getElementById("gemini-key-input").value.trim();
      if (val) {
        sessionStorage.setItem("gemini_key", val);
        window.SprintLearnUI.updateModalStatus("Key saved successfully!", "success");
      }
    });

    document.getElementById("btn-clear-key").addEventListener("click", () => {
      sessionStorage.removeItem("gemini_key");
      document.getElementById("gemini-key-input").value = "";
      window.SprintLearnUI.updateModalStatus("Key cleared.", "cleared");
    });
  },

  async startSprint() {
    try {
      window.SprintLearnUI.setLoading(true);
      const res = await window.SprintLearnAPI.startSession(this.state.userId);
      
      this.state.sessionId = res.session_id;
      this.state.secondsRemaining = res.session_timer_seconds;
      
      this.startTimer();
      window.SprintLearnUI.showView("learning");
      
      this.handleAction(res.first_action);
    } catch (err) {
      alert("Failed to start session: " + err.message);
    } finally {
      window.SprintLearnUI.setLoading(false);
    }
  },

  startTimer() {
    if (this.state.timerInterval) clearInterval(this.state.timerInterval);
    
    window.SprintLearnUI.updateTimer(this.state.secondsRemaining);
    
    this.state.timerInterval = setInterval(() => {
      this.state.secondsRemaining--;
      window.SprintLearnUI.updateTimer(this.state.secondsRemaining);
      
      if (this.state.secondsRemaining <= 0) {
        clearInterval(this.state.timerInterval);
        this.endSprint();
      }
    }, 1000);
  },

  endSprint() {
    alert("Sprint Complete! Great job.");
    window.location.reload(); // simple reset for hackathon
  },

  async submitAnswer() {
    const answerIdx = window.SprintLearnUI.selectedAnswer;
    if (answerIdx === null) return;

    this.state.score.total++;
    const timeTaken = Math.floor((Date.now() - this.state.startTime) / 1000);

    try {
      window.SprintLearnUI.setLoading(true);
      const res = await window.SprintLearnAPI.submitAnswer(
        this.state.sessionId,
        this.state.currentConceptId,
        answerIdx,
        timeTaken
      );

      if (res.result.correct) this.state.score.correct++;
      
      // Store next action for when they click "Next"
      this.state.nextAction = res.next_action;

      window.SprintLearnUI.renderFeedback(res.result);
      
      // Update sidebar
      const state = await window.SprintLearnAPI.getSessionState(this.state.userId);
      window.SprintLearnUI.renderDashboard(state, this.state.score);

    } catch (err) {
      alert("Failed to evaluate answer: " + err.message);
    } finally {
      window.SprintLearnUI.setLoading(false);
    }
  },

  handleAction(action) {
    if (!action) return;
    this.state.currentConceptId = action.concept_id;
    this.state.startTime = Date.now();
    window.SprintLearnUI.renderConcept(action);
  },

  handleNextAction() {
    if (this.state.nextAction) {
      this.handleAction(this.state.nextAction);
      this.state.nextAction = null;
    }
  }
};

// Boot
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
