/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              MIAS MDX — WhatsApp Bot + Music Site           ║
 * ║              Owner: 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x                           ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * DEPLOY ON RENDER:
 *   1. Push this folder to GitHub
 *   2. Create a new Web Service on Render
 *   3. Set Build Command: npm install
 *   4. Set Start Command: node index.js
 *   5. Add environment variable: SESSION_ID=<your session id>
 *   6. Done!
 */

import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "auth_info");
const PORT = process.env.PORT || 3000;
const SESSION_ID = process.env.SESSION_ID || null;

const logger = pino({ level: "silent" });
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ─── Serve the music player website ─────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Health check for Render ─────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", owner: "PRECIOUS x", bot: "MIAS MDX" });
});

// ─── Restore session from SESSION_ID env var ─────────────────────────────────
function restoreSession() {
  if (!SESSION_ID) {
    console.log("⚠️  No SESSION_ID found. Run generate-session.js first.");
    return false;
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  try {
    const decoded = Buffer.from(SESSION_ID, "base64").toString("utf8");
    const files = JSON.parse(decoded);

    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(AUTH_DIR, filename);
      fs.writeFileSync(filePath, content, "utf8");
    }

    console.log("✅  Session restored from SESSION_ID");
    return true;
  } catch (err) {
    console.error("❌  Failed to restore session:", err.message);
    return false;
  }
}

// ─── WhatsApp Bot ─────────────────────────────────────────────────────────────
async function startBot() {
  const sessionOk = restoreSession();
  if (!sessionOk) {
    console.log("🤖  Bot running in website-only mode (no WhatsApp session).");
    return;
  }

  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ["MIAS MDX", "Chrome", "1.0.0"],
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("🟢  WhatsApp connected — MIAS MDX is live!");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output.statusCode
        : 0;

      if (code === DisconnectReason.loggedOut) {
        console.log("❌  Logged out. Please regenerate your SESSION_ID.");
      } else {
        console.log("🔄  Reconnecting in 5 seconds...");
        setTimeout(startBot, 5000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ""
      ).trim().toLowerCase();

      const sender = msg.pushName || jid.split("@")[0];

      // ─── Welcome / music prompt ───────────────────────────────────────────
      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey" ||
        text === "start" ||
        text === "hola"
      ) {
        await sock.sendMessage(jid, {
          text:
            `👋 Hey ${sender}! Welcome to *MIAS MDX* 🎵\n\n` +
            `I'm your personal music bot powered by *𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x* ✨\n\n` +
            `🎧 Would you like to listen to some music?\n` +
            `Reply *YES* to start playing random songs\n` +
            `Reply *NO* if you're busy right now`,
        });
        continue;
      }

      // ─── Play music ───────────────────────────────────────────────────────
      if (text === "yes" || text === "yeah" || text === "yep" || text === "yh") {
        const songs = getMusicList();
        const randomSong = songs[Math.floor(Math.random() * songs.length)];

        await sock.sendMessage(jid, {
          text:
            `🎵 *Now Playing Randomly*\n\n` +
            `🎶 ${randomSong.title}\n` +
            `👤 Artist: ${randomSong.artist}\n` +
            `🎼 Genre: ${randomSong.genre}\n\n` +
            `🔗 ${randomSong.url}\n\n` +
            `Reply *NEXT* for another song\n` +
            `Reply *STOP* to stop the music`,
        });
        continue;
      }

      // ─── Next song ────────────────────────────────────────────────────────
      if (text === "next" || text === "skip" || text === "more") {
        const songs = getMusicList();
        const randomSong = songs[Math.floor(Math.random() * songs.length)];

        await sock.sendMessage(jid, {
          text:
            `⏭️ *Skipping to next track...*\n\n` +
            `🎶 ${randomSong.title}\n` +
            `👤 Artist: ${randomSong.artist}\n` +
            `🎼 Genre: ${randomSong.genre}\n\n` +
            `🔗 ${randomSong.url}\n\n` +
            `Reply *NEXT* for another song\n` +
            `Reply *STOP* to stop the music`,
        });
        continue;
      }

      // ─── Stop music ───────────────────────────────────────────────────────
      if (text === "no" || text === "stop" || text === "nope" || text === "nah") {
        await sock.sendMessage(jid, {
          text:
            `⏹️ Okay, no worries! Music paused.\n\n` +
            `Come back anytime and say *HI* to start again 🎵\n\n` +
            `— *MIAS MDX* by 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x`,
        });
        continue;
      }

      // ─── Help menu ────────────────────────────────────────────────────────
      if (text === "help" || text === "menu" || text === "commands") {
        await sock.sendMessage(jid, {
          text:
            `📋 *MIAS MDX Commands*\n\n` +
            `👋 *HI / HELLO* — Start a conversation\n` +
            `✅ *YES* — Play a random song\n` +
            `⏭️ *NEXT* — Skip to next song\n` +
            `⏹️ *STOP / NO* — Stop music\n` +
            `📋 *HELP* — Show this menu\n\n` +
            `_Powered by 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x_`,
        });
        continue;
      }
    }
  });
}

