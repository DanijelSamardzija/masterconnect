import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

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

    if (process.env.BREVO_API_KEY) {
      // 1. Notify admin
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'support@gigzone.app',
        replyTo: email,
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
        from: { name: 'GigZone Support', email: 'support@gigzone.app' },
      });

      // 2. Send confirmation to the user — detect language by email domain
      const emailDomain = email.split('@')[1]?.toLowerCase() || '';
      const isDE = emailDomain.endsWith('.de') || emailDomain.endsWith('.at') || emailDomain.endsWith('.ch');
      const isEN = !isDE && !emailDomain.endsWith('.rs') && !emailDomain.endsWith('.ba') && !emailDomain.endsWith('.hr') && !emailDomain.endsWith('.me');

      const confirmSubject = isDE
        ? 'Ihre Nachricht wurde empfangen — GigZone'
        : isEN
        ? 'We received your message — GigZone'
        : 'Primili smo vašu poruku — GigZone';

      const confirmBody = isDE ? `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Danke, ${name}!</h2>
          <p>Wir haben Ihre Nachricht erhalten und werden uns so bald wie möglich bei Ihnen melden.</p>
          <div style="background:#f9f9f9;border-left:4px solid #ea580c;padding:12px 16px;margin:16px 0;border-radius:4px">
            <p style="margin:0;color:#555">${message.replace(/\n/g, '<br/>')}</p>
          </div>
          <p>Bei weiteren Fragen erreichen Sie uns unter <a href="mailto:support@gigzone.app">support@gigzone.app</a>.</p>
          <p style="color:#888;font-size:12px;margin-top:24px">GigZone — gigzone.app</p>
        </div>
      ` : isEN ? `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Thank you, ${name}!</h2>
          <p>We have received your message and will get back to you as soon as possible.</p>
          <div style="background:#f9f9f9;border-left:4px solid #ea580c;padding:12px 16px;margin:16px 0;border-radius:4px">
            <p style="margin:0;color:#555">${message.replace(/\n/g, '<br/>')}</p>
          </div>
          <p>If you have any further questions, you can reach us at <a href="mailto:support@gigzone.app">support@gigzone.app</a>.</p>
          <p style="color:#888;font-size:12px;margin-top:24px">GigZone — gigzone.app</p>
        </div>
      ` : `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Hvala, ${name}!</h2>
          <p>Primili smo vašu poruku i odgovorićemo vam u najkraćem roku.</p>
          <div style="background:#f9f9f9;border-left:4px solid #ea580c;padding:12px 16px;margin:16px 0;border-radius:4px">
            <p style="margin:0;color:#555">${message.replace(/\n/g, '<br/>')}</p>
          </div>
          <p>Ako imate dodatnih pitanja, možete nas kontaktirati na <a href="mailto:support@gigzone.app">support@gigzone.app</a>.</p>
          <p style="color:#888;font-size:12px;margin-top:24px">GigZone — gigzone.app</p>
        </div>
      `;

      await sendEmail({
        to: email,
        replyTo: 'support@gigzone.app',
        subject: confirmSubject,
        html: confirmBody,
        from: { name: 'GigZone Support', email: 'support@gigzone.app' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
