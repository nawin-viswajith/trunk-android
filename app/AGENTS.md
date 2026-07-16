# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Trunk

**Brand:** TuskerLabs
**Product:** Trunk
**Purpose:** an Android app that runs LLMs entirely on-device. Search Hugging
Face, download a GGUF model straight to the phone, and chat with it fully
offline via `llama.rn` (llama.cpp compiled into the app). No cloud, no
account, nothing synced - if the app is uninstalled, chat data cannot be
recovered (this is disclosed to the user during onboarding).

Open source, MIT licensed - see `../LICENSE`. See `../DESIGN.md` for the full
design-language reference (this section is the terse dev-facing summary).

## Design language (apply to every new screen/component)

- **Flat and sharp-edged.** No gradients. No `borderRadius` except a short
  list of deliberate exceptions: FABs (circular), palette swatch balls,
  `CheckIndicator`'s checkbox. When in doubt, sharp corners.
- **Colors always come from `useColors()`** (`src/theme/ThemeContext.tsx`),
  never hardcoded hex in a component, except the boot splash which
  intentionally always renders black+white regardless of theme (visual
  continuity with the native splash screen).
- **Six accent presets + Greyscale** (`ACCENT_PRESETS` in
  `src/theme/colors.ts`), each with independently-tuned light/dark values -
  never assume one hex works for both modes. Two dark-contrast levels
  (standard dark-grey, pitch-black OLED) via `darkContrast` in
  `useSettingsStore.ts`; `colors.surface`/`colors.surfaceAlt` must stay
  visibly distinct from `colors.background` even in pitch-black mode, or
  headers/cards/modals become invisible.
- **Spacing scale** (`spacing.xs/sm/md/lg/xl` in `src/theme/colors.ts`) for
  all padding/margin/gap - no magic pixel numbers.
- **Icons are single Unicode glyphs** (tab bar, buttons) **or hand-drawn from
  plain Views** (see `CheckIndicator.tsx`, `TrashIcon.tsx`) - never emoji,
  never a new icon-font or SVG library. Adding an icon library means a new
  native dependency and another prebuild/rebuild cycle for something a few
  Views already solve.
- **Paragraph/body text is justified** (`textAlign: "justify"`); titles,
  labels, and button text are not (justify only does anything visible on
  multi-line text).
- **Every screen/component**: `const styles = useMemo(() => createStyles(colors), [colors])`,
  a `createStyles(colors: ColorPalette)` function returning `StyleSheet.create({...})`.

## Component reuse (don't reinvent these)

- `Button` - one template for every variant (`primary`/`secondary`/`danger`/`neutral`):
  outlined/unfilled, border color === text color, centered label. No
  per-variant solid-fill or tinted-fill special cases.
- `Card` - flat bordered container, standard padding.
- `ConfirmModal` - app-styled yes/no dialog. **Never use native `Alert.alert`
  for a confirmation** (destructive actions especially) - it looks like a
  bare Android dialog and breaks the whole app's visual consistency. Native
  `Alert.alert` is still fine for one-button informational messages.
- `PickerModal` - generic scrollable list-picker (label/value options, checkmark).
- `CheckIndicator` - classic checkbox visual (filled square + drawn check),
  used for both single-select "active" rows and multi-select tiles.
- `ScreenHeader` - title row for root tab screens only (Home/Models/Projects/
  Inference/Playground); sub-screens reached via a stack get the default
  native header instead.
- Hold-to-select + bulk delete pattern (see `ModelsScreen.tsx`/`ProjectsScreen.tsx`):
  long-press enters selection mode, tap toggles selection, a full-width
  bottom bar splits Cancel/Delete 50/50, `ConfirmModal` gates the actual delete.

## Navigation

Bottom tabs (`RootNavigator.tsx`) each registered as
`<Tab.Screen name="X" component={withSwipe(XScreen)} />`, glyph icons in the
`ICONS` map. Swipe-between-tabs is handled by `SwipeableScreen.tsx`'s
`TAB_ORDER` array - **any new root tab must be added to that array too**, or
fling-swipe breaks at the boundary. Sub-screens within a tab that need their
own stack use a locally-defined `createNativeStackNavigator()`.

## Persistence pattern

zustand + `persist` + `AsyncStorage`, one store per concern
(`useProjectStore.ts`, `useSettingsStore.ts`, `useFlowStore.ts`): plain
interfaces for each entity, a `randomId()` helper, actions via
`set((state) => ({...}))`, selectors exported as standalone functions
(`selectProject(projects, id)`) rather than derived inside components.

## Inference

All model execution goes through `src/services/llamaEngine.ts`
(`ensureLoaded(modelPath, params)` then `complete(params, onToken)`). Only one
model context is ever loaded at a time (module-level singleton) - this is
relied on by the Playground feature (agents in a flow share whichever model
is currently loaded, no per-agent model switching).

## Current features

Home, Models (download/import GGUF, Hugging Face browse+search), Projects
(model + inference params + multi-session chat history), Inference (chat),
Settings (theme/palette/stats), first-launch onboarding, and **Playground**
(visual agent-orchestration: reusable Agents wired into linear Flows on a
touch node canvas - see `src/state/useFlowStore.ts`,
`src/services/flowRunner.ts`, `src/screens/playground/`).
