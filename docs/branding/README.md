# Trunk / TuskerLabs branding assets

- `trunk-logo.svg` — the vector source of truth (1500x1500 viewBox, black background rect + white geometric mark as flat polygon paths). Regenerate every raster asset below from this file if the mark itself ever changes.
- `icon-master-3000.png` — flattened, high-resolution (3000x3000) raster export of the same mark, for store listings, press kits, and marketing thumbnails. Generous padding around the mark (not cropped tight to the adaptive-icon safe zone the way `app/assets/android-icon-foreground.png` is), so it reads well at any size down to a small thumbnail.

The in-app icon files actually used by the build live in `app/assets/` (`icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `splash-icon.png`, `favicon.png`) and are derived from the same source artwork, just cropped/scaled differently per platform requirement.
