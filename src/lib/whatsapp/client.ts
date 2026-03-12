import twilio from 'twilio'

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('Twilio credentials not configured')
  return twilio(sid, token)
}

/**
 * Send a WhatsApp message via Twilio.
 * `to` must be an E.164 phone number, e.g. "+27821234567".
 * The "whatsapp:" prefix is added automatically.
 */
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM is not set')
  const client = getTwilioClient()
  await client.messages.create({
    from,
    to: `whatsapp:${to}`,
    body,
  })
}
