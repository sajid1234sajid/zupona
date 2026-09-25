# Zupona Image Fit

Fits product pictures to the shop's frame without cutting any of them.
Live at **https://fit.zupona.com**. The list of every Zupona app is in
[APPS.md](../../APPS.md) at the repository root.

## What it does

A picture goes in whole, scaled to fit inside the chosen frame (4:5 for the
product page, 8:9 for the product card, or 1:1). Only the empty space around
it is filled:

- **Blurred fill** — a blurred copy of the picture. Instant, free, works
  offline, done entirely in the browser.
- **AI fill** — Cloudflare Workers AI (FLUX.2 [klein] 9B) paints the scene
  continuing past the picture's edges. The model's painting is used only as
  the background: the untouched picture is pasted back over the middle, so
  lettering and products are always the original pixels.

## Where the code is

| Path | What |
| --- | --- |
| `shared/fit.ts` | The fitting itself. Also imported by the Zupona admin's image uploader, so both behave the same |
| `src/worker.ts` | The Worker: `POST /api/expand` for this app (needs the access key), and the `ImageFit` RPC entrypoint the shop calls over its service binding |
| `src/expand.ts` | The AI call |
| `web/app.ts`, `public/index.html` | The page |

## Working on it

```bash
cd apps/image-fit
echo "ACCESS_KEY=anything" > .dev.vars   # once
npm run dev                              # builds the page and serves it on :8787
npm run deploy                           # or push to main and let CI do it
```

The access key for the live app is the Worker secret `ACCESS_KEY`:

```bash
npx wrangler secret put ACCESS_KEY -c wrangler.jsonc
```

## Limits

Workers AI on this account runs on the free allowance of 10,000 neurons a
day. When it is spent, the AI answers with an error until 00:00 UTC; the app
and the admin then use the blurred fill instead of failing.
