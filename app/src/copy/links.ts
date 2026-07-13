// Centralized so the feedback prompt (App.tsx) and the manual Feedback tile
// (AboutSettingsScreen.tsx) can never drift onto two different links.
// User-provided form URL — not guessed.
export const FEEDBACK_FORM_URL = "https://forms.cloud.microsoft/r/ZetxpjPEkA";

// TODO: placeholders until the real TuskerLabs/Trunk marketing site URLs
// are confirmed (new website repo + Render hosting in progress) - not
// guessed, since a wrong link here is worse than no link.
export const TUSKERLABS_WEBSITE_URL = "https://tuskerlabs.dev";
export const TRUNK_PRODUCT_URL = "https://tuskerlabs.dev/trunk";

// The public source repo - shown in Developer Options, not About, since it's
// aimed at whoever's testing/building the app, not end users.
export const TRUNK_ANDROID_REPO_URL = "https://github.com/nawin-viswajith/trunk-android";
