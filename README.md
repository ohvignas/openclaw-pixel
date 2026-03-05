# OpenClaw Pixel UI

Une interface visuelle **pixel art** pour gérer tes agents [Open Claw](https://docs.openclaw.ai) — sans toucher à une ligne de commande.

Chaque agent est représenté par un personnage qui se balade dans un bureau top-down. Tu cliques sur un personnage pour interagir avec lui.

![Bureau pixel art avec agents](docs/preview.png)

---

## Pourquoi ce projet ?

L'interface officielle d'Open Claw (Web Control UI) est puissante mais pensée pour les développeurs. Ce projet propose une alternative visuelle, simple et fun :

- **Voir en un coup d'oeil** quels agents travaillent, lesquels sont en pause, lesquels attendent une approbation
- **Parler à un agent** directement depuis l'UI, sans passer par le terminal
- **Gérer ses skills** via le marketplace [ClawHub](https://clawhub.ai) en un clic
- **Configurer** les tools, le modèle IA, les fichiers de personnalité (AGENTS.md, SOUL.md...), les cron jobs et les hooks
- **Switcher entre plusieurs instances** (Mac Mini local, VPS...) depuis la barre du haut
- **Tout deployer en une commande** — Open Claw + l'UI, sans configuration complexe

---

## Ce que tu peux faire par agent

En cliquant sur un personnage, un panneau s'ouvre avec 8 onglets :

| Onglet | Description |
|--------|-------------|
| **Live** | Flux en temps réel — outil actif, fichiers lus, commandes en cours |
| **Chat** | Envoyer un message directement à l'agent |
| **Skills** | Skills installés + navigateur ClawHub pour en ajouter en 1 clic |
| **Tools** | Activer/désactiver les tools par groupe (web, filesystem, exec...) |
| **Modèle** | Choisir le provider et le modèle (Claude, GPT-4o, Mistral, Llama...) |
| **Fichiers** | Editer AGENTS.md, SOUL.md, IDENTITY.md, USER.md directement |
| **Cron** | Voir les tâches planifiées et leur prochaine exécution |
| **Hooks** | Activer/désactiver les hooks du workspace de l'agent |

Un panneau **Gateway** (bouton ⚙ en haut) gère le niveau global : plugins installés, hooks globaux, routing canal → agent, et statut des canaux.

---

## Stack technique

- **Frontend** : React 19 + Vite + TypeScript + Canvas 2D + Zustand + Tailwind CSS
- **Backend** : Express.js (proxy WebSocket + API fichiers + wrappers CLI)
- **Pixel art** : tileset [MetroCity Free Top-Down](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack)
- **Déploiement** : Docker Compose (nginx + Node.js dans un seul conteneur)

---

## Installation (2 minutes)

**Prérequis :** [Docker Desktop](https://docker.com/get-started)

```bash
git clone https://github.com/ohvignas/openclaw-pixel
cd openclaw-pixel
cp .env.example .env
```

Ouvre `.env` et colle ta clé API Anthropic :

```
ANTHROPIC_API_KEY=sk-ant-...
```

Lance tout :

```bash
docker compose up -d
```

Ouvre **http://localhost:3333**

---

## Ajouter une instance (VPS, second serveur)

Clique sur **+** dans la barre du haut, renseigne le nom, l'URL WebSocket et le token. Tu peux switcher entre instances en un clic — la connexion se bascule instantanément.

---

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (obligatoire) | — |
| `PORT` | Port d'accès à l'UI | `3333` |
| `OPENCLAW_GATEWAY_TOKEN` | Token d'authentification gateway | — |
| `OPENCLAW_GATEWAY_URL` | URL du gateway si non-standard | `ws://openclaw-gateway:18789` |

---

## Architecture

```
docker compose up
├── openclaw-gateway   → image officielle Open Claw (port 18789 interne)
├── openclaw-cli       → même image, accès CLI partagé
└── pixel-ui           → notre image (nginx + Express)
    ├── nginx :80      → sert le build React + proxy /api et /ws
    └── node :3000     → API REST + proxy WebSocket vers le gateway
```

Le volume `~/.openclaw/` est partagé entre le gateway et le pixel-ui, ce qui donne à l'UI un accès direct aux fichiers agents.

---

## Développement local

```bash
npm install
npm run dev
```

Frontend sur `http://localhost:5173`, backend sur `http://localhost:3000`.

---

## Licence

MIT
