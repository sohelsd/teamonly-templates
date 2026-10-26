# __APP_TITLE__

Expense approval for your team, hosted on TeamOnly. Started from the `expense-approval` template.

- People submit an expense with an amount, a date, a category and a photo or PDF of the receipt.
- Approvers approve or reject it with a note. Nobody can approve their own expense.
- Finance sees everything approved in a month, with totals by category, and downloads it as a CSV for the books.

## Who sees what

| | Can |
|---|---|
| Everyone who can open the app | Submit expenses, see their own, withdraw one that is still waiting |
| Approvers | See and decide on everyone's expenses, open any receipt |
| Finance | See approved expenses by month, download the CSV, open any receipt |
| Admins | Change who is an approver, finance or admin (People tab) |
| You, the owner | Everything. The owner is the person who first deploys the app. |

There are no approvers until you add them. After the first deploy, open the app, go to **People** and add your approvers and finance team by work email. Until you do, you approve everything yourself (except your own expenses).

## Run it

```sh
npm install
npm run dev            # http://localhost:5173, signed in as a test user who owns the app
npx teamonly login     # once per computer
npx teamonly deploy    # puts it online behind your company login
```

Receipts are stored with `ctx.files`. To try being someone else locally, see `.dev.vars.example`.

## Change it

The amounts use the currency in `src/shared/types.ts` (`CURRENCY`), and the categories are listed in the same file. Ask your AI tool for anything else, for example:

- "Add a monthly limit per person and flag anything over it in red for finance."
- "Let people add a project code to each expense and add it to the CSV."
- "Send a Slack message to approvers when a new expense comes in." (needs a webhook secret)

The files: `src/worker/index.ts` is the API, `src/client/` is the UI, `migrations/0001_init.sql` is the database. The rules your AI tool follows are in `AGENTS.md` and `.claude/skills/teamonly/SKILL.md`.
