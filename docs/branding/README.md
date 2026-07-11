# Trunk / TuskerLabs branding assets

- `icon-source-original.png` -- the original artwork as delivered (1254x1254, black background, white geometric mark). Keep this as the source of truth if the icon is ever regenerated at a different size or crop.
- `icon-master-2048.png` -- flattened, high-resolution (2048x2048) master for store listings, press kits, and marketing thumbnails. Generous padding around the mark (not cropped tight to the adaptive-icon safe zone the way `app/assets/android-icon-foreground.png` is), so it reads well at any size down to a small thumbnail.

The in-app icon files actually used by the build live in `app/assets/` (`icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `splash-icon.png`, `favicon.png`) and are derived from the same source artwork, just cropped/scaled differently per platform requirement.
