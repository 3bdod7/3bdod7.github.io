# ABDUH DEALS: Setup & Daily Use Guide

A free website for your TikTok bio. Visitors type the **product number** from your video and land straight on the product with a buy button.

- **Cost:** 0 SAR/month. Hosting on GitHub Pages is free; an optional custom domain costs about 40–60 SAR/year.
- **Updating:** edit a Google Sheet. The site updates itself within about 1–5 minutes, and you never touch code.

---

## One-time setup (about 20 minutes)

### Step 1: Create your products sheet (Google Sheets)
1. Go to **sheets.google.com** → **Blank spreadsheet**.
2. **File → Import → Upload** → choose `products.csv` (from this folder) → **Replace current sheet** → **Import data**.
3. You now have the template with example rows. Replace them with your own products later.

### Step 2: Make the sheet readable by the site
1. In the sheet: **File → Share → Publish to web**.
2. Under "Link", choose your sheet tab (e.g. *Sheet1*), then choose **Comma-separated values (.csv)**.
3. Click **Publish** → **OK**, then **copy the link** (it ends with `output=csv`).

> Only a read-only copy is published. Nobody can edit your sheet. (Option B: **Share → "Anyone with the link" → Viewer** and copy that link. The site also accepts that type of link.)

### Step 3: Put the site online for free (GitHub Pages)
1. Create a free account at **github.com**. Pick your username carefully, because it becomes your site address.
2. Click **+** (top right) → **New repository**.
   - Repository name: `YOUR-USERNAME.github.io` (exactly your username + `.github.io`)
   - Select **Public** → **Create repository**.
3. On the new repository page click **"uploading an existing file"**. Drag in **all files from this folder** (`index.html`, `style.css`, `app.js`, `config.js`, `products.csv`, the `images` folder with your logo) → **Commit changes**.
4. Open `config.js` in the repository → click the ✏️ pencil icon → change:
   - `name`, `bio`: your page name and the line under it
   - `sheetCsvUrl`: paste the link from Step 2 between the quotes
   - `tiktok`, `telegram`: your profile links
   - `avatar` is already set to your logo (`images/logo.webp`)
   - Click **Commit changes**.
5. Go to **Settings → Pages**. Under "Build and deployment", Source = **Deploy from a branch**, Branch = **main** / **(root)** → **Save**.
6. Wait 1–2 minutes, then open **https://YOUR-USERNAME.github.io** 🎉
7. (Recommended) Open `index.html` → ✏️ → find `og:image` and change `images/logo-512.jpg` to the full address `https://YOUR-USERNAME.github.io/images/logo-512.jpg`. Your logo then appears when the link is shared on WhatsApp, Telegram and X.

