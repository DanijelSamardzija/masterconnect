import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Lang = 'sr' | 'en' | 'de';

function buildHtml(title: string, body: string, lang: Lang): string {
  const footer =
    lang === 'de' ? 'Bei Fragen antworte einfach auf diese E-Mail. — Das GigZone-Team'
    : lang === 'en' ? 'If you have questions, just reply to this email. — The GigZone Team'
    : 'Ako imaš pitanja, samo odgovori na ovaj mejl. — GigZone tim';

  const bodyHtml = body.replace(/\n/g, '<br/>');

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <div style="text-align:center;padding:32px 0 16px">
        <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
          Gig<span style="color:#ea580c">Zone</span>
        </span>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
        <h2 style="margin:0 0 16px;font-size:20px">${title}</h2>
        <p style="color:#444;line-height:1.7;margin:0 0 28px">${bodyHtml}</p>
        <div style="text-align:center;margin:28px 0">
          <a href="https://gigzone.app/feed"
             style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block">
            GigZone
          </a>
        </div>
        <p style="color:#888;font-size:13px;margin:24px 0 0">${footer}</p>
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
        GigZone · gigzone.app
      </p>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title_sr, body_sr, title_en, body_en, title_de, body_de } = body;

    if (!title_sr || !body_sr) {
      return NextResponse.json({ error: 'Missing Serbian content' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: users } = await supabase
      .from('profiles')
      .select('email, preferred_language')
      .not('email', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Build batches per language (max 100 per Resend batch)
    const emails = users
      .filter((u: any) => !!u.email)
      .map((u: any) => {
        const lang: Lang = (u.preferred_language as Lang) || 'sr';
        const t =
          (lang === 'de' && title_de) ? title_de :
          (lang === 'en' && title_en) ? title_en :
          (lang === 'sr') ? title_sr :
          title_en || title_sr;
        const b =
          (lang === 'de' && body_de) ? body_de :
          (lang === 'en' && body_en) ? body_en :
          (lang === 'sr') ? body_sr :
          body_en || body_sr;
        const effectiveLang: Lang = lang === 'de' && title_de ? 'de' : lang === 'en' && title_en ? 'en' : title_en ? 'en' : 'sr';
        return {
          from: 'GigZone <hello@gigzone.app>',
          to: [u.email],
          reply_to: 'gigzoneapp@gmail.com',
          subject: t,
          html: buildHtml(t, b, effectiveLang),
        };
      });

    // Send in batches of 100 (Resend limit)
    let sent = 0;
    for (let i = 0; i < emails.length; i += 100) {
      const batch = emails.slice(i, i + 100);
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (res.ok) {
        sent += batch.length;
      } else {
        const err = await res.text();
        console.error('Resend batch error:', err);
      }
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error('Announcement email error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
