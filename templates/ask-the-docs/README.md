# __APP_TITLE__

Search for your team's documents, hosted on TeamOnly. Started from the `ask-the-docs` template.

- Editors upload handbooks, policies and how-tos as PDF, Markdown (.md) or text (.txt) files.
- Coworkers search them in plain words. Results show the matching passage with the words highlighted and link straight to the place it came from: the right page of the PDF, or the right section of a Markdown or text file.
- Optional: with an Anthropic API key, the app also answers questions in a few sentences, citing the passages it used.

## Answers with Claude (optional)

Without a key, this is a search tool and your documents never leave the app. To turn on written answers:

```sh
npx teamonly secrets set ANTHROPIC_API_KEY    # paste the key from console.anthropic.com when asked
```

When someone asks a question, the app searches first and sends only the best matching passages (up to eight) to Claude, which answers from those and nothing else. The model is set in `src/worker/claude.ts`.

## Who sees what

| | Can |
|---|---|
| Everyone who can open the app | Search, ask, read documents |
| Editors | Upload and remove documents |
| Admins | Change who is an editor or admin (People tab) |
| You, the owner | Everything. The owner is the person who first deploys the app. |

## Run it

```sh
npm install
npm run dev            # http://localhost:5173, signed in as a test user who owns the app
npx teamonly login     # once per computer
npx teamonly deploy    # puts it online behind your company login
```

For answers locally, put `ANTHROPIC_API_KEY=...` in `.dev.vars` and restart.

## What it can read

- **PDF**: text is pulled out page by page when you upload (with unpdf), so results can open the PDF at the right page. Scanned PDFs (photos of paper) have no text and are refused with a message; upload a version with real text.
- **Markdown and text**: split by headings and paragraphs.
- **Word, Google Docs, web pages**: save or export as PDF first.

Search uses SQLite full-text search (FTS5) in the app's database, with word stemming, so "printing" also finds "print" and "prints".

## Change it

Ask your AI tool, for example:

- "Add a 'was this helpful?' button and show me which searches found nothing."
- "Group documents into folders like HR, IT and Finance, and let people search one folder."
- "Show when each document was last updated and remind editors about ones older than a year."

The files: `src/worker/index.ts` is the API (`extract.ts` splits documents, `search.ts` searches, `claude.ts` writes answers), `src/client/` is the UI, `migrations/0001_init.sql` is the database. The rules your AI tool follows are in `AGENTS.md` and `.claude/skills/teamonly/SKILL.md`.
