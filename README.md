# MFZ Phone - Webflow Integration

International phone input with automatic country detection and real-time validation for Webflow websites.

## Features

- **Automatic Country Detection**: Detects user's country from IP address and pre-selects it
- **International Phone Input**: Beautiful country dropdown with flags and dial codes
- **Real-time Validation**: Validates phone numbers as users type
- **Form Submission Blocking**: Prevents form submission until phone is valid
- **Webflow Native Forms**: Works seamlessly with Webflow's form system
- **Mobile Friendly**: Touch-optimized dropdown and responsive design
- **Dark Mode Support**: Automatically adapts to user's color scheme preference

## Quick Start

### Step 1: Add CSS to Head

Go to **Site Settings → Custom Code → Head Code** and add:

```html
<!-- intl-tel-input CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.1/build/css/intlTelInput.css">

<!-- MFZ Phone CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Creo-Global/mfz-phone-validation@main/mfz-phone.css">
```

### Step 2: Add Scripts to Footer

Go to **Site Settings → Custom Code → Footer Code** and add:

```html
<!-- intl-tel-input Library -->
<script src="https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.1/build/js/intlTelInput.min.js"></script>

<!-- MFZ Phone Library -->
<script src="https://cdn.jsdelivr.net/gh/Creo-Global/mfz-phone-validation@main/mfz-phone.js"></script>
```

### Step 3: Add Attribute to Phone Inputs

In Webflow Designer:

1. Select your phone input field
2. Go to **Element Settings** (the gear icon)
3. Scroll down to **Custom Attributes**
4. Add a new attribute:
   - **Name**: `data-mfz-phone`
   - **Value**: (leave empty)

That's it! The phone input will now have country detection and validation.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         Page Load                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Script detects user's country via IP API                    │
│  2. Country is cached in sessionStorage                         │
│  3. Phone inputs are transformed with country dropdown          │
│  4. Detected country is pre-selected                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      User Interaction                           │
├─────────────────────────────────────────────────────────────────┤
│  1. User types phone number                                     │
│  2. Number is validated via API (debounced 300ms)               │
│  3. Visual feedback shown (✓ valid, ✕ invalid)                  │
│  4. Form submission blocked if invalid                          │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

The default configuration:

| Setting | Default | Description |
|---------|---------|-------------|
| Default Country | UAE (AE) | Fallback if IP detection fails |
| Debounce | 300ms | Delay before validating |
| Caching | sessionStorage | Country cached per session |

## Validation States

| State | Visual | Description |
|-------|--------|-------------|
| Idle | Normal input | No validation yet |
| Validating | Orange spinner | API call in progress |
| Valid | Green checkmark (✓) | Phone is valid |
| Invalid | Red X (✕) | Phone is invalid |

## JavaScript API

The library exposes a global `MFZPhone` object:

```javascript
// Re-initialize (for dynamically added inputs)
MFZPhone.init();

// Get detected country
const country = await MFZPhone.detectCountry();

// Validate a phone number manually
const result = await MFZPhone.validatePhone('+14155552671', 'US');

// Check if an input is valid
const input = document.querySelector('[data-mfz-phone]');
const isValid = MFZPhone.isValid(input);

// Get formatted number (E.164 format)
const formatted = MFZPhone.getFormattedNumber(input);

// Change country programmatically
MFZPhone.setCountry(input, 'GB');
```

## Webflow Form Data

When a form is submitted with a valid phone:

- Original input: Contains the number as displayed
- Hidden input `{name}_formatted`: Contains E.164 format (e.g., `+14155552671`)

This ensures you receive a standardized phone number format in your form submissions.

## Troubleshooting

### Phone input not transforming

1. Check that `data-mfz-phone` attribute is added to the input
2. Verify scripts are loaded in the correct order (intl-tel-input before mfz-phone)
3. Check browser console for errors

### Validation not working

1. Ensure the API endpoint is accessible: `https://api.creoglobal.co/phone/validate`
2. Check browser console for CORS or network errors

### Country not detected correctly

1. The API detects country based on user's IP address
2. VPN users may see their VPN's country
3. If detection fails, UAE is used as default

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome for Android)

## API Endpoints

This library uses the following API endpoints:

- **IP Detection**: `GET https://api.creoglobal.co/ip`
- **Phone Validation**: `GET https://api.creoglobal.co/phone/validate?phone={phone}&countryCode={code}`

## License

MIT License - Use freely in your projects.
