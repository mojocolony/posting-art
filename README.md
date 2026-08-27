# Posting Art

Posting Art prepares photographs of artwork for Facebook and Instagram without cropping the original art. This edition is a static GitHub Pages app with private, synchronized posting history stored in Firebase Authentication and Cloud Firestore.

## Features

- Portrait (4:5), square (1:1), and story (9:16) output formats
- Original artwork proportions preserved in every format
- TIFF import with local, non-destructive conversion
- Four border colours generated from each uploaded artwork
- Adjustable solid or blurred borders
- Saturation controls and painting-matched text colours that adapt to the selected border
- Full-resolution JPG export
- Native mobile sharing and desktop download
- Synchronized posting history for approved users
- Responsive desktop, tablet, and mobile layouts

## Firebase setup

The app is connected to its dedicated **Posting Art** Firebase project. Email/password authentication, the two approved accounts, the Toronto Firestore database, and its restricted security rules were configured before this release was packaged.

The included `firestore.rules` is a reusable template only. The published rules in Firebase are authoritative and contain the approved account addresses; keep those addresses out of a public GitHub repository.

Thumbnails are compressed and stored directly in Firestore, so Cloud Storage and the Blaze billing plan are not required.

## Run locally

```bash
npm ci
npm run dev
```

## Deploy on GitHub Pages

Upload the project to the `posting-art` repository. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. Each update to the `main` branch will deploy automatically.

## Version

1.2.1
