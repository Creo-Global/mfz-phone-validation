/**
 * MFZ Email — Webflow field check against apiphone /email/validate
 *
 * Usage: <input type="email" data-mfz-email name="Email">
 * Also auto-binds form input[type="email"] so existing Webflow Email fields work.
 *
 * Fast local fail (syntax / demo|fake|sample|dummy|staging|noreply) shows an error
 * and blocks submit. MX / disposable go to apiphone on blur only.
 * If the API is down, slow, or rate-limited, the form still submits to Zoho.
 * jsDelivr: pin mfz-email.min.js (minifies this file). No optional chaining.
 */
;(function () {
  "use strict";

  const CONFIG = {
    apiBaseUrl: "https://apiphone.meydanfz.ae",
    apiTimeoutMs: 4000,
    debounceMs: 300,
    invalidMessage: "Please enter a valid email address",
    disposableMessage: "Please use your work or personal email",
    domainMessage: "Your email domain is invalid",
  };

  // Keep in sync with hono/lib/typo.ts
  const COMMON_DOMAINS = [
    "gmail.com",
    "googlemail.com",
    "google.com",
    "yahoo.com",
    "yahoo.co.uk",
    "yahoo.ae",
    "ymail.com",
    "rocketmail.com",
    "hotmail.com",
    "hotmail.co.uk",
    "hotmail.fr",
    "outlook.com",
    "outlook.ae",
    "outlook.fr",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "mail.com",
    "gmx.com",
    "zoho.com",
    "fastmail.com",
    "proton.me",
    "protonmail.com",
    "pm.me",
    "duck.com",
    "meydanfz.ae",
  ];

  // Tiny local list so yopmail is not suggested as hotmail before the API runs.
  const LOCAL_DISPOSABLE = [
    "mailinator.com",
    "yopmail.com",
    "guerrillamail.com",
    "sharklasers.com",
    "grr.la",
    "tempmail.com",
    "10minutemail.com",
    "throwaway.email",
    "trashmail.com",
    "temp-mail.org",
    "dispostable.com",
    "getnada.com",
    "moakt.com",
    "mailnesia.com",
  ];

  const COMMON_TLDS = ["com", "co", "net", "org", "ae", "me", "io", "co.uk"];

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

  const levenshtein = (a, b) => {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const row = [];
    for (let i = 0; i <= n; i += 1) row[i] = i;
    for (let i = 1; i <= m; i += 1) {
      let prev = i;
      for (let j = 1; j <= n; j += 1) {
        const next = a.charAt(i - 1) === b.charAt(j - 1) ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
        row[j - 1] = prev;
        prev = next;
      }
      row[n] = prev;
    }
    return row[n];
  };

  const closestDomain = (value, candidates) => {
    let best;
    let bestDist = Infinity;
    const max = value.length <= 4 ? 1 : 2;
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (candidate === value) return null;
      const dist = levenshtein(value, candidate);
      if (dist > 0 && dist <= max && dist < bestDist) {
        best = candidate;
        bestDist = dist;
      }
    }
    return best || null;
  };

  const suggestTypo = (email) => {
    const at = email.lastIndexOf("@");
    if (at < 1) return null;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (!domain.includes(".")) return null;
    const match = closestDomain(domain, COMMON_DOMAINS);
    if (match) return local + "@" + match;
    const dot = domain.indexOf(".");
    const sld = domain.slice(0, dot);
    const tld = domain.slice(dot + 1);
    const bases = [];
    for (let i = 0; i < COMMON_DOMAINS.length; i += 1) {
      const base = COMMON_DOMAINS[i].split(".")[0];
      if (bases.indexOf(base) === -1) bases.push(base);
    }
    const sldMatch = closestDomain(sld, bases);
    if (sldMatch && COMMON_TLDS.indexOf(tld) !== -1) {
      for (let i = 0; i < COMMON_DOMAINS.length; i += 1) {
        const candidate = COMMON_DOMAINS[i];
        if (candidate.indexOf(sldMatch + ".") === 0 && candidate.lastIndexOf("." + tld) === candidate.length - tld.length - 1 && candidate !== domain) {
          return local + "@" + candidate;
        }
      }
    }
    return null;
  };

  const typoMessage = (suggestion) => "Did you mean " + suggestion + "?";

  const isLocalDisposable = (domain) => {
    const parts = domain.split(".").filter(Boolean);
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (LOCAL_DISPOSABLE.indexOf(parts.slice(i).join(".")) !== -1) return true;
    }
    return false;
  };

  const localProblem = (email) => {
    if (!EMAIL_RE.test(email) || !email.includes(".")) return { kind: "syntax" };
    const at = email.indexOf("@");
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (BLOCKED_KEYWORDS.some((kw) => local.includes(kw))) return { kind: "keyword" };
    if (isLocalDisposable(domain)) return { kind: "disposable" };
    const suggestion = suggestTypo(email);
    if (suggestion) return { kind: "typo", suggestion: suggestion };
    return null;
  };

  const problemMessage = (problem) => {
    if (problem.kind === "typo") return typoMessage(problem.suggestion);
    if (problem.kind === "disposable") return CONFIG.disposableMessage;
    return CONFIG.invalidMessage;
  };

  const remoteMessage = (remote) => {
    if (remote.typo && remote.suggestion) return typoMessage(remote.suggestion);
    if (remote.disposable) return CONFIG.disposableMessage;
    if (remote.mx === false) return CONFIG.domainMessage;
    return CONFIG.invalidMessage;
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
      container.classList.add("mfz-" + state);
      const feedback = createFeedback(container);
      feedback.textContent = message;
      feedback.className = "mfz-email-feedback mfz-feedback-" + state;
      if (state === "invalid" && instance.lastRemote && instance.lastRemote.suggestion) {
        feedback.style.cursor = "pointer";
        feedback.setAttribute("title", "Click to use " + instance.lastRemote.suggestion);
        feedback.onclick = function () {
          input.value = instance.lastRemote.suggestion;
          handleValidation(input, true);
        };
      } else {
        feedback.style.cursor = "";
        feedback.removeAttribute("title");
        feedback.onclick = null;
      }
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
        CONFIG.apiBaseUrl + "/email/validate?" + params,
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
        typo: body.typo === true,
        mx: body.mx === true,
        suggestion: body.suggestion || "",
        email: body.email || email,
      };
      resultCache.set(email, result);
      return result;
    } catch (err) {
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
      const showError = isBlur || instance.hasBlurred;
      instance.hasBlurred = showError;
      instance.lastRemote = {
        valid: false,
        local: true,
        disposable: problem.kind === "disposable",
        typo: problem.kind === "typo",
        suggestion: problem.suggestion || "",
      };
      if (showError) {
        setState(input, "invalid", problemMessage(problem));
      }
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

    setState(input, "invalid", remoteMessage(result));
  };

  const allowSubmit = (input, instance) => {
    const email = normalize(input.value);
    if (!email) return true;

    const problem = localProblem(email);
    if (problem) {
      setState(input, "invalid", problemMessage(problem));
      return false;
    }

    const remote = instance.lastRemote;
    if (remote && remote.valid === false && !remote.apiUnavailable) {
      setState(input, "invalid", remoteMessage(remote));
      return false;
    }

    return true;
  };

  const initEmailInput = (input) => {
    if (instances.has(input) || input.hasAttribute("data-mfz-email-initialized")) {
      return;
    }

    if (!input.parentNode) return;

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
      if (instance) {
        instance.lastRemote = null;
        if (instance.validationState === "invalid") setState(input, "idle");
      }
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
    isValid: (input) => {
      const instance = instances.get(input);
      return !!(instance && instance.isValid);
    },
    getInstance: (input) => instances.get(input),
    suggestTypo: suggestTypo,
    localProblem: localProblem,
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
        var emailSelector = "[data-mfz-email], form input[type='email']";
        if (typeof node.matches === "function" && node.matches(emailSelector)) return true;
        return !!(typeof node.querySelector === "function" && node.querySelector(emailSelector));
      })
    );
    if (hasNew) initAll();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
