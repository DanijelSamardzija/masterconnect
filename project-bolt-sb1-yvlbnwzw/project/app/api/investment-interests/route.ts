import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Investment features are coming soon. You will soon be able to express interest in projects.' },
    { status: 403 }
  );
}
