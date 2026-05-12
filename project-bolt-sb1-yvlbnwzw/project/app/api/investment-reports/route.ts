import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Investment reporting is coming soon.' },
    { status: 403 }
  );
}
