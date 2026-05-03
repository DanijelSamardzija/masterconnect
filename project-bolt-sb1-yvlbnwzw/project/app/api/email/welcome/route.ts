import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, account_type')
      .eq('id', userId)
      .single();

    if (!profile?.email) return NextResponse.json({ ok: true });

    const firstName = profile.name?.split(' ')[0] || profile.name || 'tu';
    const isPro = profile.account_type === 'professional';

    const ctaText = isPro ? 'Objavi prvi oglas' : 'Istraži GigZone';
    const ctaUrl = isPro ? 'https://gigzone.app/create-post' : 'https://gigzone.app/feed';
    const bulletPoints = isPro
      ? `<li>Objavi <strong>uslugu</strong> koju nudiš i privuci klijente</li>
         <li>Objavi <strong>oglas za posao</strong> ako tražiš radnika</li>
         <li>Predstavi se u <strong>feedu</strong> — šta radiš, kako radiš</li>`
      : `<li>Pronađi <strong>majstora ili uslugu</strong> koja ti treba</li>
         <li>Objavi šta ti treba i <strong>čekaj ponude</strong></li>
         <li>Potraži <strong>posao</strong> ili oglasi radno mesto</li>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GigZone <hello@gigzone.app>',
        to: [profile.email],
        reply_to: 'gigzoneapp@gmail.com',
        subject: `Dobrodošao na GigZone, ${firstName}!`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <div style="text-align:center;padding:32px 0 16px">
              <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
                Gig<span style="color:#ea580c">Zone</span>
              </span>
            </div>

            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
              <h2 style="margin:0 0 8px;font-size:22px">Zdravo, ${firstName}! 👋</h2>
              <p style="color:#555;margin:0 0 20px">Dobrodošao na GigZone — platformu koja spaja profesionalce i klijente.</p>

              <ul style="color:#333;margin:0 0 24px;padding-left:20px;line-height:2">
                ${bulletPoints}
              </ul>

              <div style="text-align:center;margin:28px 0">
                <a href="${ctaUrl}"
                   style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block">
                  ${ctaText}
                </a>
              </div>

              <p style="color:#888;font-size:13px;margin:24px 0 0">
                Ako imaš pitanja, samo odgovori na ovaj mejl.<br/>
                <strong>GigZone tim</strong>
              </p>
            </div>

            <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
              GigZone · gigzone.app
            </p>
          </div>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ ok: true });
  }
}
