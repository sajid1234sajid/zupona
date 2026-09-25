# সব App-এর Link — All Zupona apps in one place

Every app, site and tool built for Zupona is listed here with its links, so
nothing has to be searched for in old chats. **When a new app, subdomain,
repository or tool is added, it is added to this file in the same change.**

Secrets (passwords, API keys, access keys) are never written here: this
repository is public.

---

## 1. Zupona shop — the storefront

| | |
| --- | --- |
| What it is | The shop customers buy from |
| Live | https://zupona.com |
| Code | https://github.com/sajid1234sajid/zupona (this repository) |
| Runs on | Cloudflare Worker `zupona` |
| Updates | Push to `main` → live in 1–2 minutes |

## 2. Admin panel — the owner's control room

| | |
| --- | --- |
| What it is | Every product, order, seller, setting and report |
| Live | https://admin.zupona.com |
| Code | Same repository, [`src/app/admin/`](src/app/admin/) |
| Runs on | The same `zupona` Worker |

## 3. Seller Center — one seller's own shop panel

| | |
| --- | --- |
| What it is | Where an approved seller manages their products and orders |
| Live | https://seller.zupona.com |
| Public door | https://zupona.com/sell |
| Code | Same repository, [`src/app/seller/`](src/app/seller/) |
| Runs on | The same `zupona` Worker |

## 4. Zupona Image Fit — fits product pictures to the product frame

| | |
| --- | --- |
| What it is | Drop in any product picture and get it back at the shop's 4:5 product shape (or 8:9 / 1:1). **Nothing is ever cropped**: the picture goes in whole, and only the space around it is filled — with a blurred copy (instant, free) or with scenery an AI paints to continue the picture |
| Live | https://fit.zupona.com |
| Code | https://github.com/sajid1234sajid/zupona/tree/main/apps/image-fit |
| Runs on | Cloudflare Worker `zupona-image-fit`, AI by Cloudflare Workers AI (FLUX.2 klein 9B) |
| Updates | Push a change under `apps/image-fit/` to `main` → deployed by the *Deploy Image Fit* workflow |
| Access key | Needed only for the AI option. Kept as the Worker secret `ACCESS_KEY`; to change it: `cd apps/image-fit && npx wrangler secret put ACCESS_KEY -c wrangler.jsonc` |
| Inside the admin | **Add Product** fits every gallery picture automatically. Choose AI / blur / off in **Settings → Product Pictures**. Each fitted picture has an undo button |
| Limit | The AI runs on the Cloudflare account's free allowance of 10,000 neurons a day. When that is used up, the app and the admin fall back to the blurred fill until the next day (reset 06:00 Bangladesh time) |

## 5. Android apps

| App | Download |
| --- | --- |
| Zupona shop | https://github.com/sajid1234sajid/zupona/releases/latest/download/zupona.apk |
| Zupona admin | https://github.com/sajid1234sajid/zupona/releases/latest/download/zupona-admin.apk |

Built by the *Build Android app* workflow; see [`android/README.md`](android/README.md).

---

## Where the machinery lives

| | |
| --- | --- |
| GitHub repository | https://github.com/sajid1234sajid/zupona |
| Deploy runs | https://github.com/sajid1234sajid/zupona/actions |
| Cloudflare dashboard | https://dash.cloudflare.com (account sajedaakter589@gmail.com) |
| Deeper background | [HISTORY.md](HISTORY.md) — accounts, deployment, older builds |
