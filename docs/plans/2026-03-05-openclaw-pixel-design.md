# Design : OpenClaw Pixel UI

**Date :** 2026-03-05
**Projet :** Fork inspiré de pixel-agents pour gérer les agents Open Claw
**Repo de référence :** https://github.com/pablodelucca/pixel-agents

---

## Objectif

Remplacer le Web Control UI d'Open Claw (trop complexe, pensé pour les geeks) par une interface pixel art simple et visuelle. Chaque agent Open Claw est représenté par un personnage qui se balade dans un bureau top-down. On clique sur un personnage pour interagir avec l'agent.

---

## 1. Déploiement & installation

### Principe

Une seule commande pour tout installer : Open Claw + notre UI. Pensé pour des utilisateurs non-techniques.

```bash
git clone https://github.com/<user>/openclaw-pixel
cd openclaw-pixel
cp .env.example .env
# Editer .env : coller la clé API Anthropic
docker compose up -d
# Ouvrir http://localhost:3333
```

### Docker Compose (3 services)

```
openclaw-gateway   → image officielle ghcr.io/openclaw/openclaw (port 18789 interne)
openclaw-cli       → même image, accès CLI partagé (réseau service)
pixel-ui           → notre image custom (port 3333:80)
```

Le token gateway est auto-lu depuis la config Open Claw. Aucune saisie dans l'app.

### Fichier .env (minimal)

```
ANTHROPIC_API_KEY=sk-ant-...
# Optionnel - URL gateway si non-standard
OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789
```

### Volume partagé

`~/.openclaw/` est monté dans les deux services (gateway + pixel-ui), ce qui donne à l'UI un accès direct aux fichiers agents sans API tierce.

```
~/.openclaw/
  agents/<id>/workspace/
    AGENTS.md
    SOUL.md
    IDENTITY.md
    USER.md
    skills/
    hooks/
  hooks/           ← hooks globaux
  openclaw.json    ← config principale
```

### Sélecteur d'instances

Un fichier `instances.json` permet de définir plusieurs gateways nommés (Mac Mini, VPS...). Un bouton dans la top bar permet de switcher en un clic — la connexion WebSocket se ferme et se rouvre instantanément. Sauvegardé en localStorage.

---

## 2. Architecture technique

### Stack

- **Frontend :** React 19 + Vite + TypeScript + Canvas 2D
- **Backend léger :** Express.js dans le conteneur pixel-ui
- **Rendu pixel art :** Canvas 2D (même approche que pixel-agents)
- **Temps réel :** WebSocket natif vers Open Claw gateway
- **Serving :** nginx

### Architecture interne du conteneur pixel-ui

```
pixel-ui Docker
├── nginx          → sert le build React (port 80)
└── Express API    → /api/*
    ├── /api/ws-proxy      → proxy WebSocket vers gateway Open Claw
    ├── /api/clawhub/*     → wrapping CLI clawhub (search, install)
    ├── /api/files/:agentId/:file  → lecture/écriture AGENTS.md, SOUL.md, etc.
    └── /api/openclaw/cli  → commandes openclaw CLI (agents, hooks, plugins)
```

### Data flow

```
Open Claw Gateway (ws://openclaw-gateway:18789)
        ↓ WebSocket
  openclawClient.ts  ←→  eventParser.ts
        ↓                (traduit events WS → états agents)
  agentStore.ts
  (état global Zustand)
        ↓              ↓
  OfficeState      React UI panels
  (canvas game)    (chat, skills, cron, etc.)
```

`eventParser.ts` remplace directement `transcriptParser.ts` de pixel-agents : au lieu de lire des fichiers JSONL, il consomme les events WebSocket Open Claw (`message:sent`, `message:received`, tool calls...).

---

## 3. Monde pixel art

### Inspiration directe

