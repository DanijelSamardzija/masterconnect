import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { messageId, replyText, toEmail, toName, subject } = await request.json();

    if (!messageId || !replyText || !toEmail) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Send email via Brevo
    if (process.env.BREVO_API_KEY) {
      const ok = await sendEmail({
        to: toEmail,
        replyTo: 'support@gigzone.app',
        subject: `Re: ${subject}`,
        html: `
          <p>Zdravo ${toName},</p>
          <p>${replyText.replace(/\n/g, '<br/>')}</p>
          <hr />
          <p style="color:#888;font-size:12px">GigZone Support — support@gigzone.app</p>
        `,
        from: { name: 'GigZone Support', email: 'support@gigzone.app' },
      });

      if (!ok) {
        console.error('Brevo: failed to send support reply to', toEmail);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
      }
    }

    // Update status to in_progress + save admin note
    await supabase
      .from('support_messages')
      .update({
        status: 'in_progress',
        admin_notes: replyText,
      })
      .eq('id', messageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Support reply error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
