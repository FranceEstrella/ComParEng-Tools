# ComParEng-Tools
A collection of tools designed to help Computer Engineering students at FEU Tech manage their academic journey more effectively.

## Feedback email (Mailgun)

This project can forward user feedback submitted from the homepage to an email address using Mailgun's HTTP API.

Required environment variables (server-side):

- `MAILGUN_API_KEY` - your Mailgun API key (starts with `key-...`)
- `MAILGUN_DOMAIN` - the Mailgun sending domain (e.g. `mg.example.com`)
- `SENDER_EMAIL` - optional sender address (defaults to `no-reply@compareng.app`)

How to test locally:

1. Create a `.env.local` file at the project root and add the variables above. Do NOT commit this file.
2. Restart the dev server (`next dev`).
3. Open the homepage, open the Patch Notes → Send Feedback modal, and use "Send to Server" to submit a test message.

If Mailgun is not configured the route will log the payload and return a helpful JSON response.
