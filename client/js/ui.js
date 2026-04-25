/**
 * SprintLearn — UI Module
 *
 * Pure DOM manipulation functions. No business logic here.
 * All functions take data and render it into the DOM.
 */

const UI = {
  // Elements
  views: {
    welcome: document.getElementById("welcome-screen"),
    learning: document.getElementById("learning-area"),
    sidebarWelcome: document.getElementById("sidebar-welcome"),
    scoreSection: document.getElementById("score-section"),
    feedback: document.getElementById("feedback-card"),
    loading: document.getElementById("loading-overlay")
  },
  
  card: {
    badge: document.getElementById("concept-type-badge"),
    title: document.getElementById("concept-title"),
    diffDot: document.querySelector(".diff-dot"),
    diffLabel: document.getElementById("difficulty-label"),
    explanation: document.getElementById("explanation-text"),
    source: document.getElementById("concept-source"),
    sourceLabel: document.getElementById("source-label"),
    question: document.getElementById("assessment-question"),
    options: document.getElementById("options-group"),
    btnSubmit: document.getElementById("btn-submit-answer")
  },

  feedback: {
    icon: document.getElementById("feedback-icon"),
    text: document.getElementById("feedback-text"),
    meta: document.getElementById("feedback-meta"),
    btnNext: document.getElementById("btn-next-concept")
  },

  dashboard: {
    levelLabel: document.getElementById("level-label"),
    levelIcon: document.getElementById("level-icon"),
    confValue: document.getElementById("confidence-value"),
    confFill: document.getElementById("confidence-fill"),
    concProgress: document.getElementById("concepts-progress"),
    concFill: document.getElementById("concepts-fill"),
    scoreDisplay: document.getElementById("score-display")
  },

  timer: {
    container: document.getElementById("header-timer"),
    display: document.getElementById("timer-display")
  },

  modal: {
    overlay: document.getElementById("settings-modal"),
    input: document.getElementById("gemini-key-input"),
    btnToggle: document.getElementById("btn-toggle-key"),
    btnSave: document.getElementById("btn-save-key"),
    btnClear: document.getElementById("btn-clear-key"),
    status: document.getElementById("key-status")
  },

  // State
  selectedAnswer: null,

  /**
   * Switch between main views.
   */
  showView(viewName) {
    this.views.welcome.style.display = viewName === "welcome" ? "flex" : "none";
    this.views.learning.style.display = viewName === "learning" ? "flex" : "none";
    
    if (viewName === "learning") {
      this.views.sidebarWelcome.style.display = "block";
      this.views.scoreSection.style.display = "block";
      this.timer.container.style.display = "flex";
    }
  },

  /**
   * Show/hide loading overlay.
   */
  setLoading(isLoading) {
    this.views.loading.style.display = isLoading ? "flex" : "none";
  },

  /**
   * Render the concept card with explanation and options.
   */
  renderConcept(action) {
    // Reset state
    this.selectedAnswer = null;
    this.card.btnSubmit.disabled = true;
    this.views.feedback.style.display = "none";
    this.views.feedback.className = "feedback-card"; // reset classes

    // Render Type Badge
    this.card.badge.textContent = action.type;
    this.card.badge.className = `concept-badge ${action.type.toLowerCase()}`;
    
    // Render Content
    this.card.title.textContent = action.concept_title;
    this.card.explanation.textContent = action.content.explanation;
    this.card.diffLabel.textContent = action.variant;
    this.card.diffDot.className = `diff-dot ${action.variant}`;
    
    // Source attribution (if fallback)
    if (action._source === "fallback") {
      this.card.source.style.display = "flex";
      this.card.sourceLabel.textContent = "Served from offline cache (AI unavailable)";
    } else {
      this.card.source.style.display = "none";
    }

    // Render Question
    this.card.question.textContent = action.content.question;
    this.card.options.innerHTML = '<legend class="sr-only">Choose the correct answer</legend>';

    action.content.options.forEach((opt, idx) => {
      const label = document.createElement("label");
      label.className = "option-label";
      
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "assessment-option";
      input.className = "option-input";
      input.value = idx;
      
      input.addEventListener("change", () => {
        this.selectedAnswer = idx;
        this.card.btnSubmit.disabled = false;
      });

      const span = document.createElement("span");
      span.textContent = opt;

      label.appendChild(input);
      label.appendChild(span);
      this.card.options.appendChild(label);
    });

    // Announce to screen readers
    if (window.announce) {
      window.announce(`New concept: ${action.concept_title}. Level: ${action.variant}.`);
    }
    
    // Focus the title for keyboard users
    if (window.moveFocusTo) {
      window.moveFocusTo(this.card.title);
    }
  },

  /**
   * Render the feedback card after an answer.
   */
  renderFeedback(result) {
    this.views.feedback.style.display = "block";
    this.views.feedback.className = `feedback-card ${result.correct ? "correct" : "incorrect"}`;
    
    this.feedback.icon.textContent = result.correct ? "🎉" : "💡";
    this.feedback.text.textContent = result.feedback;
    
    let metaText = `Confidence Score updated to ${Math.round(result.new_confidence_score * 100)}%`;
    if (result.level_change === "PROMOTED") {
      metaText += " — You've leveled up! 🚀";
    } else if (result.level_change === "REVIEW_TRIGGERED") {
      metaText += " — Let's review the basics. 📉";
    }
    this.feedback.meta.textContent = metaText;

    // Disable all radio buttons
    const inputs = this.card.options.querySelectorAll("input");
    inputs.forEach(input => input.disabled = true);
    this.card.btnSubmit.disabled = true;

    if (window.announce) {
      window.announce(result.correct ? `Correct! ${result.feedback}` : `Incorrect. ${result.feedback}`);
    }

    // Scroll to feedback and focus next button
    this.views.feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (window.moveFocusTo) {
      setTimeout(() => window.moveFocusTo(this.feedback.btnNext), 100);
    }
  },

  /**
   * Render the sidebar dashboard.
   */
  renderDashboard(state, score) {
    // Determine overall level based on average confidence
    let overallLevel = "Beginner";
    let icon = "🌱";
    if (state.overall_confidence >= 0.8) {
      overallLevel = "Expert";
      icon = "🔥";
    } else if (state.overall_confidence >= 0.5) {
      overallLevel = "Intermediate";
      icon = "🚀";
    }

    this.dashboard.levelLabel.textContent = overallLevel;
    this.dashboard.levelIcon.textContent = icon;

    const confPct = Math.round(state.overall_confidence * 100);
    this.dashboard.confValue.textContent = `${confPct}%`;
    this.dashboard.confFill.style.width = `${confPct}%`;

    const progPct = Math.round(((state.mastered + state.in_progress) / state.total_concepts) * 100);
    this.dashboard.concProgress.textContent = `${state.mastered + state.in_progress} / ${state.total_concepts}`;
    this.dashboard.concFill.style.width = `${progPct}%`;

    if (score) {
      this.dashboard.scoreDisplay.textContent = `${score.correct} / ${score.total}`;
    }
  },

  /**
   * Update the sprint timer.
   */
  updateTimer(secondsLeft) {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    this.timer.display.textContent = `${m}:${s.toString().padStart(2, "0")}`;

    if (secondsLeft <= 60 && !this.timer.container.classList.contains("urgent")) {
      this.timer.container.classList.add("urgent");
    } else if (secondsLeft > 60) {
      this.timer.container.classList.remove("urgent");
    }
  },

  /**
   * Modal logic
   */
  openModal() {
    this.modal.overlay.style.display = "flex";
    const saved = sessionStorage.getItem("gemini_key");
    if (saved) {
      this.modal.input.value = saved;
    }
    
    // Set up trap focus
    if (window.trapFocus) {
      this._cleanupFocus = window.trapFocus(this.modal.overlay);
    }
    setTimeout(() => this.modal.input.focus(), 50);
  },

  closeModal() {
    this.modal.overlay.style.display = "none";
    if (this._cleanupFocus) this._cleanupFocus();
  },

  updateModalStatus(msg, type = "success") {
    this.modal.status.textContent = msg;
    this.modal.status.className = `key-status ${type}`;
    setTimeout(() => {
      this.modal.status.textContent = "";
    }, 3000);
  }
};

window.SprintLearnUI = UI;