// ─── Music Library ────────────────────────────────────────────────────────────
function getMusicList() {
  return [
    {
      title: "Blinding Lights",
      artist: "The Weeknd",
      genre: "Pop / Synth-pop",
      url: "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
    },
    {
      title: "Essence",
      artist: "Wizkid ft. Tems",
      genre: "Afrobeats",
      url: "https://www.youtube.com/watch?v=vDF-U3ZOAxY",
    },
    {
      title: "Cruel Summer",
      artist: "Taylor Swift",
      genre: "Pop",
      url: "https://www.youtube.com/watch?v=ic8j13piAhQ",
    },
    {
      title: "Ye",
      artist: "Burna Boy",
      genre: "Afrobeats",
      url: "https://www.youtube.com/watch?v=1Cr0kqFhP0U",
    },
    {
      title: "As It Was",
      artist: "Harry Styles",
      genre: "Pop",
      url: "https://www.youtube.com/watch?v=H5v3kku4y6Q",
    },
    {
      title: "Love Nwantiti",
      artist: "CKay",
      genre: "Afropop",
      url: "https://www.youtube.com/watch?v=PFRjKjEf0s0",
    },
    {
      title: "Creepin'",
      artist: "Metro Boomin ft. The Weeknd",
      genre: "R&B / Hip-Hop",
      url: "https://www.youtube.com/watch?v=cNtXSGVqAYo",
    },
    {
      title: "Calm Down",
      artist: "Rema ft. Selena Gomez",
      genre: "Afrobeats",
      url: "https://www.youtube.com/watch?v=Y3S2MflEMiM",
    },
    {
      title: "Flowers",
      artist: "Miley Cyrus",
      genre: "Pop",
      url: "https://www.youtube.com/watch?v=G7KNmW9a75Y",
    },
    {
      title: "Ojuelegba",
      artist: "Wizkid",
      genre: "Afrobeats",
      url: "https://www.youtube.com/watch?v=G_ZhFPgNT0I",
    },
    {
      title: "Vampire",
      artist: "Olivia Rodrigo",
      genre: "Pop / Alt-Rock",
      url: "https://www.youtube.com/watch?v=RlPNh_PBZb4",
    },
    {
      title: "Kwaku the Traveller",
      artist: "Black Sherif",
      genre: "Afrobeats / Hip-Hop",
      url: "https://www.youtube.com/watch?v=OvlHb2OeWcU",
    },
    {
      title: "Rush",
      artist: "Ayra Starr",
      genre: "Afropop",
      url: "https://www.youtube.com/watch?v=LZ2FkIxnPIU",
    },
    {
      title: "Houdini",
      artist: "Eminem",
      genre: "Hip-Hop",
      url: "https://www.youtube.com/watch?v=GFEGa-seZOU",
    },
    {
      title: "Unavailable",
      artist: "Davido ft. Musa Keys",
      genre: "Afrobeats",
      url: "https://www.youtube.com/watch?v=OTZ8x4WIj1A",
    },
  ];
}

// ─── Start everything ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║     MIAS MDX — Bot + Music Site      ║`);
  console.log(`║     Owner: 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x            ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`🌐  Website running on port ${PORT}`);
});

startBot().catch((err) => {
  console.error("Fatal error starting bot:", err);
});
