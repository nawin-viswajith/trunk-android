# Roadmap

Things to do, roughly in order. Nothing below is implemented yet unless
marked done.

## v1.0 (current)

Initial release: on-device inference via llama.rn, Hugging Face
search/download, Projects, Playground (Agents/Flows), Settings.

## v1.0.1 — fix release

- Embedding model inference and benchmark throws an error. Needs
  root-causing and a fix; embedding models likely need a different
  code path than causal chat models (no chat template, different
  output shape), which may not be handled yet.

## v1.1 — external API providers ("the API version")

- Support external LLM API providers (Gemini, Cohere, Groq, etc.) as an
  alternative to on-device-only inference.
- Needs a provider abstraction that both the local llama.rn engine and
  remote API clients implement, plus per-provider API key storage.
- Must be wired into all four surfaces that currently assume a local
  model: **Models** (picking/configuring a provider instead of just a
  downloaded file), **Projects** (a project's model choice), **Inference**
  (chat), and **Playground** (Agents/Flows running against a provider).
- Tension to resolve: this changes the app's current "fully offline, no
  cloud, no account" positioning (see README, onboarding warning, About
  screen) — needs a clear opt-in UX so on-device-only users aren't
  surprised by network calls or where their prompts go.

## v1.2 — document support for LLM

- If the loaded model/provider supports it: attach a document (PDF/text)
  as context for a chat or flow.

## v1.3 — camera capture support for LLM

- If the loaded model/provider supports multimodal input: capture a photo
  and send it as part of a chat or flow.

## v2.0 — NPU support

- Hardware-accelerated inference via the device's NPU, where available,
  instead of CPU/GPU only.

## Smaller/unscheduled

- **About screen "Developer" tile** — a contact/GitHub/feedback link for
  whoever's behind Trunk. Placeholder is commented out in
  `AboutSettingsScreen.tsx` until there's real content to link to.
