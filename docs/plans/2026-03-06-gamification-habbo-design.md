# Design : Gamification Habbo/Sims — Open Claw Pixel UI

Date: 2026-03-06
Statut: Validé

## Vision

Transformer l'interface pixel art Open Claw en un monde complet style Habbo/Sims :
- Customisation totale de la salle (sols, murs, meubles)
- Boutique avec monnaie virtuelle (coins)
- Coins gagnés automatiquement quand les agents travaillent (tokens consommés)
- Écran PC complet par poste de travail

## Roadmap

1. **B — Customisation salle** : sols + murs colorables, placement libre de tous les sprites Office
2. **C — Interaction bureau** : clic sur desk → écran PC style Windows XP
3. **A — Boutique + coins** : shop, inventaire, économie tokens → coins

---

## Base de données (SQLite + Prisma)

Fichier SQLite local dans le container backend. Zéro infra supplémentaire.

### Schéma Prisma

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String   @default("Mon OpenClaw")
  coins     Int      @default(500)
  createdAt DateTime @default(now())
  inventory InventoryItem[]
}

model InventoryItem {
  id          String    @id @default(cuid())
  workspaceId String
  itemId      String    // ex: "desk", "plant", "PC1"
  quantity    Int       @default(1)
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}

model CoinTransaction {
  id          String   @id @default(cuid())
  workspaceId String
  amount      Int      // positif = gain, negatif = depense
  reason      String   // "agent_tokens" | "shop_purchase" | "initial_grant"
  agentId     String?
  createdAt   DateTime @default(now())
}
```

### Règle de conversion

`1 token consommé = 1 coin`
Solde de départ : 500 coins offerts au premier lancement.

### Endpoints backend

```
GET  /api/economy/balance          → { coins, totalEarned }
GET  /api/economy/inventory        → InventoryItem[]
POST /api/economy/purchase         → { itemId } → { ok, newBalance }
POST /api/economy/coins/add        → { agentId, tokens } → { newBalance }
GET  /api/agents/:id/files         → fichiers générés par l'agent
GET  /api/agents/:id/tasks         → historique tâches
GET  /api/agents/:id/stats         → coins/tokens dans le temps
```

---

## B — Customisation de la salle

### Sols

- 7 types de tiles déjà existants (`FLOOR_1` à `FLOOR_7`)
- Color-picker pixel art (palette fixe de 16 couleurs) par tile ou par zone
- Le `FloorColor` existant (`h/s/b/c`) est déjà utilisable

### Murs

- Nouveau type de tile : `WALL_COLORABLE`
- Même color-picker que les sols
- Stocké dans `tileColors` du `OfficeLayout` existant

### Sprites Office

Tous les PNG de `images_pixel/Office/` intégrés au catalogue :
- PC1, PC2, desk, chair, plant, printer, coffee-maker, writing-table, sink, cabinet, water-cooler, stamping-table, window, trash...
- Sprites numérotés (Sprite-0002 à Sprite-0033) catégorisés

---

## C — Interaction bureau (Agent Screen)

Clic sur un desk en mode normal → overlay plein écran style Windows XP.

### Layout

```
╔══════════════════════════════════════════════════════════╗
║  Dev Station — CodeBot                       _ □ X      ║
╠══════════════════════════════════════════════════════════╣
║  Sidebar          Contenu principal                      ║
║  ─────────        ────────────────                       ║
║  Fichiers         Liste fichiers / Kanban / Stats / Chat ║
║  Taches                                                  ║
║  Stats                                                   ║
║  Chat                                                    ║
║  Config                                                  ║
╠══════════════════════════════════════════════════════════╣
║  Working  ·  1,240 coins  ·  1,240 tokens               ║
╚══════════════════════════════════════════════════════════╝
```

### Onglets

| Onglet | Contenu |
|--------|---------|
| Fichiers | Documents générés (md, ts, json) + viewer intégré |
| Tâches | Kanban A venir / En cours / Terminées, depuis eventParser |
| Stats | Graphe coins/tokens, vitesse, uptime |
| Chat | AgentPanel ChatTab existant réutilisé |
| Config | Modèle, skills, hooks de l'agent |

### Header interactif

- Nom du poste : éditable inline, persisté en localStorage
- Agent assigné : dropdown des agents disponibles
- Bouton "Changer" : réassigne le poste

---

## A — Boutique + Inventaire

### Shop Overlay

Bouton SHOP dans TopBar → overlay plein écran.

```
┌─ BOUTIQUE ──────────────────────────────────────────────┐
│  Catégories (sidebar)    Items (grille)    Balance       │
│  Tech / Chaises /        [img] nom prix    💰 1,250     │
│  Décor / Sols /           [Acheter]                     │
│  Murs / Couleurs                                        │
└─────────────────────────────────────────────────────────┘
```

- Images réelles des sprites PNG affichées dans le shop
- Items déjà possédés : bouton "Possédé" (ou "+1" si empilable)
- Prix en coins, déduit immédiatement via `/api/economy/purchase`

### Inventory Bar (Mode Edit)

En mode Edit, barre en bas de l'écran :

```
┌─ INVENTAIRE ──────────────────────────────────────────────┐
│  [Tous] [Tech] [Chaises] [Décor] [Sols] [Murs]           │
│  [img PC x2] [img Desk x1] [img Plant x3] ...            │
└──────────────────────────────────────────────────────────┘
```

### Flow de placement

1. Clic item inventaire → colle au curseur
2. Clic sur la carte → posé, quantité -1
3. Clic droit sur meuble posé → Déplacer / Supprimer / Retour inventaire

---

## Nouveaux composants frontend

| Fichier | Rôle |
|---------|------|
| `src/store/economyStore.ts` | Zustand : coins, inventaire |
| `src/economy/coinEngine.ts` | Intercepte events WS → POST coins/add |
| `src/components/ShopOverlay.tsx` | Boutique plein écran |
| `src/components/InventoryBar.tsx` | Barre inventaire mode Edit |
| `src/components/AgentScreen.tsx` | Écran PC style WinXP |
| `src/components/AgentScreen/FilesTab.tsx` | Fichiers générés |
| `src/components/AgentScreen/TasksTab.tsx` | Kanban tâches |
| `src/components/AgentScreen/StatsTab.tsx` | Graphe coins/tokens |

## Assets PixelLab à générer

- Icône boutique pixel art (16x16)
- Icône sac / inventaire (16x16)
- Effet particules coins (animation)
- Textures de sol/mur supplémentaires
