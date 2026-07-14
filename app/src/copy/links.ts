// Centralized so the feedback prompt (App.tsx) and the manual Feedback tile
// (AboutSettingsScreen.tsx) can never drift onto two different links.
// User-provided form URL — not guessed.
export const FEEDBACK_FORM_URL = "https://forms.cloud.microsoft/r/ZetxpjPEkA";

// Render static site - service name "tuskerlabs-website" (see render.yaml
// in the tuskerlabs-website repo), giving this default onrender.com
// subdomain until/unless a custom domain is attached.
export const TUSKERLABS_WEBSITE_URL = "https://tuskerlabs-website.onrender.com";
export const TRUNK_PRODUCT_URL = "https://tuskerlabs-website.onrender.com/trunk/";

// The public source repo - shown in Developer Options, not About, since it's
// aimed at whoever's testing/building the app, not end users.
export const TRUNK_ANDROID_REPO_URL = "https://github.com/nawin-viswajith/trunk-android";
