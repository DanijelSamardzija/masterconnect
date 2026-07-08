import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find users inactive for 30+ days who haven't received a reengagement email
  // in the last 60 days (to avoid resending too often)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inactiveUsers, error } = await supabase
    .from('profiles')
    .select('id, name, email, last_seen, reengagement_sent_at')
    .not('email', 'is', null)
    .lt('last_seen', thirtyDaysAgo)
    .or(`reengagement_sent_at.is.null,reengagement_sent_at.lt.${sixtyDaysAgo}`)
    .limit(100);

  if (error) {
    console.error('Reengagement query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!inactiveUsers || inactiveUsers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const user of inactiveUsers) {
    if (!user.email) continue;

    const firstName = user.name?.split(' ')[0] || user.name || 'prijatelju';

    const ok = await sendEmail({
      to: user.email,
      replyTo: 'support@gigzone.app',
      subject: `${firstName}, ima novih objava na GigZone 👀`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <div style="text-align:center;padding:32px 0 16px">
            <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
              Gig<span style="color:#ea580c">Zone</span>
            </span>
          </div>

          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
            <h2 style="margin:0 0 12px;font-size:20px">Zdravo, ${firstName}! 👋</h2>
            <p style="color:#555;margin:0 0 20px;line-height:1.6">
              Nisi nas posjetio/la već neko vrijeme — a dosta se toga promijenilo na GigZone.
              Novi profesionalci, nova radna mjesta i novi sadržaj čekaju te u feedu.
            </p>

            <ul style="color:#333;margin:0 0 24px;padding-left:20px;line-height:2">
              <li>📱 <strong>Feed</strong> — Pogledaj šta su objavili profesionalci koje pratiš</li>
              <li>🔍 <strong>Usluge</strong> — Pronađi majstore, fotografe, programere i još mnogo toga</li>
              <li>💼 <strong>Poslovi</strong> — Novi oglasi svaki dan</li>
            </ul>

            <div style="text-align:center;margin:28px 0">
              <a href="https://gigzone.app/feed"
                 style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block">
                Vrati se na GigZone
              </a>
            </div>

            <p style="color:#888;font-size:13px;margin:24px 0 0">
              Vidimo se uskoro!<br/>
              <strong>GigZone tim</strong>
            </p>
          </div>

          <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
            GigZone · gigzone.app
          </p>
        </div>
      `,
    }).catch(() => false);

    if (ok) {
      sent++;
      await supabase
        .from('profiles')
        .update({ reengagement_sent_at: new Date().toISOString() })
        .eq('id', user.id);
    } else {
      failed++;
    }
  }

  console.log(`Reengagement emails: ${sent} sent, ${failed} failed`);
  return NextResponse.json({ ok: true, sent, failed });
}
