/**
 * MFZ Email — Webflow field check against apiphone /email/validate
 *
 * Usage: <input type="email" data-mfz-email name="Email">
 * Also auto-binds form input[type="email"] so existing Webflow Email fields work.
 *
 * Fast local fail (syntax / demo|fake|sample|dummy|staging|noreply) shows an error
 * and blocks submit. MX / disposable go to apiphone on blur only.
 * If the API is down, slow, or rate-limited, the form still submits to Zoho.
 */
(function () {
  "use strict";

  const CONFIG = {
    apiBaseUrl: "https://apiphone.meydanfz.ae",
    apiTimeoutMs: 4000,
    debounceMs: 300,
    invalidMessage: "Please enter a valid email address",
    disposableMessage: "Please use your work or personal email",
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const BLOCKED_KEYWORDS = [
    "demo",
    "fake",
    "sample",
    "dummy",
    "staging",
    "noreply",
    "no-reply",
  ];

  const instances = new Map();
  const resultCache = new Map();

  const fetchWithTimeout = async (url, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const normalize = (value) => (value || "").trim().toLowerCase();

  const localProblem = (email) => {
    if (!EMAIL_RE.test(email) || !email.includes(".")) return "syntax";
    const local = email.slice(0, email.indexOf("@"));
    if (BLOCKED_KEYWORDS.some((kw) => local.includes(kw))) return "keyword";
    return null;
  };

  const createFeedback = (container) => {
    let feedback = container.querySelector(".mfz-email-feedback");
    if (!feedback) {
      feedback = document.createElement("div");
      feedback.className = "mfz-email-feedback";
      feedback.setAttribute("role", "alert");
      feedback.setAttribute("aria-live", "polite");
      container.appendChild(feedback);
    }
    return feedback;
  };

  const setState = (input, state, message = "") => {
    const instance = instances.get(input);
    if (!instance) return;

    const { container } = instance;
    container.classList.remove("mfz-valid", "mfz-invalid", "mfz-validating");

    if (state === "idle" || (state === "valid" && !message)) {
      const feedback = container.querySelector(".mfz-email-feedback");
      if (feedback) feedback.remove();
      if (state === "valid") container.classList.add("mfz-valid");
    } else {
      container.classList.add(`mfz-${state}`);
      const feedback = createFeedback(container);
      feedback.textContent = message;
      feedback.className = `mfz-email-feedback mfz-feedback-${state}`;
    }

    instance.isValid = state === "valid";
    instance.validationState = state;
    instance.validationMessage = message;
  };

  const validateRemote = async (email) => {
    if (resultCache.has(email)) return resultCache.get(email);

    try {
      const params = new URLSearchParams({ email });
      const response = await fetchWithTimeout(
        `${CONFIG.apiBaseUrl}/email/validate?${params}`,
        CONFIG.apiTimeoutMs
      );

      if (!response || response.status !== 200) {
        return { apiUnavailable: true, valid: null };
      }

      const body = await response.json();
      const result = {
        apiUnavailable: false,
        valid: body.valid === true,
        disposable: body.disposable === true,
        email: body.email || email,
      };
      resultCache.set(email, result);
      return result;
    } catch {
      return { apiUnavailable: true, valid: null };
    }
  };

  const handleValidation = async (input, isBlur = false) => {
    const instance = instances.get(input);
    if (!instance) return;

    const email = normalize(input.value);
    if (!email) {
      setState(input, "idle");
      instance.hasBlurred = isBlur || instance.hasBlurred;
      instance.lastRemote = null;
      return;
    }

    const problem = localProblem(email);
    if (problem) {
      if (isBlur || instance.hasBlurred) {
        setState(input, "invalid", CONFIG.invalidMessage);
      }
      instance.hasBlurred = isBlur || instance.hasBlurred;
      instance.lastRemote = { valid: false, local: true };
      return;
    }

    if (!isBlur && !instance.hasBlurred) {
      setState(input, "idle");
      return;
    }

    instance.hasBlurred = true;
    setState(input, "validating", "");

    const result = await validateRemote(email);
    if (normalize(input.value) !== email) return;

    instance.lastRemote = result;

    if (result.apiUnavailable) {
      setState(input, "idle");
      return;
    }

    if (result.valid) {
      input.value = result.email || email;
      setState(input, "valid");
      return;
    }

    setState(
      input,
      "invalid",
      result.disposable ? CONFIG.disposableMessage : CONFIG.invalidMessage
    );
  };

  const allowSubmit = (input, instance) => {
    const email = normalize(input.value);
    if (!email) return true;

    if (localProblem(email)) {
      setState(input, "invalid", CONFIG.invalidMessage);
      return false;
    }

    const remote = instance.lastRemote;
    if (remote && remote.valid === false && !remote.apiUnavailable) {
      setState(
        input,
        "invalid",
        remote.disposable ? CONFIG.disposableMessage : CONFIG.invalidMessage
      );
      return false;
    }

    return true;
  };

  const initEmailInput = (input) => {
    if (instances.has(input) || input.hasAttribute("data-mfz-email-initialized")) {
      return;
    }

    input.setAttribute("data-mfz-email-initialized", "true");
    if (!input.hasAttribute("data-mfz-email")) {
      input.setAttribute("data-mfz-email", "");
    }

    const container = document.createElement("div");
    container.className = "mfz-email-container";
    input.parentNode.insertBefore(container, input);
    container.appendChild(input);

    instances.set(input, {
      input,
      container,
      isValid: false,
      validationState: "idle",
      hasBlurred: false,
      lastRemote: null,
    });

    let debounceTimer;
    input.addEventListener("input", () => {
      const instance = instances.get(input);
      if (instance?.validationState === "invalid") setState(input, "idle");
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleValidation(input, false), CONFIG.debounceMs);
    });

    input.addEventListener("blur", () => handleValidation(input, true));
  };

  const setupFormValidation = (form) => {
    if (form.dataset.mfzEmailFormInitialized) return;
    form.dataset.mfzEmailFormInitialized = "true";

    form.addEventListener("submit", (e) => {
      let blocked = false;
      form.querySelectorAll("[data-mfz-email]").forEach((input) => {
        const instance = instances.get(input);
        if (!instance) return;
        if (!allowSubmit(input, instance)) blocked = true;
      });

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        const firstInvalid = form.querySelector(".mfz-email-container.mfz-invalid [data-mfz-email]");
        if (firstInvalid) firstInvalid.focus();
      }
    });
  };

  const findEmailInputs = (root = document) => {
    const found = new Set();
    root.querySelectorAll("[data-mfz-email], form input[type='email']").forEach((el) => {
      if (el instanceof HTMLInputElement) found.add(el);
    });
    return [...found];
  };

  const initAll = () => {
    const inputs = findEmailInputs();
    if (!inputs.length) return;

    inputs.forEach((input) => {
      initEmailInput(input);
      const form = input.closest("form");
      if (form) setupFormValidation(form);
    });
  };

  window.MFZEmail = {
    init: initAll,
    isValid: (input) => instances.get(input)?.isValid === true,
    getInstance: (input) => instances.get(input),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  let observerEnabled = false;
  setTimeout(() => {
    observerEnabled = true;
  }, 1000);

  const observer = new MutationObserver((mutations) => {
    if (!observerEnabled) return;
    const hasNew = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        if (node.matches?.("[data-mfz-email], form input[type='email']")) return true;
        return Boolean(node.querySelector?.("[data-mfz-email], form input[type='email']"));
      })
    );
    if (hasNew) initAll();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
