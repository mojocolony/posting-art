# Posting Art

Posting Art is a focused web app for preparing photographs of artwork for Facebook and Instagram without cropping the original art.

## Features

- Portrait (4:5), square (1:1), and story (9:16) output formats
- Original artwork proportions preserved in every format
- Adjustable solid or blurred borders
- Saturation control
- Optional resizable text with font, colour, quick-position, slider, and drag controls
- Full-resolution JPG export
- Native mobile sharing with a desktop download fallback
- Posting history with Instagram and Facebook dates
- Responsive desktop, tablet, and mobile layouts

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Create and validate a production build:

```bash
npm run build
```

## Storage

Posting history uses Cloudflare D1 for records and R2 for thumbnails. The logical bindings are declared in `.openai/hosting.json` as `DB` and `BUCKET`. The app can still prepare and export images if posting history is temporarily unavailable.

## Project structure

- `app/page.tsx` contains the editing interface and image-export workflow.
- `app/globals.css` contains the responsive design.
- `app/api/history/` contains the history API routes.
- `db/` and `drizzle/` contain the D1 schema and migration.
- `public/` contains the app icon and sample artwork.
- `.openai/hosting.json` contains the Sites deployment configuration.

## Version

1.0.2
