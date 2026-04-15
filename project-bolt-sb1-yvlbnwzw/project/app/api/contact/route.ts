import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { name, email, message } = await request.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Save to database
    const { error } = await supabase.from('support_messages').insert({
      category: 'contact',
      subject: `Kontakt forma — ${name}`,
      message: `Ime: ${name}\nEmail: ${email}\n\n${message}`,
      status: 'open',
    });

    if (error) {
      console.error('Contact insert error:', error);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    if (process.env.RESEND_API_KEY) {
      // 1. Notify admin
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GigZone Support <support@gigzone.app>',
          to: [process.env.ADMIN_EMAIL || 'gigzoneapp@gmail.com'],
          reply_to: email,
          subject: `Nova poruka od ${name}`,
          html: `
            <h2>Nova kontakt poruka</h2>
            <p><strong>Ime:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <hr />
            <p>${message.replace(/\n/g, '<br/>')}</p>
            <hr />
            <p style="color:#888;font-size:12px">GigZone Support — support@gigzone.app</p>
          `,
        }),
      });

      // 2. Send confirmation to the user on the email they entered in the form
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GigZone Support <support@gigzone.app>',
          to: [email],
          reply_to: 'support@gigzone.app',
          subject: 'Primili smo vašu poruku — GigZone',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#ea580c">Hvala, ${name}!</h2>
              <p>Primili smo vašu poruku i odgovorićemo vam u najkraćem roku.</p>
              <div style="background:#f9f9f9;border-left:4px solid #ea580c;padding:12px 16px;margin:16px 0;border-radius:4px">
                <p style="margin:0;color:#555">${message.replace(/\n/g, '<br/>')}</p>
              </div>
              <p>Ako imate dodatnih pitanja, možete nas kontaktirati na <a href="mailto:support@gigzone.app">support@gigzone.app</a>.</p>
              <p style="color:#888;font-size:12px;margin-top:24px">GigZone — gigzone.app</p>
            </div>
          `,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
