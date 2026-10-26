# __APP_TITLE__

A customer lookup for your team, hosted on TeamOnly. Started from the `customer-lookup` template.

- Search customers by name, company, email, phone or account number. Every word you type narrows it down, and an exact account number comes first.
- Notes on each customer that the whole team can read and add to.
- Admins upload a CSV export from a spreadsheet, billing system or CRM to refresh the list. Customers are matched on account number (or email), so notes stay attached. Customers missing from a new upload are kept and marked, not deleted.

## Who sees what

| | Can |
|---|---|
| Everyone who can open the app | Search, open customers, add notes, delete their own notes |
| Admins | Upload the customer list, delete any note, change who is an admin (People tab) |
| You, the owner | Everything. The owner is the person who first deploys the app. |

Customer details are sensitive. If not everyone at the company should see them, limit who can open the app:

```sh
npx teamonly access only priya@acme.com sam@acme.com    # the owner is always included
```

## Run it

```sh
npm install
npm run dev            # http://localhost:5173, signed in as a test user who owns the app
npx teamonly login     # once per computer
npx teamonly deploy    # puts it online behind your company login
```

Then open **Upload list** and choose your CSV. The columns it looks for: account number, name, company, email, phone, plan, account manager, customer since. Other names for the same thing (Customer ID, Organization, Tel) are recognised too, and the order doesn't matter.

## Change it

Ask your AI tool, for example:

- "Show the last five notes on the search results so I don't have to open each customer."
- "Add a renewal date column and a page listing customers who renew in the next 30 days."
- "Let people tag notes as call, email or meeting."

The files: `src/worker/index.ts` is the API, `src/client/` is the UI (`csv.ts` reads the upload), `migrations/0001_init.sql` is the database. The rules your AI tool follows are in `AGENTS.md` and `.claude/skills/teamonly/SKILL.md`.
