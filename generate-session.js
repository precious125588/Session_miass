/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         MIAS MDX — Session Generator (Run Once)             ║
 * ║         Owner: 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x                               ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * HOW TO USE:
 *   1. npm install
 *   2. node generate-session.js
 *      OR with phone number (to get a pairing code instead of QR):
 *      node generate-session.js +2347012345678
 *   3. Scan the QR code with WhatsApp (or enter the pairing code)
 *   4. Copy the SESSION_ID that appears
 *   5. On Render, add environment variable: SESSION_ID=<paste here>
 */

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeterminal from "qrcode-terminal";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { createServer } from "http";
import { fileURLToPath } from "url";
import pino from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "auth_info_temp");
const SESSION_FILE = path.join(__dirname, "SESSION_ID.txt");
const PAIRING_NUMBER = process.argv[2] || null;
const logger = pino({ level: "silent" });

const BANNER = `
╔══════════════════════════════════════════════╗
║       MIAS MDX — Session Generator          ║
║       Owner: 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x                 ║
╚══════════════════════════════════════════════╝
`;

console.log(BANNER);

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let currentQR = null;

const httpServer = createServer(async (req, res) => {
  if (req.url === "/qr" && currentQR) {
    const qrImageBuffer = await QRCode.toBuffer(currentQR, {
      width: 400,
      margin: 3,
    }).catch(() => null);

    if (qrImageBuffer) {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(qrImageBuffer);
      return;
    }
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>MIAS MDX — Session Generator</title>
        <meta http-equiv="refresh" content="3">
        <style>
          body { background: #0a0f0a; color: #25D366; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          h1 { font-size: 2rem; margin-bottom: 0.5rem; }
          p { color: #888; margin-bottom: 2rem; }
          img { border: 3px solid #25D366; border-radius: 12px; }
          .waiting { color: #25D366; font-size: 1.2rem; animation: pulse 1.5s ease-in-out infinite; }
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        </style>
      </head>
      <body>
        <h1>MIAS MDX</h1>
        <p>Owner: 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x</p>
        ${currentQR
          ? `<img src="/qr" alt="QR Code" width="350" height="350" /><p style="margin-top:1.5rem">Scan with WhatsApp → Linked Devices → Link a Device</p>`
          : `<div class="waiting">⏳ Waiting for QR code...</div>`
        }
      </body>
    </html>
  `);
});

httpServer.listen(3000, () => {
  console.log("📱  Open http://localhost:3000 to scan the QR via browser");
  console.log("    (Auto-refreshes every 3 seconds)\n");
});

async function buildSessionID() {
  const files = {};
  const entries = fs.readdirSync(AUTH_DIR);
  for (const file of entries) {
    const fullPath = path.join(AUTH_DIR, file);
    if (fs.statSync(fullPath).isFile()) {
      files[file] = fs.readFileSync(fullPath, "utf8");
    }
  }
  return Buffer.from(JSON.stringify(files)).toString("base64");
}

async function startSession() {
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

  if (PAIRING_NUMBER && !state.creds.registered) {
    console.log(`📲  Requesting pairing code for ${PAIRING_NUMBER}...`);
    await new Promise((r) => setTimeout(r, 3000));
    const code = await sock.requestPairingCode(PAIRING_NUMBER.replace(/\D/g, ""));
    console.log(`\n🔑  Your pairing code: \x1b[1;32m${code}\x1b[0m`);
    console.log("    Enter this in WhatsApp → Linked Devices → Link with phone number\n");
  }

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = qr;
      console.clear();
      console.log(BANNER);
      console.log("📷  Scan this QR code (or open http://localhost:3000):\n");
      qrcodeterminal.generate(qr, { small: true });
    }

    if (connection === "open") {
      currentQR = null;
      console.log("\n✅  Connected! Generating SESSION_ID...\n");

      await saveCreds();
      await new Promise((r) => setTimeout(r, 1000));

      const sessionID = await buildSessionID();

      console.log("═".repeat(60));
      console.log("\x1b[1;32m📋  YOUR SESSION_ID (copy this):\x1b[0m");
      console.log("═".repeat(60));
      console.log(`\n${sessionID}\n`);
      console.log("═".repeat(60));
      console.log("\n📝  Also saved to: SESSION_ID.txt");
      console.log("\n⚙️   NEXT STEPS:");
      console.log("    1. Copy the SESSION_ID above");
      console.log("    2. On Render → Environment → Add variable:");
      console.log("       SESSION_ID = <paste here>");
      console.log("    3. Deploy your bot!");
      console.log("\n    Owner: 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x\n");

      fs.writeFileSync(SESSION_FILE, sessionID, "utf8");

      setTimeout(() => {
        httpServer.close();
        process.exit(0);
      }, 2000);
    }

    if (connection === "close") {
      const code = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output.statusCode
        : 0;

      if (code === DisconnectReason.loggedOut) {
        console.log("❌  Logged out. Delete auth_info_temp folder and try again.");
        process.exit(1);
      } else {
        console.log("🔄  Reconnecting...");
        setTimeout(startSession, 3000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startSession().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
