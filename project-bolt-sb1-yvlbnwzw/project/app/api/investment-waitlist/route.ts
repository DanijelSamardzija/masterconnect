import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VALID_ROLES = ['investor', 'business_owner', 'startup_founder', 'service_business'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { name, email, role } = await request.json();

    if (!name?.trim() || !email?.trim() || !role) {
      return NextResponse.json({ error: 'required' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('investment_waitlist')
      .insert({ name: name.trim(), email: email.trim().toLowerCase(), role });

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'duplicate' }, { status: 409 });
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
