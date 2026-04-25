/**
 * SprintLearn — Accessibility Helpers
 *
 * Utility functions for WCAG 2.1 AA compliance:
 * - Screen reader announcements via aria-live region
 * - Focus management for dynamic content
 * - Keyboard navigation helpers
 *
 * See MISSION_PRD.md §5.1 — Accessibility Evaluation Matrix.
 */

/**
 * Announce a message to screen readers via the aria-live region.
 * @param {string} message — Text to announce
 * @param {"assertive"|"polite"} [priority="assertive"]
 */
function announce(message, priority = "assertive") {
  const announcer = document.getElementById("a11y-announcer");
  if (!announcer) return;

  announcer.setAttribute("aria-live", priority);
  // Clear first to ensure re-announcement of same text
  announcer.textContent = "";
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

/**
 * Move focus to an element, adding tabindex if needed.
 * @param {HTMLElement} element
 */
function moveFocusTo(element) {
  if (!element) return;
  if (!element.getAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
  }
  element.focus();
}

/**
 * Trap focus within a container (for modals/dialogs).
 * @param {HTMLElement} container
 * @returns {Function} cleanup — call to remove the trap
 */
function trapFocus(container) {
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handler(e) {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  container.addEventListener("keydown", handler);
  return () => container.removeEventListener("keydown", handler);
}
