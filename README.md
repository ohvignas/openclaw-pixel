# OpenClaw Pixel UI

Interface visuelle pixel art pour gérer tes agents Open Claw.

## Installation (2 minutes)

1. Installe [Docker Desktop](https://docker.com/get-started)
2. Ouvre un terminal et copie-colle :

```
git clone https://github.com/ohvignas/openclaw-pixel
cd openclaw-pixel
cp .env.example .env
```

3. Ouvre le fichier `.env` avec un éditeur de texte, et colle ta clé Anthropic sur la ligne `ANTHROPIC_API_KEY=`
4. Lance :

```
docker compose up -d
```

5. Ouvre **http://localhost:3333** dans ton navigateur

## Ajouter une instance (VPS, second serveur)

Clique sur le bouton **+** dans la barre du haut pour ajouter une instance.
Renseigne le nom, l'URL WebSocket (`ws://ton-vps:18789`) et le token si configuré.
Tu peux ensuite switcher d'instance en un clic depuis la barre en haut.

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (obligatoire) | — |
| `PORT` | Port d'accès à l'UI | `3333` |
| `OPENCLAW_GATEWAY_TOKEN` | Token d'authentification gateway | — |
