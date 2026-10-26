<p align="center">
  <a href="https://teamonly.dev/?ref=github"><img src="https://teamonly.dev/og-default.png" alt="TeamOnly" width="560"></a>
</p>

<p align="center">
  <strong>Internal tool templates you build on with Claude Code or Cursor, and share only with your team.</strong><br>
  <a href="https://teamonly.dev/?ref=github">Website</a> ·
  <a href="https://teamonly.dev/templates?ref=github">Templates</a> ·
  <a href="https://teamonly.dev/docs?ref=github">Docs</a> ·
  <a href="https://www.npmjs.com/package/teamonly">npm</a>
</p>

# TeamOnly templates

Five working internal tools, plus the instructions that teach AI coding tools how to build apps like them. Start from one, ask your AI tool to change it, and put it online behind your company login with one command.

| Template | What it does |
|---|---|
| [`expense-approval`](templates/expense-approval) | Expenses with receipt photos, approvers, a monthly finance view and CSV export |
| [`inventory-tracker`](templates/inventory-tracker) | Items by location with counts, reorder levels, change history, low stock and spreadsheet import |
| [`request-form`](templates/request-form) | A request form with a queue marked new, in progress or done, and optional Slack messages |
| [`customer-lookup`](templates/customer-lookup) | Search customers by name, email or account number, shared notes, CSV upload |
| [`ask-the-docs`](templates/ask-the-docs) | Upload PDFs, Markdown and text, search them, and get cited answers with an Anthropic API key |

Screenshots and the prompt to build each one: [teamonly.dev/templates](https://teamonly.dev/templates?ref=github).

## Use one

```sh
npx teamonly init --template expense-approval expenses
cd expenses
npm install
npm run dev            # runs locally, signed in as a test user
npx teamonly deploy    # online at https://expenses.<your-company>.teamonly.app
```

`init` fills in the app name and versions (the `__APP_NAME__` placeholders in this repo). Coworkers sign in with their work Google or Microsoft account, or a code sent to their work email. Nobody outside your company gets in.

Prefer to ask your AI tool? In Claude Code or Cursor, say: *"Start from the TeamOnly expense-approval template and deploy it on TeamOnly."*

## The app shape

Every template is the same small stack, which AI tools get right the first time:

- `src/client/`: React + Vite front end
- `src/worker/index.ts`: a Hono API on a Cloudflare Worker
- `migrations/*.sql`: the database schema (SQLite / D1)
- `teamonly.json`: the app name

In the API, `c.var.ctx` gives you the signed-in `user`, the app's `db`, `files` and `secrets`. Details in the [docs](https://teamonly.dev/docs?ref=github).

## AI instructions

[`ai-instructions/`](ai-instructions) holds what `npx teamonly init` adds to a project so Claude Code, Cursor and other agents build in this shape:

- `SKILL.md`: a Claude Code skill (goes in `.claude/skills/teamonly/`)
- `AGENTS.md`: for Codex, Cursor and other agents that read AGENTS.md
- `teamonly.mdc`: a Cursor rule (goes in `.cursor/rules/`)

They also cover moving a Lovable, Bolt or v0 app onto this shape.

## About TeamOnly

[TeamOnly](https://teamonly.dev/?ref=github) hosts the internal tools people build with AI, behind their company login, with a database, file storage and secrets included. Plans start at $19 a month. IT gets a list of every app, who owns it and who can open it.

This repo mirrors the templates in the [`teamonly`](https://www.npmjs.com/package/teamonly) npm package. The templates and AI instructions are MIT licensed: use them however you like.

Questions: [hello@teamonly.dev](mailto:hello@teamonly.dev)
