// Temporary Mailgun test script
// Usage (PowerShell):
// $env:MAILGUN_API_KEY = 'key-...'; node scripts/mailgun-test.js

const domain = process.env.MAILGUN_DOMAIN || 'sandbox1625abeff5e24c7bae32c78af2cbc76f.mailgun.org'
const key = process.env.MAILGUN_API_KEY

if (!key) {
  console.error('Set MAILGUN_API_KEY env var before running this script')
  process.exit(1)
}

const recipient = 'dozey.help@gmail.com'
const sender = process.env.SENDER_EMAIL || 'no-reply@compareng.app'

async function main() {
  const url = `https://api.mailgun.net/v3/${domain}/messages`
  const form = new URLSearchParams()
  form.append('from', `${sender} (ComParEng Tools) <${sender}>`)
  form.append('to', recipient)
  form.append('subject', `[ComParEng Feedback] Test message`)
  form.append('text', `This is a test message sent at ${new Date().toISOString()} by an automated test.`)
  form.append('html', `<p>This is a <strong>test</strong> message sent at ${new Date().toISOString()}</p>`)

  const basic = Buffer.from(`api:${key}`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })

  const text = await res.text()
  console.log('Status:', res.status)
  console.log('Body:', text)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
