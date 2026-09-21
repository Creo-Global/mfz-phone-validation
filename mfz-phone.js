/**
 * MFZ Phone - International Phone Input with IP Detection & Validation
 * 
 * Usage: Add data-mfz-phone attribute to any phone input
 * <input type="tel" data-mfz-phone name="phone">
 * 
 * @version 1.0.0

 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiBaseUrl: 'https://apiphone.meydanfz.ae',
    apiFallbackUrl: 'https://api.meydanfz.ae',
    apiTimeoutMs: 8000,
    defaultCountry: 'ae', // UAE as fallback
    sessionStorageKey: 'mfz_detected_country',
    ipInfoStorageKey: 'mfz_ip_location_info',
    debounceMs: 300,
    validationMessages: {
      invalid: 'Please enter a valid phone number',
      required: 'Phone number is required',
      validating: 'Validating...',
      rateLimited: 'Too many attempts, try again shortly'
    }
  };

  // Phone number lengths by country (national number, excluding country code)
  // Data source: International phone number standards 2026
  // Format: { min: minimum digits, max: maximum digits }
  const COUNTRY_PHONE_LENGTHS = {
    // Middle East
    ae: { min: 8, max: 9 },   // UAE
    sa: { min: 8, max: 9 },   // Saudi Arabia
    kw: { min: 7, max: 8 },   // Kuwait
    bh: { min: 8, max: 8 },   // Bahrain
    qa: { min: 3, max: 8 },   // Qatar
    om: { min: 7, max: 8 },   // Oman
    jo: { min: 5, max: 9 },   // Jordan
    lb: { min: 7, max: 8 },   // Lebanon
    iq: { min: 8, max: 10 },  // Iraq
    sy: { min: 8, max: 10 },  // Syria
    ye: { min: 6, max: 9 },   // Yemen
    il: { min: 8, max: 9 },   // Israel
    ir: { min: 6, max: 10 },  // Iran
    
    // North America
    us: { min: 10, max: 10 }, // United States
    ca: { min: 10, max: 10 }, // Canada
    mx: { min: 10, max: 10 }, // Mexico
    
    // Europe
    gb: { min: 7, max: 10 },  // United Kingdom
    de: { min: 6, max: 13 },  // Germany
    fr: { min: 9, max: 9 },   // France
    it: { min: 6, max: 11 },  // Italy
    es: { min: 9, max: 9 },   // Spain
    pt: { min: 9, max: 11 },  // Portugal
    nl: { min: 9, max: 9 },   // Netherlands
    be: { min: 8, max: 9 },   // Belgium
    at: { min: 4, max: 13 },  // Austria
    ch: { min: 4, max: 12 },  // Switzerland
    se: { min: 7, max: 13 },  // Sweden
    no: { min: 5, max: 8 },   // Norway
    dk: { min: 8, max: 8 },   // Denmark
    fi: { min: 5, max: 12 },  // Finland
    pl: { min: 6, max: 9 },   // Poland
    cz: { min: 4, max: 12 },  // Czechia
    gr: { min: 10, max: 10 }, // Greece
    hu: { min: 8, max: 9 },   // Hungary
    ro: { min: 9, max: 9 },   // Romania
    bg: { min: 7, max: 9 },   // Bulgaria
    ua: { min: 9, max: 9 },   // Ukraine
    ru: { min: 10, max: 10 }, // Russia
    by: { min: 9, max: 10 },  // Belarus
    ie: { min: 7, max: 11 },  // Ireland
    sk: { min: 4, max: 9 },   // Slovakia
    hr: { min: 8, max: 12 },  // Croatia
    rs: { min: 4, max: 12 },  // Serbia
    si: { min: 8, max: 8 },   // Slovenia
    ba: { min: 8, max: 8 },   // Bosnia
    me: { min: 4, max: 12 },  // Montenegro
    al: { min: 3, max: 9 },   // Albania
    mk: { min: 8, max: 8 },   // North Macedonia
    ee: { min: 7, max: 10 },  // Estonia
    lv: { min: 7, max: 8 },   // Latvia
    lt: { min: 8, max: 8 },   // Lithuania
    md: { min: 8, max: 8 },   // Moldova
    ge: { min: 9, max: 9 },   // Georgia
    am: { min: 8, max: 8 },   // Armenia
    az: { min: 8, max: 9 },   // Azerbaijan
    is: { min: 7, max: 9 },   // Iceland
    lu: { min: 4, max: 11 },  // Luxembourg
    mt: { min: 8, max: 8 },   // Malta
    cy: { min: 8, max: 11 },  // Cyprus
    ad: { min: 6, max: 9 },   // Andorra
    mc: { min: 5, max: 9 },   // Monaco
    sm: { min: 6, max: 10 },  // San Marino
    li: { min: 7, max: 9 },   // Liechtenstein
    gi: { min: 8, max: 8 },   // Gibraltar
    
    // Asia Pacific
    cn: { min: 5, max: 12 },  // China
    jp: { min: 5, max: 13 },  // Japan
    kr: { min: 8, max: 11 },  // South Korea
    kp: { min: 6, max: 17 },  // North Korea
    in: { min: 7, max: 10 },  // India
    pk: { min: 8, max: 11 },  // Pakistan
    bd: { min: 6, max: 10 },  // Bangladesh
    lk: { min: 9, max: 9 },   // Sri Lanka
    np: { min: 8, max: 9 },   // Nepal
    mm: { min: 7, max: 9 },   // Myanmar
    th: { min: 8, max: 9 },   // Thailand
    vn: { min: 7, max: 10 },  // Vietnam
    kh: { min: 8, max: 8 },   // Cambodia
    la: { min: 8, max: 10 },  // Laos
    my: { min: 7, max: 9 },   // Malaysia
    sg: { min: 8, max: 12 },  // Singapore
    id: { min: 5, max: 10 },  // Indonesia
    ph: { min: 8, max: 10 },  // Philippines
    tw: { min: 8, max: 9 },   // Taiwan
    hk: { min: 4, max: 9 },   // Hong Kong
    mo: { min: 7, max: 8 },   // Macau
    mn: { min: 7, max: 8 },   // Mongolia
    au: { min: 5, max: 15 },  // Australia
    nz: { min: 3, max: 10 },  // New Zealand
    fj: { min: 7, max: 7 },   // Fiji
    pg: { min: 4, max: 11 },  // Papua New Guinea
    
    // Africa
    eg: { min: 7, max: 10 },   // Egypt
    za: { min: 9, max: 9 },   // South Africa
    ng: { min: 7, max: 10 },  // Nigeria
    ke: { min: 6, max: 10 },  // Kenya
    et: { min: 9, max: 9 },   // Ethiopia
    tz: { min: 9, max: 9 },   // Tanzania
    ug: { min: 9, max: 9 },   // Uganda
    gh: { min: 5, max: 9 },   // Ghana
    dz: { min: 8, max: 9 },   // Algeria
    ma: { min: 9, max: 9 },   // Morocco
    tn: { min: 8, max: 8 },   // Tunisia
    ly: { min: 8, max: 9 },   // Libya
    sd: { min: 9, max: 9 },   // Sudan
    ao: { min: 9, max: 9 },   // Angola
    mz: { min: 8, max: 9 },   // Mozambique
    zm: { min: 9, max: 9 },   // Zambia
    zw: { min: 5, max: 10 },  // Zimbabwe
    bw: { min: 7, max: 8 },   // Botswana
    na: { min: 6, max: 10 },  // Namibia
    sn: { min: 9, max: 9 },   // Senegal
    ci: { min: 8, max: 8 },   // Ivory Coast
    cm: { min: 8, max: 8 },   // Cameroon
    cd: { min: 5, max: 9 },   // DR Congo
    rw: { min: 9, max: 9 },   // Rwanda
    
    // South America
    br: { min: 10, max: 10 }, // Brazil
    ar: { min: 10, max: 10 }, // Argentina
    co: { min: 8, max: 10 },  // Colombia
    ve: { min: 10, max: 10 }, // Venezuela
    pe: { min: 8, max: 11 },  // Peru
    cl: { min: 8, max: 9 },   // Chile
    ec: { min: 8, max: 8 },   // Ecuador
    bo: { min: 8, max: 8 },   // Bolivia
    py: { min: 5, max: 9 },   // Paraguay
    uy: { min: 4, max: 11 },  // Uruguay
    
    // Central America & Caribbean
    gt: { min: 8, max: 8 },   // Guatemala
    hn: { min: 8, max: 8 },   // Honduras
    sv: { min: 7, max: 11 },  // El Salvador
    ni: { min: 8, max: 8 },   // Nicaragua
    cr: { min: 8, max: 8 },   // Costa Rica
    pa: { min: 7, max: 8 },   // Panama
    cu: { min: 6, max: 8 },   // Cuba
    ht: { min: 8, max: 8 },   // Haiti
    do: { min: 10, max: 10 }, // Dominican Republic
    pr: { min: 10, max: 10 }, // Puerto Rico
    jm: { min: 10, max: 10 }, // Jamaica
    tt: { min: 10, max: 10 }, // Trinidad and Tobago
    bs: { min: 10, max: 10 }, // Bahamas
    bb: { min: 10, max: 10 }, // Barbados
    
    // Central Asia
    kz: { min: 10, max: 10 }, // Kazakhstan
    uz: { min: 9, max: 9 },   // Uzbekistan
    tm: { min: 8, max: 8 },   // Turkmenistan
    kg: { min: 9, max: 9 },   // Kyrgyzstan
    tj: { min: 9, max: 9 },   // Tajikistan
    af: { min: 9, max: 9 },   // Afghanistan
    
    // Default for unknown countries
    default: { min: 4, max: 15 }
  };

  // Store for phone input instances
  const phoneInstances = new Map();
  const phoneValidationCache = new Map();

  /**
   * Whether a failed response should trigger the fallback API
   * @param {Response} response
   * @returns {boolean}
   */
  const shouldTryFallback = (response) => {
    return !response || response.status !== 200;
  };

  /**
   * Fetch with timeout (AbortController)
   * @param {string} url
   * @param {number} timeoutMs
   * @returns {Promise<Response>}
   */
  const fetchWithTimeout = async (url, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * Fetch from API with automatic fallback on timeout, rate limit, or server errors
   * @param {string} path - API path including query string (e.g. "/ip" or "/phone/validate?...")
   * @returns {Promise<Response>}
   */
  const fetchApi = async (path) => {
    const bases = [CONFIG.apiBaseUrl];
    if (CONFIG.apiFallbackUrl && CONFIG.apiFallbackUrl !== CONFIG.apiBaseUrl) {
      bases.push(CONFIG.apiFallbackUrl);
    }

    let lastError;

    for (let i = 0; i < bases.length; i++) {
      const base = bases[i];
      const url = `${base}${path}`;

      try {
        const response = await fetchWithTimeout(url, CONFIG.apiTimeoutMs);

        if (shouldTryFallback(response) && i < bases.length - 1) {
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (i < bases.length - 1) {
          continue;
        }
      }
    }

    throw lastError || new Error('API request failed');
  };

  /**
   * Build E.164 phone string from input
   * @param {object} instance - Phone instance
   * @param {string} digitsOnly - National number digits
   * @returns {string}
   */
  const getPhoneE164 = (instance, digitsOnly) => {
    const countryData = instance.iti.getSelectedCountryData();
    let phone;

    try {
      phone = instance.iti.getNumber();
    } catch (error) {
      phone = null;
    }

    if (!phone || phone === `+${countryData.dialCode}`) {
      phone = `+${countryData.dialCode}${digitsOnly}`;
    }

    return phone;
  };

  /**
   * Validate phone locally via intl-tel-input (no API)
   * @param {object} instance - Phone instance
   * @param {string} digitsOnly - National number digits
   * @param {object} options
   * @param {boolean} options.allowDegraded - Allow length-only check when API/utils unavailable
   * @returns {object}
   */
  const validatePhoneLocally = (instance, digitsOnly, { allowDegraded = false } = {}) => {
    if (!instance?.iti || !digitsOnly) {
      return { valid: false, formatted: null };
    }

    const countryData = instance.iti.getSelectedCountryData();
    const limits = getPhoneLengthLimits(countryData.iso2);

    if (digitsOnly.length < limits.min || digitsOnly.length > limits.max) {
      return { valid: false, formatted: null };
    }

    const phone = getPhoneE164(instance, digitsOnly);

    try {
      if (typeof window.intlTelInputUtils !== 'undefined' && instance.iti.isValidNumber()) {
        return { valid: true, formatted: phone, localFallback: true };
      }
    } catch (error) {
      // Utils not ready
    }

    if (allowDegraded) {
      return { valid: true, formatted: phone, localFallback: true, degraded: true };
    }

    return { valid: false, formatted: null };
  };

  /**
   * Get phone length limits for a country
   * @param {string} countryCode - ISO country code (lowercase)
   * @returns {object} { min: number, max: number }
   */
  const getPhoneLengthLimits = (countryCode) => {
    const code = countryCode?.toLowerCase();
    return COUNTRY_PHONE_LENGTHS[code] || COUNTRY_PHONE_LENGTHS.default;
  };

  /**
   * Get max phone length for a country
   * @param {string} countryCode - ISO country code (lowercase)
   * @returns {number} Maximum digits allowed
   */
  const getMaxPhoneLength = (countryCode) => {
    return getPhoneLengthLimits(countryCode).max;
  };

  /**
   * Get min phone length for a country
   * @param {string} countryCode - ISO country code (lowercase)
   * @returns {number} Minimum digits required
   */
  const getMinPhoneLength = (countryCode) => {
    return getPhoneLengthLimits(countryCode).min;
  };

  /**
   * Filter input to only allow digits
   * @param {string} value - Input value
   * @returns {string} Filtered value with only digits
   */
  const filterToDigits = (value) => {
    return value.replace(/\D/g, '');
  };

  /**
   * Setup strict input handling for phone input
   * @param {HTMLElement} input - Phone input element
   * @param {object} instance - Phone instance
   */
  const setupStrictInput = (input, instance) => {
    // HELPER: Strip country code and leading zero from any input value
    const stripPrefixes = (value) => {
      const countryData = instance.iti.getSelectedCountryData();
      const dialCode = countryData.dialCode;
      let val = value.trim().replace(/\s/g, '');

      // Scenario 1: +971507489482
      if (val.startsWith('+' + dialCode)) {
        val = val.slice(('+' + dialCode).length);
      }  
      // Scenario 2: 00971507489482
      else if (val.startsWith('00' + dialCode)) {
        val = val.slice(('00' + dialCode).length);
      }
      // Scenario 3: 971507489482 (without + but long enough to confirm it's a full number)
      else if (val.startsWith(dialCode) && val.length > dialCode.length + 6) {
        val = val.slice(dialCode.length);
      }
      // Scenario 4: Always strip leading zero e.g. 0507489482 to 507489482
        val = val.replace(/^0+/, '');
      return val;
    };

    // Prevent non-numeric key presses
    input.addEventListener('keydown', (e) => {
      // Allow: backspace, delete, tab, escape, enter, arrows
      const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
      ];
      
      if (allowedKeys.includes(e.key)) return;
      
      // Allow Ctrl/Cmd + A, C, V, X
      if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
      
      // Block if not a digit
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
        return;
      }
      
      // Check max length
      const countryData = instance.iti.getSelectedCountryData();
      const maxLength = getMaxPhoneLength(countryData.iso2);
      const currentDigits = filterToDigits(input.value);
      
      if (currentDigits.length >= maxLength) {
        e.preventDefault();
      }
    });

    // Handle paste - filter to digits only and respect max length
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      const stripped = stripPrefixes(pastedText);
      const digitsOnly = filterToDigits(stripped);
      
      const countryData = instance.iti.getSelectedCountryData();
      const maxLength = getMaxPhoneLength(countryData.iso2);
      const currentDigits = filterToDigits(input.value);
      
      // Calculate how many digits we can add
      const availableSpace = maxLength - currentDigits.length;
      const textToInsert = digitsOnly.slice(0, Math.max(0, availableSpace));
      
      // Insert at cursor position
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      
      // If there's a selection, we're replacing it
      const newValue = filterToDigits(before) + textToInsert + filterToDigits(after);
      input.value = newValue.slice(0, maxLength);
      
      // Trigger input event for validation
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Filter on input (catches any edge cases) and trigger validation
    input.addEventListener('input', (e) => {
      const countryData = instance.iti.getSelectedCountryData();
      const maxLength = getMaxPhoneLength(countryData.iso2);
      
      // Get only digits
      const stripped = stripPrefixes(input.value);
      let digitsOnly = filterToDigits(stripped);
      
      // Enforce max length
      if (digitsOnly.length > maxLength) {
        digitsOnly = digitsOnly.slice(0, maxLength);
      }
      
      // Only update if different (to avoid cursor jumping)
      if (input.value !== digitsOnly) {
        const cursorPos = input.selectionStart;
        const diff = input.value.length - digitsOnly.length;
        input.value = digitsOnly;
        // Try to maintain cursor position
        input.setSelectionRange(
          Math.max(0, cursorPos - diff),
          Math.max(0, cursorPos - diff)
        );
      }
      
      // Mark that validation should happen (will be triggered by the validation listener)
      instance.needsValidation = true;
    }, true); // Use capture to run before other handlers

    // Update max length when country changes
    input.addEventListener('countrychange', () => {
      const countryData = instance.iti.getSelectedCountryData();
      const maxLength = getMaxPhoneLength(countryData.iso2);
      
      // Trim if current value exceeds new max
      const currentDigits = filterToDigits(input.value);
      if (currentDigits.length > maxLength) {
        input.value = currentDigits.slice(0, maxLength);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  };

  /**
   * Detect user's country from IP address
   * @returns {Promise<string>} Country code (lowercase)
   */
  const detectCountry = async () => {
    try {
      const cachedInfo = sessionStorage.getItem(CONFIG.ipInfoStorageKey);
      if (cachedInfo) {
        const parsed = JSON.parse(cachedInfo);
        if (parsed && parsed.country_code) {
          sessionStorage.setItem(CONFIG.sessionStorageKey, parsed.country_code.toLowerCase());
          return parsed.country_code.toLowerCase();
        }
      }
    } catch (error) {
      // Ignore invalid cache and fetch fresh data
    }

    const cached = sessionStorage.getItem(CONFIG.sessionStorageKey);
    if (cached) {
      return cached.toLowerCase();
    }

    try {
      const response = await fetchApi('/ip');
      if (!response.ok) throw new Error('IP detection failed');

      const data = await response.json();
      const countryCode = (data.country_code || data.country || CONFIG.defaultCountry).toLowerCase();
      
      sessionStorage.setItem(CONFIG.sessionStorageKey, countryCode);
      sessionStorage.setItem(CONFIG.ipInfoStorageKey, JSON.stringify(data));
      
      return countryCode;
    } catch (error) {
      return CONFIG.defaultCountry;
    }
  };

  /**
   * Validate phone number via API, with local fallback when API is unavailable
   * @param {string} phone - Phone number
   * @param {string} countryCode - ISO country code
   * @param {object} instance - Phone instance (for local fallback)
   * @param {string} digitsOnly - National number digits
   * @returns {Promise<object>} Validation result
   */
  const validatePhoneNumber = async (phone, countryCode, instance = null, digitsOnly = null) => {
    const cacheKey = `${countryCode.toUpperCase()}:${phone}`;
    if (phoneValidationCache.has(cacheKey)) {
      return phoneValidationCache.get(cacheKey);
    }

    const tryLocalFallback = () => {
      if (!instance) return null;
      const digits = digitsOnly || filterToDigits(phone);
      const local = validatePhoneLocally(instance, digits);
      if (!local.valid) return null;
      return {
        success: true,
        valid: true,
        formatted: { e164: local.formatted },
        localFallback: true
      };
    };

    try {
      const params = new URLSearchParams({
        phone: phone,
        countryCode: countryCode.toUpperCase()
      });

      const response = await fetchApi(`/phone/validate?${params}`);

      if (response.status === 429) {
        const local = tryLocalFallback();
        if (local) {
          phoneValidationCache.set(cacheKey, local);
          return local;
        }
        return {
          success: false,
          valid: false,
          rateLimited: true,
          apiUnavailable: true,
          error: CONFIG.validationMessages.rateLimited
        };
      }

      if (!response.ok) throw new Error('Validation request failed');

      const result = await response.json();
      phoneValidationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      const local = tryLocalFallback();
      if (local) {
        phoneValidationCache.set(cacheKey, local);
        return local;
      }
      return {
        success: false,
        valid: false,
        apiUnavailable: true,
        error: error.message
      };
    }
  };

  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} Debounced function
   */
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  /**
   * Create validation feedback element
   * @param {HTMLElement} container - Container element
   * @returns {HTMLElement} Feedback element
   */
  const createFeedbackElement = (container) => {
    let feedback = container.querySelector('.mfz-phone-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'mfz-phone-feedback';
      feedback.setAttribute('role', 'alert');
      feedback.setAttribute('aria-live', 'polite');
      container.appendChild(feedback);
    }
    return feedback;
  };

  /**
   * Remove validation feedback element
   * @param {HTMLElement} container - Container element
   */
  const removeFeedbackElement = (container) => {
    const feedback = container.querySelector('.mfz-phone-feedback');
    if (feedback) {
      feedback.remove();
    }
  };

  /**
   * Update validation state
   * @param {HTMLElement} input - Phone input element
   * @param {string} state - State: 'valid', 'invalid', 'validating', 'idle'
   * @param {string} message - Feedback message
   */
  const updateValidationState = (input, state, message = '') => {
    const instance = phoneInstances.get(input);
    if (!instance) return;

    const container = instance.container;

    // Remove all state classes
    container.classList.remove('mfz-valid', 'mfz-invalid', 'mfz-validating');
    
    // Handle idle state - remove feedback element entirely
    if (state === 'idle' || (state === 'valid' && !message)) {
      removeFeedbackElement(container);
      if (state === 'valid') {
        container.classList.add('mfz-valid');
      }
    } else {
      // Add current state class and show feedback
      container.classList.add(`mfz-${state}`);
      const feedback = createFeedbackElement(container);
      feedback.textContent = message;
      feedback.className = `mfz-phone-feedback mfz-feedback-${state}`;
    }

    // Store validation state
    instance.isValid = state === 'valid';
    instance.validationState = state;
    instance.validationMessage = message;
  };

  /**
   * Handle phone validation
   * @param {HTMLElement} input - Phone input element
   * @param {boolean} isBlur - Whether this was triggered by blur event
   */
  const handleValidation = async (input, isBlur = false) => {
    const instance = phoneInstances.get(input);
    if (!instance || !instance.iti) return;

    // Get the raw input value and country data
    const countryData = instance.iti.getSelectedCountryData();
    const rawValue = input.value.trim();
    const digitsOnly = filterToDigits(rawValue);
    
    // Check if empty
    if (!digitsOnly) {
      updateValidationState(input, 'idle', '');
      instance.hasBlurred = isBlur; // Track if user has left the field
      return;
    }

    // Get length limits for this country
    const limits = getPhoneLengthLimits(countryData.iso2);
    
    // Check minimum length - don't call API if too short
    if (digitsOnly.length < limits.min) {
      // Only show error if user has blurred OR has previously blurred
      if (isBlur || instance.hasBlurred) {
        updateValidationState(input, 'invalid', `Minimum ${limits.min} digits required`);
      } else {
        // While typing, just stay idle until min length reached
        updateValidationState(input, 'idle', '');
      }
      instance.formattedNumber = null;
      if (isBlur) instance.hasBlurred = true;
      return;
    }

    // Mark that we've reached min length at least once
    instance.hasBlurred = true;

    // Get the full number - use getNumber if available, otherwise construct it
    let phone;
    try {
      phone = instance.iti.getNumber();
    } catch (e) {
      // Utils might not be loaded yet, construct manually
      phone = `+${countryData.dialCode}${digitsOnly}`;
    }
    
    // If getNumber just returned the dial code, construct the number manually
    if (!phone || phone === `+${countryData.dialCode}`) {
      phone = `+${countryData.dialCode}${digitsOnly}`;
    }

    // Show validating state (spinner only, no message)
    updateValidationState(input, 'validating', '');

    // Call validation API
    const result = await validatePhoneNumber(phone, countryData.iso2, instance, digitsOnly);

    instance.apiUnavailable = !!result.apiUnavailable;

    if (result.rateLimited) {
      instance.rateLimited = true;
      updateValidationState(input, 'invalid', result.error || CONFIG.validationMessages.rateLimited);
      instance.formattedNumber = null;
      return;
    }

    instance.rateLimited = false;

    if (result.valid) {
      updateValidationState(input, 'valid', '');
      instance.formattedNumber = result.formatted?.e164 || phone;
    } else if (result.apiUnavailable) {
      // API down and local check inconclusive — stay neutral so submit can retry locally
      updateValidationState(input, 'idle', '');
      instance.formattedNumber = null;
    } else {
      updateValidationState(input, 'invalid', CONFIG.validationMessages.invalid);
      instance.formattedNumber = null;
    }
  };

  /**
   * Resolve phone for form submit without waiting on API
   * @param {HTMLElement} input - Phone input element
   * @param {object} instance - Phone instance
   * @returns {boolean} Whether this phone is OK to submit
   */
  const preparePhoneForSubmit = (input, instance) => {
    const digitsOnly = filterToDigits(input.value.trim());
    const isEmpty = !digitsOnly;

    if (isEmpty) {
      if (instance.isRequired) {
        updateValidationState(input, 'invalid', CONFIG.validationMessages.required);
        return false;
      }
      return true;
    }

    if (instance.isValid && instance.formattedNumber) {
      input.value = instance.formattedNumber;
      return true;
    }

    const limits = getPhoneLengthLimits(instance.iti.getSelectedCountryData().iso2);
    if (digitsOnly.length < limits.min) {
      updateValidationState(input, 'invalid', CONFIG.validationMessages.invalid);
      return false;
    }

    const allowDegraded = instance.validationState === 'validating'
      || instance.apiUnavailable
      || instance.rateLimited;

    const local = validatePhoneLocally(instance, digitsOnly, { allowDegraded });

    if (local.valid) {
      input.value = local.formatted;
      instance.formattedNumber = local.formatted;
      instance.isValid = true;
      updateValidationState(input, 'valid', '');
      return true;
    }

    updateValidationState(input, 'invalid', CONFIG.validationMessages.invalid);
    return false;
  };

  /**
   * Initialize a phone input
   * @param {HTMLElement} input - Phone input element
   * @param {string} detectedCountry - Detected country code
   */
  const initPhoneInput = (input, detectedCountry) => {
    // Skip if already initialized
    if (phoneInstances.has(input) || input.hasAttribute('data-mfz-initialized')) return;
    
    // Mark as initialized
    input.setAttribute('data-mfz-initialized', 'true');


    // Create wrapper container
    const container = document.createElement('div');
    container.className = 'mfz-phone-container';
    input.parentNode.insertBefore(container, input);
    container.appendChild(input);

    // Initialize intl-tel-input
    const iti = window.intlTelInput(input, {
      initialCountry: detectedCountry,
      preferredCountries: ['ae', 'us', 'gb', 'sa', 'in'],
      separateDialCode: true,
      nationalMode: false,
      autoPlaceholder: 'aggressive',
      formatOnDisplay: true,
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.1/build/js/utils.js'
    });

    // Force autocomplete="tel" and prevent intl-tel-input / Webflow from resetting it.
    // The library sets autocomplete="off" both during init and async when utils.js loads.
    input.setAttribute('autocomplete', 'tel');
    const acObserver = new MutationObserver(() => {
      if (input.getAttribute('autocomplete') !== 'tel') {
        input.setAttribute('autocomplete', 'tel');
      }
    });
    acObserver.observe(input, { attributes: true, attributeFilter: ['autocomplete'] });

    // Store instance
    const instance = {
      input,
      container,
      iti,
      isValid: false,
      validationState: 'idle',
      formattedNumber: null,
      hasBlurred: false, // Track if user has left the field at least once
      rateLimited: false,
      apiUnavailable: false
    };
    phoneInstances.set(input, instance);

    // Setup strict input filtering (numbers only, max length per country)
    setupStrictInput(input, instance);

    // Create debounced validation handler (not blur)
    const debouncedValidation = debounce(() => handleValidation(input, false), CONFIG.debounceMs);

    // Validation on input (debounced) - runs after strict input filtering
    input.addEventListener('input', debouncedValidation);
    
    // Validation on blur (immediate, with blur flag)
    input.addEventListener('blur', () => handleValidation(input, true));
    
    // Validation on country change
    input.addEventListener('countrychange', () => {
      debouncedValidation();
    });

    // Add required attribute handling
    if (input.hasAttribute('required')) {
      input.removeAttribute('required');
      instance.isRequired = true;
    }
  };

  /**
   * Block form submission if phone is invalid
   * @param {HTMLFormElement} form - Form element
   */
  const setupFormValidation = (form) => {
    if (form.dataset.mfzFormInitialized) return;
    form.dataset.mfzFormInitialized = 'true';

    form.addEventListener('submit', (e) => {
      const phoneInputs = form.querySelectorAll('[data-mfz-phone]');
      let hasInvalidPhone = false;

      phoneInputs.forEach((input) => {
        const instance = phoneInstances.get(input);
        if (!instance) return;

        if (!preparePhoneForSubmit(input, instance)) {
          hasInvalidPhone = true;
        }
      });

      if (hasInvalidPhone) {
        e.preventDefault();
        e.stopPropagation();
        
        // Focus first invalid input
        const firstInvalid = form.querySelector('.mfz-invalid input[data-mfz-phone]');
        if (firstInvalid) {
          firstInvalid.focus();
        }
      }
    });
  };

  /**
   * Initialize all phone inputs on the page
   */
  const initAllPhoneInputs = async () => {
    // Wait for intl-tel-input to be available
    if (typeof window.intlTelInput === 'undefined') {
      return;
    }

    // Detect country
    const detectedCountry = await detectCountry();

    document.querySelectorAll('.form-group--phone input[type="tel"]').forEach((input) => {
      if (!input.hasAttribute('data-mfz-phone')) {
        input.setAttribute('data-mfz-phone', '');
      }
    });

    // Find all phone inputs
    const phoneInputs = document.querySelectorAll('[data-mfz-phone]');
    
    if (phoneInputs.length === 0) {
      return;
    }

    // Initialize each input
    phoneInputs.forEach((input) => {
      initPhoneInput(input, detectedCountry);
      
      // Setup form validation
      const form = input.closest('form');
      if (form) {
        setupFormValidation(form);
      }
    });
  };

  /**
   * Reinitialize all phone widgets (e.g. after external DOM changes).
   */
  const reinitAllPhoneInputs = async () => {
    if (typeof window.intlTelInput === 'undefined') return;

    phoneInstances.forEach((instance, input) => {
      try {
        if (instance.iti && typeof instance.iti.destroy === 'function') {
          instance.iti.destroy();
        }
      } catch (e) {}

      const container = instance.container;
      if (container && container.parentNode && input.parentNode === container) {
        container.parentNode.insertBefore(input, container);
        container.parentNode.removeChild(container);
      }

      input.removeAttribute('data-mfz-initialized');
    });

    phoneInstances.clear();
    await initAllPhoneInputs();
  };

  /**
   * Public API
   */
  window.MFZPhone = {
    init: initAllPhoneInputs,
    reinitAll: reinitAllPhoneInputs,
    detectCountry,
    validatePhone: validatePhoneNumber,
    getInstance: (input) => phoneInstances.get(input),
    getFormattedNumber: (input) => {
      const instance = phoneInstances.get(input);
      return instance?.formattedNumber || null;
    },
    isValid: (input) => {
      const instance = phoneInstances.get(input);
      return instance?.isValid || false;
    },
    setCountry: (input, countryCode) => {
      const instance = phoneInstances.get(input);
      if (instance?.iti) {
        instance.iti.setCountry(countryCode.toLowerCase());
      }
    }
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllPhoneInputs);
  } else {
    // DOM already loaded, initialize immediately
    initAllPhoneInputs();
  }

  // Re-initialize for dynamically added content (e.g., Webflow interactions)
  // Only observe after initial load to avoid multiple initializations
  let observerEnabled = false;
  setTimeout(() => {
    observerEnabled = true;
  }, 1000);

  const observer = new MutationObserver((mutations) => {
    if (!observerEnabled) return;
    
    let hasNewPhoneInputs = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const phoneInputs = node.querySelectorAll ? 
            node.querySelectorAll('[data-mfz-phone]:not([data-mfz-initialized])') : [];
          if (phoneInputs.length > 0 || (node.hasAttribute?.('data-mfz-phone') && !node.hasAttribute?.('data-mfz-initialized'))) {
            hasNewPhoneInputs = true;
          }
        }
      });
    });
    
    if (hasNewPhoneInputs) {
      initAllPhoneInputs();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
