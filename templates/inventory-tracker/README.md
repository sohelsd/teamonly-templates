# __APP_TITLE__

An inventory tracker for your team, hosted on TeamOnly. Started from the `inventory-tracker` template.

- Items with a SKU or code, a location (bin, shelf, room), a count and a reorder level.
- Anyone can find an item from their phone and log what came in, what went out, what was damaged, or a fresh count. Counts can't go below zero, even when two people save at once.
- Every change is kept in a history with who made it, when and why.
- A low stock list, emptiest first, and a badge with how many items are low.
- Admins can paste a list straight from Excel or Google Sheets to add or update items in bulk.

## Who sees what

| | Can |
|---|---|
| Everyone who can open the app | Look up items, add items, change counts, edit details, see the history |
| Admins | Import from a spreadsheet, delete items, change who is an admin (People tab) |
| You, the owner | Everything. The owner is the person who first deploys the app. |

## Run it

```sh
npm install
npm run dev            # http://localhost:5173, signed in as a test user who owns the app
npx teamonly login     # once per computer
npx teamonly deploy    # puts it online behind your company login
```

To load your current stock, open **Import**, copy the rows from your spreadsheet (with the heading row) and paste them in.

## Change it

Ask your AI tool, for example:

- "Let people scan a barcode with their phone camera to find the item instead of searching."
- "Add a supplier and unit cost to each item, and show the value of what is in stock."
- "Add a Download CSV button to the low stock page so I can send it to purchasing."

The files: `src/worker/index.ts` is the API, `src/client/` is the UI, `migrations/0001_init.sql` is the database. The rules your AI tool follows are in `AGENTS.md` and `.claude/skills/teamonly/SKILL.md`.
