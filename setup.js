#!/usr/bin/env node
// setup.js — OpenClaw Pixel UI interactive setup wizard

const readline = require("readline");
const fs = require("fs");
const os = require("os");
const { execSync, spawn } = require("child_process");
const path = require("path");

// ─── ANSI colors ────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgBlack: "\x1b[40m",
};

const bold = (s) => `${c.bold}${s}${c.reset}`;
const dim = (s) => `${c.dim}${s}${c.reset}`;
const green = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const cyan = (s) => `${c.cyan}${s}${c.reset}`;
const red = (s) => `${c.red}${s}${c.reset}`;
const gray = (s) => `${c.gray}${s}${c.reset}`;

// ─── Banner ──────────────────────────────────────────────────────────────────
function banner() {
  console.clear();
  console.log();
  console.log(cyan(bold("  ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗")));
  console.log(cyan(bold("  ██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║")));
  console.log(cyan(bold("  ██║  ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║")));
  console.log(cyan(bold("  ██║  ██║██╔══██╗██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║")));
  console.log(cyan(bold("  ██████╔╝██║  ██║███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝")));
  console.log(cyan(bold("  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ")));
  console.log();
  console.log(bold("  OpenClaw Pixel UI") + gray("  —  Setup wizard"));
  console.log(gray("  Interface pixel art pour gérer tes agents Open Claw"));
  console.log();
  console.log(gray("  " + "─".repeat(68)));
  console.log();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ask(rl, question, defaultValue = "") {
  return new Promise((resolve) => {
    const hint = defaultValue ? gray(` (défaut : ${defaultValue})`) : "";
    rl.question(`  ${cyan("?")} ${bold(question)}${hint}\n  ${gray("›")} `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askSecret(rl, question) {
  return new Promise((resolve) => {
    process.stdout.write(`  ${cyan("?")} ${bold(question)}\n  ${gray("›")} `);
    // Hide input on most terminals
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let input = "";
    const handler = (char) => {
      char = char.toString();
      if (char === "\r" || char === "\n") {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "\u0003") {
        process.exit();
      } else if (char === "\u007f") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(4);
          process.stdout.write("*".repeat(input.length));
        }
      } else {
        input += char;
        process.stdout.write("*");
      }
    };
    if (process.stdin.isTTY) {
      process.stdin.on("data", handler);
    } else {
      rl.question("", resolve);
    }
  });
}

function askChoice(rl, question, choices) {
  return new Promise((resolve) => {
    console.log(`  ${cyan("?")} ${bold(question)}`);
    choices.forEach((c, i) => {
      console.log(`  ${gray(`${i + 1}.`)} ${c.label}${c.hint ? gray("  " + c.hint) : ""}`);
    });
    console.log();
    rl.question(`  ${gray("›")} Ton choix (1-${choices.length}) : `, (answer) => {
      const idx = parseInt(answer.trim()) - 1;
      if (idx >= 0 && idx < choices.length) {
        resolve(choices[idx]);
      } else {
        console.log(yellow(`  Choix invalide, on prend ${choices[0].label} par défaut.`));
        resolve(choices[0]);
      }
    });
  });
}

function askMultiChoice(rl, question, choices) {
  return new Promise((resolve) => {
    console.log(`  ${cyan("?")} ${bold(question)}`);
    console.log(gray("  Plusieurs choix possibles, séparés par des virgules. Ex: 1,3"));
    console.log();
    choices.forEach((c, i) => {
      console.log(`  ${gray(`${i + 1}.`)} ${c.label}${c.hint ? gray("  — " + c.hint) : ""}`);
    });
    console.log(`  ${gray(`${choices.length + 1}.`)} ${gray("Aucun pour l'instant")}`);
    console.log();
    rl.question(`  ${gray("›")} Tes choix : `, (answer) => {
      if (!answer.trim() || answer.trim() === String(choices.length + 1)) {
        resolve([]);
        return;
      }
      const selected = answer.split(",")
        .map((s) => parseInt(s.trim()) - 1)
        .filter((i) => i >= 0 && i < choices.length)
        .map((i) => choices[i]);
      resolve(selected);
    });
  });
}

function log(msg) { console.log(`  ${msg}`); }
function success(msg) { console.log(`  ${green("✓")} ${msg}`); }
function info(msg) { console.log(`  ${cyan("→")} ${msg}`); }
function warn(msg) { console.log(`  ${yellow("!")} ${msg}`); }
function sep() { console.log(); console.log(gray("  " + "─".repeat(68))); console.log(); }

// ─── Spinner ─────────────────────────────────────────────────────────────────
function spinner(label) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${cyan(frames[i % frames.length])} ${label}`);
    i++;
  }, 80);
  return {
    stop: (msg) => {
      clearInterval(interval);
      process.stdout.write(`\r  ${green("✓")} ${msg}\n`);
    },
    fail: (msg) => {
      clearInterval(interval);
      process.stdout.write(`\r  ${red("✗")} ${msg}\n`);
    },
  };
}

// ─── Check Docker ─────────────────────────────────────────────────────────────
function checkDocker() {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  banner();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── 1. Check Docker ──────────────────────────────────────────────────────
  const spin1 = spinner("Vérification de Docker...");
  await new Promise((r) => setTimeout(r, 600));
  if (!checkDocker()) {
    spin1.fail("Docker n'est pas lancé");
    console.log();
    warn("Lance Docker Desktop et relance ce script.");
    warn("Télécharge Docker ici : https://docker.com/get-started");
    rl.close();
    process.exit(1);
  }
  spin1.stop("Docker est disponible");
  console.log();

  // ── 2. Provider AI ───────────────────────────────────────────────────────
  log(bold("Etape 1/3 — Provider AI"));
  console.log();

  const provider = await askChoice(rl, "Quel provider AI veux-tu utiliser ?", [
    { label: "Anthropic (Claude)", value: "anthropic", hint: "Recommandé — claude-opus-4-6, claude-sonnet-4-6..." },
    { label: "OpenAI (GPT)", value: "openai", hint: "gpt-4o, gpt-4o-mini..." },
    { label: "Mistral", value: "mistral", hint: "mistral-large, mistral-small..." },
    { label: "Ollama (local)", value: "ollama", hint: "llama3, mistral, gemma... — tourne sur ta machine" },
  ]);
  console.log();

  let apiKey = "";
  if (provider.value !== "ollama") {
    const keyLabel = {
      anthropic: "Clé API Anthropic (https://console.anthropic.com)",
      openai: "Clé API OpenAI (https://platform.openai.com/api-keys)",
      mistral: "Clé API Mistral (https://console.mistral.ai)",
    }[provider.value];

    apiKey = await askSecret(rl, keyLabel);
    if (!apiKey || apiKey.length < 10) {
      warn("Clé vide ou trop courte. Tu pourras la renseigner manuellement dans le fichier .env");
    }
    console.log();
  } else {
    info("Ollama — assure-toi qu'Ollama tourne sur ta machine (http://localhost:11434)");
    console.log();
  }

  // ── 3. Port ──────────────────────────────────────────────────────────────
  log(bold("Etape 2/3 — Configuration"));
  console.log();

  const port = await ask(rl, "Port pour accéder à l'UI dans ton navigateur", "3333");
  const gatewayToken = await ask(rl, "Token gateway Open Claw (laisse vide si aucun)", "");
  console.log();

  // ── 4. Channels ───────────────────────────────────────────────────────────
  log(bold("Etape 3/3 — Canaux de messagerie (optionnel)"));
  log(gray("Tu pourras toujours les configurer plus tard depuis l'UI."));
  console.log();

  const channels = await askMultiChoice(rl, "Quels canaux veux-tu connecter ?", [
    { label: "WhatsApp",  value: "whatsapp",  hint: "via Twilio ou l'API Meta" },
    { label: "Telegram",  value: "telegram",  hint: "via BotFather — @BotFather sur Telegram" },
    { label: "Slack",     value: "slack",     hint: "via Slack App" },
    { label: "Discord",   value: "discord",   hint: "via Discord Bot" },
  ]);

  const channelEnv = {};

  for (const ch of channels) {
    sep();
    log(bold(`Canal : ${ch.label}`));
    console.log();

    if (ch.value === "whatsapp") {
      log(gray("Docs : https://docs.openclaw.ai/channels/whatsapp"));
      console.log();
      channelEnv.WHATSAPP_PHONE_NUMBER_ID = await ask(rl, "Phone Number ID Meta");
      channelEnv.WHATSAPP_ACCESS_TOKEN = await askSecret(rl, "Access Token Meta");
      console.log();
    }

    if (ch.value === "telegram") {
      log(gray("Docs : https://docs.openclaw.ai/channels/telegram"));
      log(gray("Crée un bot sur Telegram : ouvre @BotFather → /newbot → copie le token"));
      console.log();
      channelEnv.TELEGRAM_BOT_TOKEN = await askSecret(rl, "Token Telegram Bot");
      console.log();
    }

    if (ch.value === "slack") {
      log(gray("Docs : https://docs.openclaw.ai/channels/slack"));
      console.log();
      channelEnv.SLACK_BOT_TOKEN = await askSecret(rl, "Bot Token Slack (xoxb-...)");
      channelEnv.SLACK_SIGNING_SECRET = await askSecret(rl, "Signing Secret Slack");
      console.log();
    }

    if (ch.value === "discord") {
      log(gray("Docs : https://docs.openclaw.ai/channels/discord"));
      console.log();
      channelEnv.DISCORD_BOT_TOKEN = await askSecret(rl, "Token Bot Discord");
      console.log();
    }
  }

  rl.close();
  sep();

  // ── 5. Ecrire le .env ─────────────────────────────────────────────────────
  const spinEnv = spinner("Génération du fichier .env...");
  await new Promise((r) => setTimeout(r, 400));

  const envLines = [
    "# Généré par setup.js — OpenClaw Pixel UI",
    "",
    "# Provider AI",
  ];

  if (provider.value === "anthropic") {
    envLines.push(`ANTHROPIC_API_KEY=${apiKey}`);
  } else if (provider.value === "openai") {
    envLines.push(`OPENAI_API_KEY=${apiKey}`);
  } else if (provider.value === "mistral") {
    envLines.push(`MISTRAL_API_KEY=${apiKey}`);
  } else {
    envLines.push("# Ollama — pas de clé nécessaire");
  }

  envLines.push("");
  envLines.push("# Gateway Open Claw");
  envLines.push("OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789");
  envLines.push(`OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`);

  envLines.push("");
  envLines.push("# UI");
  envLines.push(`PORT=${port}`);

  if (Object.keys(channelEnv).length > 0) {
    envLines.push("");
    envLines.push("# Canaux");
    for (const [k, v] of Object.entries(channelEnv)) {
      envLines.push(`${k}=${v}`);
    }
  }

  fs.writeFileSync(path.join(__dirname, ".env"), envLines.join("\n") + "\n");
  spinEnv.stop(".env créé");

  // ── 6. Ecrire ~/.openclaw/openclaw.json ───────────────────────────────────
  const spinConfig = spinner("Configuration Open Claw (~/.openclaw/openclaw.json)...");
  await new Promise((r) => setTimeout(r, 300));

  const openclawDir = path.join(os.homedir(), ".openclaw");
  const openclawConfigPath = path.join(openclawDir, "openclaw.json");

  if (!fs.existsSync(openclawDir)) {
    fs.mkdirSync(openclawDir, { recursive: true });
  }

  let existingConfig = {};
  if (fs.existsSync(openclawConfigPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(openclawConfigPath, "utf8"));
    } catch {
      // Config corrompue ou JSON5 avec commentaires — on part de zéro
    }
  }

  const config = JSON.parse(JSON.stringify(existingConfig)); // deep copy

  // Provider
  if (provider.value !== "ollama" && apiKey && apiKey.length >= 10) {
    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};
    config.models.providers[provider.value] = {
      ...(config.models.providers[provider.value] || {}),
      apiKey,
    };
  }

  // Modèle par défaut
  const defaultModels = {
    anthropic: "anthropic/claude-sonnet-4-6",
    openai: "openai/gpt-4o",
    mistral: "mistral/mistral-large-latest",
    ollama: "ollama/llama3",
  };
  if (!config.agents) config.agents = {};
  if (!config.agents.defaults) config.agents.defaults = {};
  if (!config.agents.defaults.model) config.agents.defaults.model = {};
  config.agents.defaults.model.primary = defaultModels[provider.value];

  // Canaux
  if (channelEnv.TELEGRAM_BOT_TOKEN) {
    if (!config.channels) config.channels = {};
    config.channels.telegram = {
      ...(config.channels?.telegram || {}),
      botToken: channelEnv.TELEGRAM_BOT_TOKEN,
    };
  }

  if (channelEnv.SLACK_BOT_TOKEN) {
    if (!config.channels) config.channels = {};
    config.channels.slack = {
      ...(config.channels?.slack || {}),
      botToken: channelEnv.SLACK_BOT_TOKEN,
      signingSecret: channelEnv.SLACK_SIGNING_SECRET || "",
    };
  }

  if (channelEnv.DISCORD_BOT_TOKEN) {
    if (!config.channels) config.channels = {};
    config.channels.discord = {
      ...(config.channels?.discord || {}),
      botToken: channelEnv.DISCORD_BOT_TOKEN,
    };
  }

  fs.writeFileSync(openclawConfigPath, JSON.stringify(config, null, 2) + "\n");
  spinConfig.stop(`openclaw.json écrit dans ${openclawConfigPath}`);

  // WhatsApp — nécessite un QR code interactif, ne peut pas être automatisé
  if (channels.some((c) => c.value === "whatsapp")) {
    console.log();
    warn("WhatsApp nécessite un scan de QR code.");
    info("Après le démarrage, lance cette commande pour connecter WhatsApp :");
    info(gray("  docker compose exec openclaw-cli openclaw channels login --channel whatsapp"));
  }

  // ── 7. Docker Compose up ──────────────────────────────────────────────────
  const spinDocker = spinner("Lancement des conteneurs (première fois = téléchargement des images)...");

  await new Promise((resolve, reject) => {
    const proc = spawn("docker", ["compose", "up", "-d", "--build"], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose exited with code ${code}`));
    });
    proc.stderr.on("data", () => {}); // suppress noise
  }).then(() => {
    spinDocker.stop("Conteneurs démarrés");
  }).catch((err) => {
    spinDocker.fail("Erreur lors du lancement Docker");
    console.log();
    warn(err.message);
    warn("Essaie manuellement : docker compose up -d");
  });

  // ── 8. Résumé ──────────────────────────────────────────────────────────────
  console.log();
  console.log(gray("  " + "═".repeat(68)));
  console.log();
  console.log("  " + bold(green("Tout est prêt !")));
  console.log();
  success(`Interface disponible sur ${bold(cyan(`http://localhost:${port}`))} — ouvre dans ton navigateur`);
  if (channels.length > 0) {
    success(`Canaux configurés : ${channels.map((c) => c.label).join(", ")}`);
    info("Pour activer les canaux dans Open Claw, ouvre l'UI → bouton ⚙ → Canaux");
  } else {
    info("Tu peux ajouter des canaux plus tard : bouton ⚙ en haut → Canaux");
  }
  info(`Pour voir les logs : ${gray("docker compose logs -f")}`);
  info(`Pour arrêter : ${gray("docker compose down")}`);
  console.log();
  console.log(gray("  " + "═".repeat(68)));
  console.log();
}

main().catch((err) => {
  console.error(red(`\n  Erreur : ${err.message}\n`));
  process.exit(1);
});
