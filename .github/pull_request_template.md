## Summary

- [Short summary of the changes]

## Validation

- [ ] `npm run check`
- [ ] `npm start`
- [ ] Confirm `GET /api/status` returns `ok: true`

## Safety / Privacy

- [ ] `.env` and API keys are not committed
- [ ] Generated images in `data/outputs/` are not committed
- [ ] Uploads and logs in `data/` are not committed
- [ ] Image generation calls were only made with explicit user approval

## Notes for CodeRabbit

Please focus on:

- server-side API key handling
- generated file and log exclusion from git
- model-specific image API parameters
- prompt-builder behavior preserving user intent while avoiding unsafe wording
