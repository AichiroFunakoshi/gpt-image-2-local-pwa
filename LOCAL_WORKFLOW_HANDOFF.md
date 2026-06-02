# gpt-image-2-local-pwa multi-Mac workflow handoff

Last updated: 2026-06-02 JST

## Source of truth

GitHub is the source of truth for project code:

```text
https://github.com/AichiroFunakoshi/gpt-image-2-local-pwa
```

The default branch is `main`.

## Unified policy

Use this file as the highest-priority workflow handoff when it conflicts with older notes.

The unified policy is:

- GitHub `main` is the source of truth for code.
- Each Mac works from its own local clone at `/Users/inaminetetsuo/Projects/gpt-image-2-local-pwa`.
- The iCloud Drive copy is a handoff/archive reference, not the normal coding workspace.
- Before starting work on any Mac, run `git checkout main` and `git pull --ff-only`.
- Use feature branches and pull requests for changes.
- Do not use iCloud sync as a code synchronization mechanism.
- Do not overwrite local generated data, private reference images, `.env`, or `.secrets` from another Mac.
- If local and remote histories diverge, stop and inspect. Do not force-push, reset, or overwrite without explicit approval.

## Where to work on each Mac

Use this local clone path on each Mac:

```text
/Users/inaminetetsuo/Projects/gpt-image-2-local-pwa
```

If the clone does not exist:

```zsh
mkdir -p /Users/inaminetetsuo/Projects
git clone --branch main https://github.com/AichiroFunakoshi/gpt-image-2-local-pwa.git /Users/inaminetetsuo/Projects/gpt-image-2-local-pwa
cd /Users/inaminetetsuo/Projects/gpt-image-2-local-pwa
npm install
```

If the clone already exists:

```zsh
cd /Users/inaminetetsuo/Projects/gpt-image-2-local-pwa
git checkout main
git pull --ff-only
npm install
```

## Normal work loop

```zsh
cd /Users/inaminetetsuo/Projects/gpt-image-2-local-pwa
git checkout main
git pull --ff-only
git checkout -b codex/my-change
npm run check
git status --short
git add -p
git commit -m "Describe change"
git push -u origin codex/my-change
```

Open a pull request on GitHub, wait for CodeRabbit, then merge only after review is clear.

## Data and secrets

Keep these local and out of GitHub:

- `.env`
- API keys
- `node_modules/`
- `data/uploads/`
- `data/outputs/`
- `data/logs/`
- private reference images

The repository `.gitignore` already excludes these.

## Quick progress check

```zsh
cd /Users/inaminetetsuo/Projects/gpt-image-2-local-pwa
git status --short --branch
git log --oneline --decorate -5
```

Expected clean state:

```text
## main...origin/main
```
