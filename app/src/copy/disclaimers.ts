/** Shared verbatim copy for the performance/thermal disclaimer, shown both
 * during first-launch onboarding (OnboardingFlow.tsx) and from Home's help
 * modal (HelpModal.tsx) — kept in one place so the two never drift apart. */
export const PERFORMANCE_DISCLAIMER = {
  title: "Performance & Heat",
  body: "Running an LLM on-device is CPU/GPU intensive. Your phone may heat up and its battery may drain faster while generating a response. This is expected, not a fault.",
  emphasis:
    "Not every phone has enough RAM or processing power to run these models well. Performance, or whether a model runs at all, varies a lot by device. Proceed at your own risk.",
};
