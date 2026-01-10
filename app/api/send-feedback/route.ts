import { NextResponse } from 'next/server'
import { recordAnalyticsEvent } from '@/lib/analytics-storage'

type Payload = {
  name?: string
  subject?: string
  message?: string
}

// This route will attempt to send feedback via Mailgun when MAILGUN_API_KEY and MAILGUN_DOMAIN are provided.
// Environment variables used:
// - MAILGUN_API_KEY (full key, e.g. 'key-...')
// - MAILGUN_DOMAIN (your Mailgun sending domain, e.g. 'mg.example.com')
// - SENDER_EMAIL (optional, defaults to 'no-reply@compareng.app')

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload
    const name = payload.name || 'Anonymous'
    const subject = payload.subject || '(no subject)'
    const message = payload.message || ''

    const mailgunKey = process.env.MAILGUN_API_KEY
    const mailgunDomain = process.env.MAILGUN_DOMAIN
    const sender = process.env.SENDER_EMAIL || 'no-reply@compareng.app'
    const recipient = 'dozey.help@gmail.com'

    // Build a simple plain-text email body
    const bodyText = [`From: ${name}`, `Subject: ${subject}`, '', message].join('\n')

    if (!mailgunKey || !mailgunDomain) {
      // No Mailgun config — log and return a helpful response
      console.warn('[send-feedback] MAILGUN_API_KEY or MAILGUN_DOMAIN not configured. Feedback payload:', { name, subject, message })
      recordAnalyticsEvent({
        name: 'feedback.send_failed',
        at: Date.now(),
        path: '/api/send-feedback',
        meta: { reason: 'mailgun_not_configured' },
      })
      return NextResponse.json({ success: false, error: 'Mailgun not configured on server. Feedback logged.' }, { status: 200 })
    }

    // Mailgun HTTP API expects form-encoded data
    const url = `https://api.mailgun.net/v3/${mailgunDomain}/messages`
    const form = new URLSearchParams()
    form.append('from', `${escapeHeader(sender)} (ComParEng Tools) <${sender}>`)
    form.append('to', recipient)
    form.append('subject', `[ComParEng Feedback] ${subject}`)
    form.append('text', bodyText)
    form.append('html', `<pre>${escapeHtml(bodyText)}</pre>`)

    // Mailgun uses Basic auth with username 'api' and the api key as password
    const basic = Buffer.from(`api:${mailgunKey}`).toString('base64')

    const sendRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    if (!sendRes.ok) {
      const text = await sendRes.text()
      console.error('[send-feedback] Mailgun error', sendRes.status, text)
      recordAnalyticsEvent({
        name: 'feedback.send_failed',
        at: Date.now(),
        path: '/api/send-feedback',
        meta: { reason: 'mailgun_error', status: sendRes.status },
      })
      return NextResponse.json({ success: false, error: 'Mailgun send failed', details: text }, { status: 500 })
    }

    recordAnalyticsEvent({
      name: 'feedback.send_success',
      at: Date.now(),
      path: '/api/send-feedback',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-feedback] unexpected error', err)
    recordAnalyticsEvent({
      name: 'feedback.send_failed',
      at: Date.now(),
      path: '/api/send-feedback',
      meta: { reason: 'unexpected_error' },
    })
    return NextResponse.json({ success: false, error: 'unexpected error' }, { status: 500 })
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
}

function escapeHeader(s: string) {
  // Minimal header escape
  return s.replace(/\r|\n/g, '')
}
