# MIAS MDX Bot
**Owner: 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x**

A WhatsApp bot + music player website. When someone visits your site, it asks if they want to listen to music — if they say yes, it plays songs randomly.

---

## Files in this folder

```
mias-mdx-bot/
├── index.js            ← Main bot + web server (this is what Render runs)
├── generate-session.js ← Run this ONCE locally to get your SESSION_ID
├── package.json        ← Dependencies
├── .gitignore          ← Keeps secrets out of GitHub
└── public/
    └── index.html      ← The music player website visitors see
```

---

## Step 1 — Generate your WhatsApp Session (do this ONCE on your computer)

```bash
npm install
node generate-session.js
```

- Scan the QR code with WhatsApp
- Copy the SESSION_ID that appears in your terminal (also saved in `SESSION_ID.txt`)

> **Using a phone number instead of QR?**
> ```bash
> node generate-session.js +2347012345678
> ```

---

## Step 2 — Push to GitHub

1. Create a new GitHub repository
2. Upload all files from this folder (except `node_modules/`, `auth_info/`, `SESSION_ID.txt`)
3. Push to GitHub

---

## Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) and sign in
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Fill in these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Environment:** Node
5. Under **Environment Variables**, add:
   - `SESSION_ID` = *(paste your SESSION_ID here)*
6. Click **Deploy**

---

## WhatsApp Bot Commands

| User says | Bot does |
|-----------|----------|
| hi / hello / hey | Greets and asks if they want music |
| yes / yeah | Plays a random song with YouTube link |
| next / skip | Plays another random song |
| no / stop | Stops music politely |
| help / menu | Shows all commands |

---

## Website

When someone visits your Render URL, they see a beautiful music player page that:
- Asks "Would you like to listen to music?"
- If YES → shows a random song with animated visualizer bars
- Click the song title → opens YouTube
- NEXT button → picks a random new song
- STOP → goes back to the prompt

---

*MIAS MDX — by 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x*
