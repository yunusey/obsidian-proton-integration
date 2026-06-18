# Obsidian Proton Integration Plugin

Bridge between [Obsidian](https://obsidian.md) and [Proton Drive](https://proton.me/drive), built on the official [`@protontech/drive-sdk`](https://www.npmjs.com/package/@protontech/drive-sdk).

## Status

Early foundation: browser sign-in, session persistence, and Proton drive link embeds in reading view.

> **Note:** The Proton Drive SDK is still evolving and does not yet ship standalone auth. This plugin implements the same auth/API wiring pattern used by the [official Drive CLI](https://github.com/ProtonDriveApps/sdk/tree/main/js/cli).

## Requirements

- Obsidian desktop or mobile
- A Proton account

## Development

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/obsidian-proton-integration/` folder (or symlink the repo).

## Usage

1. Open **Settings → Obsidian Proton Integration** and click **Sign in**, or run **Sign in to proton drive** from the command palette.
2. Complete sign-in in your browser when prompted.
3. Embed a Proton drive file in a note with `![](https://drive.proton.me/...)` in reading view.

Supported embed types: **images**, **videos**, and **documents** (PDF inline preview, plain text, and markdown).

### Privacy settings

- **Keep credentials in memory only:** sign-in data is not written to Obsidian plugin storage; you sign in again after each Obsidian restart.

## Architecture

```
src/
  main.ts                 Plugin entry, sign-in, embed registration
  embed/                  Proton drive link embeds (reading view)
  settings.ts             Settings tab
  plugin-storage.ts       Credential + client UID persistence
  proton/
    drive-service.ts      ProtonDriveClient lifecycle
    crypto.ts             @protontech/crypto initialization
    credentials.ts        Session state
    api/                  Auth + HTTP layer (SDK prerequisites)
```

The SDK handles encrypted drive operations once `ProtonDriveClient` is constructed with:

- `httpClient` — authenticated requests to `drive-api.proton.me`
- `account` — user keys/addresses for decryption
- `openPGPCryptoModule` — crypto via `@protontech/crypto`
- `srpModule` — SRP auth helpers
- `entitiesCache` / `cryptoCache` — in-memory caches (SQLite later)

## Proton SDK guidelines

This plugin identifies itself to Proton APIs as:

`external-drive-obsidian_integration@1.0.0-stable`

Per [Proton's SDK usage guidelines](https://github.com/ProtonDriveApps/sdk#usage-guidelines-for-personal-projects), third-party apps must not use Proton branding and must disclose that credentials are entered into an unofficial application.

## License

MIT
