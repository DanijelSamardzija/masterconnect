import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Saving investment projects is coming soon.' },
    { status: 403 }
  );
}
