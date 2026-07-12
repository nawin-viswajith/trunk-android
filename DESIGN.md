# Trunk design language

A reference for anyone (human or otherwise) building new screens or
components for Trunk. The short version: **flat, sharp-edged, no
decoration for decoration's sake.** Everything below exists to keep that
consistent as the app grows.

## Principles

- **Flat and sharp-edged.** No gradients, no drop shadows, no `borderRadius`
  anywhere except a short, deliberate exception list: FABs (circular),
  palette swatch balls, `CheckIndicator`'s checkbox. When in doubt, use a
  sharp corner.
- **Borders carry structure, not fills.** Cards, buttons, and inputs are
  outlined (1px border) rather than filled with a background tint. Active/
  selected states get a slightly heavier border (3px) or a tinted
  background at low opacity (`color + "22"`), never a hard color swap.
- **Every color comes from `useColors()`**, never a hardcoded hex in a
  component. The one deliberate exception is the boot splash, which always
  renders black+white regardless of theme, for visual continuity with the
  native OS splash screen underneath it.
- **No icon library, no emoji.** Icons are either a single Unicode glyph
  (tab bar, buttons) or hand-drawn from plain `View`s (see
  `CheckIndicator.tsx`, `TrashIcon.tsx`). Adding an icon font/SVG library
  means a new native dependency and another prebuild/rebuild cycle for
  something a few `View`s already solve.
- **Body text is justified** (`textAlign: "justify"`); titles, labels, and
  button text are not — justification only visibly does anything on
  multi-line paragraphs.

## Color system

Six accent presets plus a Greyscale option, each a coordinated three-tone
palette (primary/secondary/tertiary, Material-Design-style), defined in
`app/src/theme/colors.ts` (`ACCENT_PRESETS`):

| Preset | Primary | Secondary | Tertiary |
|---|---|---|---|
| Ocean (default) | blue | cyan | indigo |
| Mint | teal | green | lime |
| Forest | green | lime | amber |
| Violet | purple | pink | indigo |
| Sunset | orange | red | amber |
| Blossom | pink | purple | indigo |
| Greyscale | light grey | mid grey | dark grey — a contrast ramp, not a hue |

Every tone carries **independently-tuned dark- and light-mode shades** —
never assume one hex works for both backgrounds. A custom hex picker is also
available (three fields, saved as `accentPreset: "custom"`).

Dark mode has two contrast levels via `darkContrast` in
`useSettingsStore.ts`: **Standard** (dark grey background) and **Pitch
Black** (true OLED black). `colors.surface`/`colors.surfaceAlt` must stay
visibly distinct from `colors.background` even in Pitch Black mode, or
cards/headers/modals disappear into the background.

## Typography

**Urbanist** (`@expo-google-fonts/urbanist`), loaded at boot via
`useAppFonts()` in `App.tsx`. Three weights are loaded and used app-wide:
Regular (400, body text), SemiBold (600, headers/labels/emphasis), Bold (700,
rare — a handful of strong emphasis cases). `src/theme/fonts.ts`'s
`fontFamilyForWeight(weight, useCustomFont)` maps whatever `fontWeight` a
style already specifies to the correct pre-loaded font file — Android can't
synthesize bold/semibold on a custom TTF the way it can for system fonts, so
every weight actually used needs its own explicit font file loaded up front.

Every `<Text>`/`<TextInput>` in the app should come from
`src/components/Text.tsx` / `TextInput.tsx` (drop-in wrappers around RN's own,
already the default via editor auto-import once one instance exists per
file) — not `react-native`'s directly — so the font applies automatically
and reacts live to the Settings toggle below. React Navigation's own header
titles and tab bar labels are a separate exception: they're styled directly
via `headerTitleStyle`/`tabBarLabelStyle` in each navigator's
`screenOptions`, since React Navigation renders those with its own internal
`Text`, not ours.

**Exception:** filenames, quantization strings, and stats (tok/s, sizes,
timestamps) always use `fontFamily: "monospace"` deliberately, for a
terminal/technical read. Never switch these to Urbanist — a style that sets
its own `fontFamily` always wins over the wrapper's default.

Users can turn Urbanist off entirely in **Settings → Typography** (falls
back to the OS default system font) — this is a live, reactive toggle
(`useCustomFont` in `useSettingsStore.ts`), not a restart-required setting.

## Spacing

