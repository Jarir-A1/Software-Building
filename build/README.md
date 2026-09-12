# Build assets

This directory holds packaging assets consumed by electron-builder.

## Icons

- `icon.png` - 512x512 RGBA, the Linux icon and the canonical source mark.
- `icon.ico` - Windows multi size icon (16, 24, 32, 48, 64, 128, 256) used for
  the app, the NSIS installer, and the uninstaller.

### Source and licensing of the mark

The WordSetu mark is an **original design** created for this project. It is not
copied, traced, or derived from any existing logo, font, or copyrighted artwork.
It is generated procedurally by [`scripts/gen-icons.mjs`](../scripts/gen-icons.mjs),
which draws a rounded square tile with a diagonal indigo to teal gradient and a
geometric "W" (for WordSetu) sitting on a small horizontal bar. The bar is a nod
to the Bangla word "setu" (bridge). The mark is released under the same MIT
license as the rest of the WordSetu code (see the repository `LICENSE`).

### Regenerating the icons

The generator uses only Node built ins (no external image libraries):

```bash
node scripts/gen-icons.mjs
```

This rewrites `build/icon.png` and `build/icon.ico`. Commit the regenerated
files if the mark changes.

## Optional NSIS installer bitmaps

electron-builder can use custom installer artwork (for example a sidebar BMP or
header BMP). WordSetu does not ship custom NSIS bitmaps; the installer uses the
electron-builder defaults plus the `installerIcon` / `uninstallerIcon` derived
from `icon.ico`. To add branded bitmaps later, place them here and reference
them from the `nsis` block in `electron-builder.yml`.
