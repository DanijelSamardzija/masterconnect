const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: { name: string; email: string };
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  const toArray = Array.isArray(options.to) ? options.to : [options.to];

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: options.from ?? { name: 'GigZone', email: 'hello@gigzone.app' },
      to: toArray.map(email => ({ email })),
      subject: options.subject,
      htmlContent: options.html,
      ...(options.replyTo ? { replyTo: { email: options.replyTo } } : {}),
    }),
  });

  return res.ok;
}
