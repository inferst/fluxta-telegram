# AGENTS.md

This document provides instructions for agentic coding agents working in this repository.

## Project Overview

Fluxta Telegram is a [Fluxta](https://fluxta.app) plugin that posts to Telegram through the Bot API. Its Actions send messages to channels, groups and people through bots the user owns, and produce what a later step needs to edit them — the typical use is announcing a stream when it goes live and editing the announcement when it ends. Each destination is a configured **Chat** with its own bot token (see `CONTEXT.md`).

It is a pnpm workspace (turbo) of three TypeScript packages. The Plugin API it builds against — `@fluxta/sdk` and the `fluxta` CLI from `@fluxta/cli` — is owned by Fluxta, not by this repo (see [Working against Fluxta](#working-against-fluxta)).

## Commands

### Setup

```bash
pnpm install     # Node ≥ 22.18, the pnpm version pinned in package.json
```

### Development & Build

```bash
pnpm build          # wipe dist/ and build the editors and the sidecar into dist/telegram/
pnpm dev            # build the editors once, then watch both apps
pnpm typecheck      # tsc --noEmit in every package
pnpm test           # vitest in apps/plugin and packages/protocol
pnpm lint           # eslint over the whole workspace
pnpm format         # prettier --write; `pnpm format:check` only checks
```

`fluxta publish` runs `lint` and `format:check` itself and stops if either fails.

### Target a specific package

```bash
pnpm --filter telegram-plugin test
pnpm --filter telegram-protocol test
pnpm --filter telegram-editor build
```

### Run it in Fluxta

`dist/telegram/` is the build folder Fluxta loads (see Fluxta's [Development](https://fluxta.app/docs/plugins/getting-started/development) guide). Every successful sidecar build — `pnpm build` included — ends with `fluxta restart`, which, while Fluxta is running, links this build and restarts the plugin in it.

```bash
pnpm exec fluxta link dist/telegram   # a development link to this build
pnpm dev                              # every successful sidecar build runs `fluxta restart`
pnpm exec fluxta link --status        # what is linked
pnpm exec fluxta unlink               # back to the installed package
```

Editor-only rebuilds restart nothing — reopen the editor in Fluxta to see them. The sidecar logs to `dist/telegram/logs/telegram.log`; `pnpm build` wipes `dist/` and the log with it. Trying it for real needs a bot from @BotFather added to a test channel as an admin with "Post messages".

## Architecture

### Packages

- `apps/plugin` (`telegram-plugin`) — the Plugin sidecar: the Node.js process Fluxta starts. tsdown bundles it into `dist/telegram/index.mjs` and copies `manifest.json` and `icons/` beside it.
- `apps/editor` (`telegram-editor`) — the editors, React + Vite + Tailwind, built into `dist/telegram/editor/`: the Plugin Editor (`plugin.html`, the Chats list in Fluxta's settings) and one Action Editor per Action.
- `packages/protocol` (`telegram-protocol`) — what the sidecar and the editors share: the editor ↔ sidecar messages (`messages.ts`, each an object with an `event` discriminant, checked with zod), the Chat draft, its validation and chat-id normalisation (`chat.ts`), and every Action's settings type (`actions.ts`). Consumed as TypeScript source; it has no build.

### Plugin sidecar (`apps/plugin/src`)

```
index.ts          composition root: store + service, the Action, editor messages, publish(), connect()
plugin.ts         the single `Plugin` instance from @fluxta/sdk/api
chats/            the configured Chats
  store.ts          the persisted Chat list — the only writer of Plugin Settings, the only holder of tokens
  service.ts        each Chat's Chat Status: checks a Chat when its chat or token changes, keeps the newest result
  resolve.ts        which Chat an Action posts to (the sole one when its settings name none)
telegram/         the Bot API
  bot-api.ts        the only code that calls fetch: one method call, retried within a deadline
  check.ts          getMe → getChat → getChatMember, turned into a Chat Status
actions/          one StandaloneAction per manifest Action, file named after its `type`; templated.ts reads TemplateField settings
```

A Chat's status travels `service.ts` (`onChange`) → `index.ts` `publish()`, which sends the status to every open editor and the External Connections to Fluxta.

### Editors (`apps/editor`)

- One HTML entry per editor at the package root, each mounting `src/<editor>/main.tsx`. Fluxta never tells an editor which Action it edits — it only serves the path the manifest names — so every Action Editor is its own page. `vite.config.ts` picks up every `*.html` on its own.
- Editors are built from Fluxta's [UI Kit](https://fluxta.app/docs/plugins/reference/ui-kit) (`@fluxta/sdk/ui`) and read the Chats from the sidecar through `telegram-protocol` messages (`src/shared/useEditorChats.ts`).

## Key Conventions

- **Manifest and code change together.** `manifest.json` declares every Action (with its `produces`), and the code registers exactly those, by the same `type` / `key`. Adding an Action means: its manifest entry, `apps/plugin/src/actions/<type>.ts` with its test, its registration in `index.ts`, its settings type in `telegram-protocol`, `apps/editor/<type>.html`, `apps/editor/src/<type>/` and an icon in `icons/`.
- **Naming in the manifest** ([manifest reference](https://fluxta.app/docs/plugins/reference/manifest)): every kind — an Action `type` — is kebab-case (`send-message`); every key — a produced value, a settings field — is camelCase (`messageId`).
- **Every Action names its Chat** (`chat`, a Chat's id). An unset `chat` resolves to the sole configured Chat (`chats/resolve.ts`), so settings saved before a second Chat existed keep working.
- **Telegram being unreachable or refusing is normal.** `bot-api.ts` retries a network error, a 5xx or a 429 (honouring `retry_after`) only while the caller's deadline allows — an Action's is 25 s, inside Fluxta's ~30 s action timeout — and fails at once on anything Telegram refuses. Nothing throws out of `onTrigger`: an Action logs a `console.warn` and produces no values.
- **Tokens never leave the sidecar.** The editor sees `hasToken`; on update an absent token means "unchanged". No log line or error message may contain a token — the request URL carries it, so report an error's own message, never the URL. Keep it that way in any new message.
- **Plain text only.** Send no `parse_mode`: the host substitutes Run Variables into settings before `onTrigger` sees them, so the plugin cannot escape a substituted value, and one stray `<` would make Telegram reject the Message. Markup waits for an answer from Fluxta that serves every plugin.
- **Run Variables** ([guide](https://fluxta.app/docs/plugins/guides/run-variables)): a setting edited through a `TemplateField` arrives with its references substituted and may hold a number or a boolean. Read it through `templatedText` / `templatedNumber` (`actions/templated.ts`), never as a bare string.
- **The sidecar bundle is self-contained.** Fluxta runs it with a bundled Node and no `node_modules`, so tsdown inlines every non-builtin dependency (`noExternal`). Do not externalize one.
- **File naming**: the sidecar and `telegram-protocol` use kebab-case (`send-message.ts`, `bot-api.ts`). In the editors, React components are PascalCase (`ChatDialog.tsx`), hooks are `useThing.ts`.
- **Tests**: vitest, colocated `*.test.ts`. Test `bot-api.ts` against a fake `fetch` with a virtual clock (`now` / `sleep`); test everything above it against a fake `CallBotApi` that answers by method name (`check.test.ts`, `send-message.test.ts`). No test reaches the real Bot API.
- **Comments say why** — the Telegram or Fluxta behaviour that forces the code — and use the capitalized terms of `CONTEXT.md` and Fluxta's [Terminology](https://fluxta.app/docs/plugins/getting-started/terminology).

## Working against Fluxta

- **Fluxta owns the Plugin API contract**: `@fluxta/sdk`, the manifest schema and the `fluxta` CLI, documented at [fluxta.app/docs/plugins](https://fluxta.app/docs/plugins). When this plugin needs something they do not offer, do not work around the contract or patch `node_modules`: record the need in an issue here, label it `ready-for-human`, and stop — a person takes it to Fluxta (see `docs/agents/issue-tracker.md`). Once a release of the SDK or CLI provides it, it is adopted here.
- **The SDK and the CLI come from npm**, pinned once in the `catalog:` of `pnpm-workspace.yaml`; every package says `"catalog:"`. The installed typings — `apps/plugin/node_modules/@fluxta/sdk/dist/api.d.mts` (sidecar) and `ui.d.mts` (editors) — are the contract at the version in use; Fluxta's own working tree may be ahead of it.
- **Adopting a new SDK or CLI version**: bump its `catalog:` entry, add the exact version to `minimumReleaseAgeExclude` if pnpm refuses it as too young, `pnpm install`, and commit `pnpm-workspace.yaml` and `pnpm-lock.yaml` together.
- **Versions and publication**: the plugin's version is `version` in `manifest.json`. `pnpm exec fluxta publish` validates the package and opens a pull request to Fluxta's trusted catalog (`fluxta/plugins`). The catalog can hold a newer version than this repo, and `fluxta publish` merges against it rather than overwriting it. See Fluxta's [Publishing](https://fluxta.app/docs/plugins/getting-started/publishing) guide. Pushing a `version` bump to `main` also tags a draft GitHub Release (`.github/workflows/release.yml`).
- **Publishing is the user's call.** Run `fluxta publish` only when the user asks for it in the conversation.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/) without a scope, lowercase and imperative: `feat: send messages to configured Chats`, `fix: …`, `chore: bump version`.

## Agent skills

- Issues: GitHub Issues at `inferst/fluxta-telegram`. See `docs/agents/issue-tracker.md`.
- Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- Domain: `CONTEXT.md`, plus Fluxta's plugin docs and the Telegram Bot API. See `docs/agents/domain.md`.