A five-step scale (`spacing` in `src/theme/colors.ts`) used for all padding/
margin/gap — no magic pixel numbers in component styles:

```
xs: 4    sm: 8    md: 16    lg: 24    xl: (see colors.ts)
```

## Components (reuse these, don't reinvent)

- **`Button`** — one template for every variant (`primary`/`secondary`/
  `danger`/`neutral`): outlined/unfilled, border color === text color,
  centered label. No per-variant solid-fill or tinted-fill special cases.
- **`Card`** — flat bordered container, standard padding.
- **`ConfirmModal`** — app-styled yes/no dialog for destructive confirmations
  (delete project, bulk delete, etc).
- **`AlertModal`** (`useAlertStore` + `showAlert(title, message, buttons?)`)
  — app-styled replacement for every informational/multi-button popup.
  **Never use native `Alert.alert`** anywhere in this app — it renders as a
  bare platform dialog and breaks visual consistency; `showAlert(...)` is a
  drop-in equivalent callable from anywhere, not just components.
- **`PickerModal`** — generic scrollable list-picker (label/value options,
  checkmark for the active one).
- **`CheckIndicator`** — the one deliberate rounded shape besides FABs/
  swatches: a filled square + drawn checkmark, used for both single-select
  "active" rows and multi-select tiles. Purely visual — wrap it in a
  `Pressable` for interactivity.
- **`ScreenHeader`** — title row for root tab screens only (Home/Models/
  Projects/Playground/Inference). Sub-screens reached via a stack push get
  the default native header instead (see Navigation below). Root screens
  each get a "GUIDE" button (a page-specific Prev/Next/Close walkthrough via
  `PageGuideModal`) except Home, which keeps a single "i" button opening
  `HelpModal` — a one-shot summary of every tab, not a multi-step guide.

## Navigation

Bottom tabs (`RootNavigator.tsx`), each registered as
`<Tab.Screen name="X" component={withSwipe(XScreen)} />`, glyph icons via the
`ICONS` map. Swipe-between-tabs is handled by `SwipeableScreen.tsx`'s
`TAB_ORDER` array — **any new root tab must be added there too**, or
fling-swipe breaks at that boundary. Sub-screens within a tab that need push
navigation use a locally-defined `createNativeStackNavigator()` (see
`ModelsStackNavigator`, `PlaygroundStackNavigator` in `RootNavigator.tsx`).

## Interaction patterns

- **Hold-to-select + bulk delete** (`ModelsScreen.tsx`/`ProjectsScreen.tsx`/
  `FlowListScreen.tsx`): long-press enters selection mode, tap toggles
  selection, a full-width bottom bar splits Cancel/Delete 50/50,
  `ConfirmModal` gates the actual delete.
- **Two-step confirmation for risky/destructive-adjacent actions** (e.g.
  downloading a model flagged as likely to crash from OOM): an initial
  warning, then a second, harder confirmation spelling out concrete
  consequences — proceeding past both is an explicit, informed choice, not
  a single dismissible dialog.
- **Contextual popup wording**: a popup offering "go to X" should check
  whether the user is already there and simplify to a single "OK" if so —
  see `isModelsTabActive()` in `HuggingFaceFilesScreen.tsx` for the pattern
  (walk up to the root Tab.Navigator and check the active route, re-checked
  fresh at the moment the popup fires, not at render time).

## Persistence

Zustand + `persist` + `AsyncStorage`, one store per concern
(`useProjectStore`, `useSettingsStore`, `useFlowStore`, `useDownloadStore`,
`useNetworkPromptStore`, `useAlertStore`): plain interfaces per entity, a
`randomId()` helper, actions via `set((state) => ({...}))`, selectors
exported as standalone functions (`selectProject(projects, id)`) rather than
derived inline inside components. Ephemeral, in-memory-only state (active
downloads, pending alerts/prompts) deliberately skips the `persist` wrapper.

## Branding assets

`docs/branding/` holds the master artwork: `trunk-logo.svg` (vector source
of truth) and `icon-master-3000.png` (flattened high-res raster export, for
press kits/store listings). Every file actually bundled into the app
(`app/assets/icon.png`, `android-icon-foreground.png`,
`android-icon-background.png`, `android-icon-monochrome.png`,
`splash-icon.png`, `favicon.png`) is cropped/scaled from that same source at
whatever proportions each platform slot requires — see
`docs/branding/README.md`.