### Step 4: Put it in your TikTok bio
TikTok → **Edit profile → Website** → paste your site address.
(TikTok shows the bio link on Business accounts or accounts with enough followers. If you don't see the Website field, switch to a free **Business account** in Settings.)

### Step 5: Tell Amazon about your site (important!)
In **Amazon Associates (affiliate-program.amazon.sa) → Account Settings → Edit Your Website and Mobile App List**, add your new site address. Amazon requires every place you post links to be listed.

---

## Daily workflow: adding a product (≈1 minute)

1. **Get your affiliate link**
   - **Amazon.sa:** open the product while logged in → SiteStripe bar at the top → **Get Link** → copy the short `amzn.to` link.
   - **AliExpress:** AliExpress Portals → **Link Generator** (or the "Share/Earn" button in the app) → copy the `s.click.aliexpress.com` link.
2. **Add a new row** in your sheet:

| column | what to write | example |
|---|---|---|
| `code` | the product number you say in the video | `12` |
| `title` | short product name | `سماعات لاسلكية بعزل ضوضاء` |
| `image` | image link (see tips below) | `https://…jpg` or `images/12.jpg` |
| `store` | `amazon` or `aliexpress` (auto-detected from the link if empty) | `amazon` |
| `link` | **your affiliate link** | `https://amzn.to/xxxx` |
| `badge` | optional yellow label | `عرض محدود` |
| `active` | `no` to hide a product (expired deal) without deleting it | `yes` |
| `added` | date as `YYYY-MM-DD`; newest shows first and gets a "جديد" badge | `2026-11-24` |

3. That's it. The site updates within a few minutes.

Arabic column names also work (رقم، الاسم، الصورة، المتجر، الرابط، شارة، ظاهر، التاريخ). Prices aren't shown on the site, so there's no need to keep them updated.

### In your TikTok video / caption
> "الرابط في البايو 👆 — اكتب رقم **12**"

Visitors tap your bio link, type `12`, and see only that product with a big buy button. Arabic digits (١٢) also work.

**Direct product link:** `https://YOUR-USERNAME.github.io/?p=12` opens product #12 directly. Use it in your Telegram posts, pinned comments, WhatsApp and Instagram stories. Each product card also has a **share** button that copies this link.

---

## Tips to get more clicks & commissions
- **Number every product in the video** (big text on screen: "#12"). This is the key to fast finding.
- Keep **`added`** dates filled in so the newest product is always at the top (most visitors come from your latest video).
- Hide expired deals with `active = no` instead of deleting them, so you can reuse them later.
- Use your **Telegram post links** as `https://YOUR-SITE/?p=12`. The Telegram banner on the site also brings viewers back to your channel.

## Images: what to use
- **Best:** your own photo or a screenshot from your TikTok video. Upload it to the repository's `images` folder (GitHub → open `images` → **Add file → Upload files**) and write `images/12.jpg` in the sheet.
- AliExpress image links (`ae01.alicdn.com/…jpg`) usually work fine: right-click the product image → **Copy image address**.
- ⚠️ Amazon's affiliate rules restrict copying product images from Amazon's site. Using your own photos is the safe option.

## Free click statistics (optional)
1. Sign up free at **goatcounter.com** and choose a code, e.g. `abukhaled`.
2. Put it in `config.js`: `goatcounterCode: "abukhaled"`.
3. Your GoatCounter dashboard then shows visits plus every buy-button click (`click/amazon/12`), search and share, so you can see which products and videos work best. Sales and commissions remain in your Amazon/AliExpress dashboards.

## Optional: your own domain
Buy a domain (e.g. from Namecheap or Cloudflare, ~40–60 SAR/year) → GitHub **Settings → Pages → Custom domain**. Optional; the free `github.io` address works fine.

## Troubleshooting
| problem | fix |
|---|---|
| Products don't update | Wait ~5 minutes (Google caches the published sheet). Make sure the row has a `link` and `active` isn't `no`. |
| "تعذّر تحميل المنتجات" or old example products | Re-check Step 2 (published as **CSV**) and that `sheetCsvUrl` in `config.js` is between quotes. |
| A product doesn't appear | It needs a `link` starting with `https://` and a `title` or `code`. |
| Image doesn't show | The image link must open the picture directly in a new tab. Otherwise use `images/…`. |
| Site shows 404 | Check that the repository name is exactly `YOUR-USERNAME.github.io` and Pages is enabled (Step 3.5). |

## Brand & fonts
- Colours come from your identity sheet: orange `#FB6002`, amber `#FD9F0B`, fire red `#F13000`, black `#09090B`, white. The orange gradient is used only on buy buttons and badges, as the sheet specifies.
- The site follows the visitor's phone setting: **white** in light mode, **black** in dark mode (both approved logo backgrounds).
- **Font:** the site uses **IBM Plex Sans Arabic** (free, open license, loaded from Google Fonts). **Thmanyah Sans is not uploaded to the site**, because its license forbids hosting the font files on a website or making them downloadable, which a public site would do. Keep using Thmanyah in your logo, TikTok videos and designs; that's allowed. If you ever want Thmanyah on the site, ask Thmanyah for web-embedding permission at ask@thmanyah.com.

## Files in this folder
| file | edit it? |
|---|---|
| `config.js` | ✅ once at setup (name, links, sheet link) |
| `products.csv` | template to import into Google Sheets; also used as a backup if the sheet can't be reached |
| `images/` | your logo + favicons are here; ✅ upload product photos here too (optional) |
| `index.html`, `style.css`, `app.js` | ❌ no need to touch |