Basé sur pixel-agents (même architecture canvas/React) + tileset **MetroCity Free Top-Down Character Pack** (https://jik-a-4.itch.io/metrocity-free-topdown-character-pack).

### Layout du bureau top-down

- **Salle principale :** bureaux avec ordinateurs (agents en train de travailler)
- **Salle de pause :** machine à café, distributeur (agents idle)
- **Salle de réunion :** table de conférence (agents en conversation active)

### États visuels des agents

| État Open Claw | Visuel personnage |
|---|---|
| Actif / tool en cours | Assis au bureau, devant l'ordi, animation de frappe |
| Idle / en attente | Se balade dans la salle de pause ou le couloir |
| Attente approbation | Debout, bulle `?` au-dessus de la tête |
| Erreur | Personnage teinté rouge, icône ⚠️ |
| Cron actif | Assis au bureau + petite horloge animée au-dessus |

### Game loop (même pattern que pixel-agents)

- `OfficeState` class hors du cycle React (game loop impérative, pas de re-renders)
- `OfficeCanvas` composant React wrapping le canvas
- BFS pathfinding pour les déplacements
- State machine par personnage (idle → walking → seated → waiting)

---

## 4. Panneau agent (clic sur un personnage)

Panneau latéral avec 8 onglets :

| Onglet | Contenu |
|---|---|
| Live | Flux d'événements temps réel (outil actif, fichier lu, commande exécutée) |
| Chat | Interface de conversation avec l'agent |
| Skills | Skills actifs + navigateur ClawHub (install en 1 clic) |
| Tools | Toggles visuels par tool et par groupe (exec, web, browser, message...) |
| Modele | Dropdown provider/modèle (`anthropic/claude-opus-4-6`, `openai/gpt-4o`, `ollama/llama3`...) |
| Fichiers | Editeur simple pour AGENTS.md, SOUL.md, IDENTITY.md, USER.md |
| Cron | Tâches planifiées : prochaine exécution, toggle actif/inactif |
| Hooks | Hooks actifs dans le workspace de cet agent, toggle par hook |

### ClawHub intégration (onglet Skills)

- Liste des skills installés localement
- Bouton "Parcourir ClawHub" → grille de cards depuis le registre public
- Clic sur un skill → `clawhub install <slug>` exécuté via l'API Express → skill disponible immédiatement dans le workspace de l'agent

---

## 5. Panneau Gateway (bouton ⚙️ dans la top bar)

Panneau global pour tout ce qui est au niveau gateway (pas par agent) :

### Plugins
Mini App Store : liste des plugins installés, toggle on/off, champ "installer depuis npm". Chaque plugin affiche ses capabilities (tools enregistrés, services en background...).

### Hooks globaux
Tableau de tous les hooks découverts (`~/.openclaw/hooks/`), événement écouté, statut, toggle.

### Routing multi-agent
Vue visuelle des bindings canal → agent :
```
[WhatsApp - perso]  ──→  [Agent: chat]
[WhatsApp - biz]    ──→  [Agent: work]
[Telegram]          ──→  [Agent: bot]
```
Drag & drop pour changer un routing. Bouton "Ajouter binding".

### Canaux
Statut de connexion de chaque canal (connecté/déconnecté), bouton probe.

---

## 6. Top bar

```
[Logo pixel] [Nom gateway actif ▼] | Agents: 3 actifs | [⚙️ Gateway] [🔄 Instances]
```

- **Sélecteur d'instances :** switcher entre Mac Mini / VPS en un clic
- **Statut connexion :** indicateur visuel (vert = connecté, rouge = déconnecté, orange = reconnexion)
- **Compteur agents actifs**

---

## 7. Ce qui est exclu (YAGNI)

- Pas d'authentification utilisateur dans l'UI (la sécurité est gérée par le token gateway dans .env)
- Pas d'éditeur de layout (les bureaux sont fixes, pas de mode édition comme pixel-agents)
- Pas de notifications sonores (phase 1)
- Pas d'app mobile

---

## 8. Structure du repo

```
openclaw-pixel/
├── docker-compose.yml
├── .env.example
├── instances.json.example
├── config/
│   └── openclaw.json.example
├── packages/
│   ├── frontend/          ← React 19 + Vite + Canvas
│   │   ├── src/
│   │   │   ├── canvas/    ← OfficeState, OfficeCanvas, pathfinding
│   │   │   ├── components/← panneau agent, panneau gateway, top bar
│   │   │   ├── store/     ← agentStore (Zustand)
│   │   │   ├── openclaw/  ← openclawClient, eventParser
│   │   │   └── api/       ← appels Express backend
│   │   └── public/assets/ ← tilesets MetroCity, sprites
│   └── backend/           ← Express API
│       └── src/
│           ├── ws-proxy.ts
│           ├── clawhub.ts
│           ├── files.ts
│           └── cli.ts
└── docs/
    └── plans/
        └── 2026-03-05-openclaw-pixel-design.md
```
