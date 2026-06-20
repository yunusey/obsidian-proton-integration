# Obsidian Proton Integration Plugin

Bridge between [Obsidian](https://obsidian.md) and [Proton Drive](https://proton.me/drive), built on the official [`@protontech/drive-sdk`](https://www.npmjs.com/package/@protontech/drive-sdk). This is an independent project and is **not affiliated with, endorsed by, or sponsored by Proton AG** or any of its products.

## Status

Early foundation: browser sign-in, optional session persistence, and Proton drive link embeds in reading view.

> [!CAUTION]
> The Proton Drive SDK is still evolving and does not yet ship standalone auth. This plugin implements the same auth/API wiring pattern used by the [official Drive CLI](https://github.com/ProtonDriveApps/sdk/tree/main/js/cli).

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
3. Embed Proton files in reading view (see below).

Supported embed types: **images**, **videos**, and **documents** (PDF inline preview, plain text, and markdown).

### Node UID links (recommended)

The plugin supports **`proton-drive:///` links** -- a stable embed format based on Proton’s canonical node UID (`volumeId~nodeId`), not the share ID in a browser URL.

**Why prefer these over `drive.proton.me` links?**

- **Stable:** the UID identifies the file in storage; it does not depend on share context (`shareId`) from the web app.
- **Works for Photos:** library items often have no copyable web URL; UID links are the supported way to embed them.
- **Aligned with the SDK:** Proton’s web URLs (`.../shareId/file/nodeId`) are legacy; resolving them uses deprecated SDK APIs (`getNodeUid`) that exist only for backward compatibility with the old web app.

**How to add one**

1. Run **Insert proton drive embed from node uid** from the command palette, paste a UID (`volumeId~nodeId`), and insert the embed; or
2. Paste a link directly in a note:

```markdown
![](proton-drive:///volumeId~nodeId)
```

The plugin URL-encodes the UID in the path (for example, `~` becomes `%7E`).

Works for files in **My files** and the **Photos** library (your own volumes).

### Web share links (legacy)

You can still embed My files items copied from the browser:

```markdown
![](https://drive.proton.me/.../shareId/file/nodeId)
```

These rely on deprecated share-ID resolution in the SDK and may break as Proton moves to volume-based navigation. They do **not** work for Photos library items. Prefer **`proton-drive:///`** links when you can.

### Privacy and local storage

- **Keep credentials in memory only:** sign-in data is not written to Obsidian plugin storage; you sign in again after each Obsidian restart. Because Proton is known for its stance "Privacy by default", this is the default behavior.

  If you would like your session to persist across Obsidian sessions, you can disable this option. However, please keep in mind that doing so will write your credentials to `.obsidian/plugins/obsidian-proton-integration/data.json`, unencrypted. **Do not share this file, and do not add it to version control.**

- **Client UID:** the plugin also stores a random `protonClientUid` in `data.json`. This is required by the Proton Drive SDK to identify this Obsidian installation (for upload/sync state on Proton's side). It is not a credential, is not tied to your Proton identity, and is always persisted, even when "Keep credentials in memory only" is enabled. If you are not using session persistence, `data.json` contains only this UID. You can safely share it or add it to version control. Deleting it will cause a new one to be generated on next launch.

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

`external-drive-obsidian_integration@0.1.0-stable`

Per [Proton's SDK usage guidelines](https://github.com/ProtonDriveApps/sdk#usage-guidelines-for-personal-projects), third-party apps must not use Proton branding and must disclose that credentials are entered into an unofficial application.

## AI disclosure

This project has used AI tools during development, and this section explains how.

During the early foundation stage, [Cursor](https://cursor.com) (Pro) was used to move quickly and explore implementations. Each change was reviewed manually to the best of my ability before landing. Going forward, the focus shifts toward slower, smaller changes; I expect the project's own stability to improve as a result.

That said, stability also depends on upstream: the Proton Drive SDK is still evolving and can change without much notice. This plugin cannot promise a stable or backwards-compatible experience anytime soon, regardless of how carefully changes are reviewed here.

For pull requests, I review every change myself first. After that, I also run [GitHub Copilot](https://github.com/features/copilot) code review on the PR. Those review comments are public on GitHub. I rely on this extra pass mainly because I am the sole maintainer of the project for now.

## License

MIT
