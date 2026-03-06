# OpenClaw Pixel UI

Une interface visuelle **pixel art** pour gérer tes agents [Open Claw](https://docs.openclaw.ai) — style Habbo/Sims, sans toucher à une ligne de commande.

Chaque agent est représenté par un personnage qui se balade dans un bureau top-down entièrement personnalisable. Clique sur un bureau pour ouvrir l'**écran PC de l'agent** (style Windows XP). Gagne des **coins** quand tes agents travaillent et dépense-les dans la **boutique** pour décorer ton espace.

![Bureau pixel art avec agents](docs/preview.png)

---

## Pourquoi ce projet ?

L'interface officielle d'Open Claw (Web Control UI) est puissante mais pensée pour les développeurs. Ce projet propose une alternative visuelle, fun et gamifiée :

- **Voir en un coup d'oeil** quels agents travaillent, lesquels sont en pause, lesquels attendent une approbation
- **Parler à un agent** directement depuis l'UI, sans passer par le terminal
- **Gérer ses skills** via le marketplace [ClawHub](https://clawhub.ai) en un clic
- **Configurer** les tools, le modèle IA, les fichiers de personnalité (AGENTS.md, SOUL.md...), les cron jobs et les hooks
- **Switcher entre plusieurs instances** (Mac Mini local, VPS...) depuis la barre du haut
- **Personnaliser ton espace** comme dans Habbo — sols, murs, meubles, déco
- **Tout deployer en une commande** — Open Claw + l'UI, sans configuration complexe

---

## Gamification — Habbo/Sims style

### Coins

Tes agents gagnent des **coins** pour toi automatiquement : chaque token consommé en travaillant = 1 coin crédité. Tu démarres avec 500 coins offerts.

### Boutique (SHOP)

Clique sur **SHOP** dans la barre du haut pour acheter des items :
- Bureaux, chaises, plantes, PC, imprimantes, fontaines, armoires...
- 15+ items disponibles dans 5 catégories
- Les items achetés rejoignent ton inventaire

### Mode Edit + Inventaire

Active le bouton **EDIT** pour entrer en mode décoration :
- Une barre s'ouvre en bas avec tous tes items achetés
- Clique sur un item puis sur la carte pour le placer
- Clique droit sur un meuble pour le déplacer ou le supprimer
- **Color picker** pour changer la couleur des sols et des murs (16 couleurs pixel art)

### Écran PC (style Windows XP)

Clique sur un bureau pour ouvrir l'écran complet de l'agent :

| Onglet | Description |
|--------|-------------|
| **Tâches** | Historique en cours / terminées de l'agent |
| **Fichiers** | Documents générés par l'agent, avec viewer intégré |
| **Stats** | Statut, modèle, coins du workspace, activité |
| **Chat** | Parler directement à l'agent |

Tu peux renommer le poste, changer l'agent assigné, et voir son statut en temps réel.

---

## Ce que tu peux faire par agent (panneau latéral)

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
- **Base de données** : SQLite + Prisma (coins, inventaire, transactions)
- **Pixel art** : tileset [MetroCity Free Top-Down](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack)
- **Déploiement** : Docker Compose (nginx + Node.js dans un seul conteneur)

---

## Installation

**Prérequis :** [Docker Desktop](https://docker.com/get-started) — installe-le et lance-le.

```bash
git clone https://github.com/ohvignas/openclaw-pixel
cd openclaw-pixel
node setup.js
```

Le script te pose des questions (provider AI, clé API, canaux...), configure tout automatiquement et lance Docker. C'est tout.

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
| `DATABASE_URL` | Chemin SQLite (Prisma) | `file:./prisma/data/openclaw.db` |
| `OPENCLAW_WORKSPACE_DIR` | Dossier workspace agents (pour FilesTab) | `$HOME` |

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

Pour contribuer au code de l'UI (sans avoir besoin d'Open Claw qui tourne) :

```bash
npm install
npm run dev
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:3000

> Le bureau s'affichera vide (pas d'agents) — c'est normal, il n'y a pas de gateway Open Claw en dev local. Pour tester avec de vrais agents, utilise `docker compose up -d`.

---

## Licence

MIT
