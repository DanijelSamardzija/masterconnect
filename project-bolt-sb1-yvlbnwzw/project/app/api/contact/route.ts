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

    // Send email notification via Resend API
    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GigZone Support <support@gigzone.app>',
          to: ['support@gigzone.app'],
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
