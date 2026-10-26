# __APP_TITLE__

A request form and queue for your team, hosted on TeamOnly. Started from the `request-form` template.

- Anyone at the company sends a request: what they need, details, and an optional date they need it by.
- The people who handle requests work a queue, needed-soonest first, marked **New**, **In progress** or **Done**. They can assign a request to themselves and reply.
- Everyone sees the status of their own requests and the reply, and can withdraw one nobody has started.
- Optional: a message in a Slack channel for every new request.

## Who sees what

| | Can |
|---|---|
| Everyone who can open the app | Send requests, follow their own |
| People who handle requests | See the whole queue, change status, assign, reply |
| Admins | Change who handles requests and who is an admin (People tab) |
| You, the owner | Everything. The owner is the person who first deploys the app. |

After the first deploy, open the app, go to **People** and add whoever handles requests with you.

## Run it

```sh
npm install
npm run dev            # http://localhost:5173, signed in as a test user who owns the app
npx teamonly login     # once per computer
npx teamonly deploy    # puts it online behind your company login
```

## Slack messages (optional)

Create an incoming webhook for the channel (in Slack: Apps, then Incoming Webhooks), then:

```sh
npx teamonly secrets set SLACK_WEBHOOK_URL    # paste the webhook URL when asked
```

Without it the app works the same, just without the messages. The queue tab shows a count of new requests instead.

## Change it

Ask your AI tool, for example:

- "Add a dropdown for request type, and send laptop requests to a separate list for IT."
- "Let people attach a photo or file to a request."
- "Add a comments thread on each request so we can go back and forth."

The files: `src/worker/index.ts` is the API, `src/client/` is the UI, `migrations/0001_init.sql` is the database. The rules your AI tool follows are in `AGENTS.md` and `.claude/skills/teamonly/SKILL.md`.
