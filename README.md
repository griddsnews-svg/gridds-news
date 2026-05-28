# GRIDDS.NEWS — Deployment Package

This folder is your GRIDDS.NEWS website + content API. 

## Files

- `index.html` — The GRIDDS app (UI + tiles + animations)
- `api/edition.js` — Reads your Google Sheet, returns today's edition as JSON
- `vercel.json` — Tells Vercel how to host everything
- `package.json` — Project metadata

## How content flows

1. You edit stories in the Google Sheet (set Status = LIVE to publish)
2. The app calls `/api/edition` on launch
3. The API fetches your sheet, returns only LIVE stories
4. Cached for 5 minutes (so the sheet isn't hammered)
5. App updates automatically every time it loads

## Sheet ID hardcoded

The sheet ID `1c91ctKwDGJUkWnicAycilNyg_B0-lCqj1zrSYNhe2Zo` is set in `api/edition.js`.
If you ever change sheets, update line 8.

## Going live

1. Upload this folder as a GitHub repository
2. Connect repository to Vercel
3. Deploy — Vercel detects everything automatically
4. Connect your domain `gridds.news` from GoDaddy

That's it.
