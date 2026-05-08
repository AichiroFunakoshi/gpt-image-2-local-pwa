# GitHub Workflow

This project is intended to be shared across Macs through GitHub while keeping secrets and generated files local.

## First-time setup on another Mac

```zsh
git clone https://github.com/AichiroFunakoshi/gpt-image-2-local-pwa.git
cd gpt-image-2-local-pwa
npm install
cp .env.example .env
```

Edit `.env` locally:

```text
OPENAI_API_KEY=sk-your_api_key_here
PORT=3000
HOST=127.0.0.1
```

Run:

```zsh
npm start
```

Open:

```text
http://127.0.0.1:3000
```

## Optional shared iCloud env

Instead of committing `.env`, keep a private env file outside the repo:

```text
../.secrets/gpt-image-2-local-pwa.env
```

Or start with an explicit env path:

```zsh
ENV_FILE="/path/to/gpt-image-2-local-pwa.env" npm start
```

## Normal change flow

```zsh
git checkout main
git pull
git checkout -b codex/my-change
```

After changes:

```zsh
npm run check
git status --short
git add -p
git commit -m "Describe change"
git push -u origin codex/my-change
```

Then open a pull request on GitHub. CodeRabbit can review the PR there.

## After merge

On each Mac:

```zsh
git checkout main
git pull
npm install
```

Use `npm install` after pulling whenever `package.json` or `package-lock.json` changes.

## Never commit

- `.env`
- API keys
- `node_modules/`
- `data/uploads/`
- `data/outputs/`
- `data/logs/`
- private reference images
