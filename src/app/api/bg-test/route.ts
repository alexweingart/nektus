import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'GET works' });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'POST works', timestamp: new Date().toISOString() });
}
