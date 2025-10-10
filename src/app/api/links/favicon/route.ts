/**
 * Favicon Extraction API Route
 * Fetches favicon for custom links using Google's favicon service
 * Part of Phase 5: Links
 */

import { NextRequest, NextResponse } from 'next/server';

export interface FaviconRequest {
  url: string;
}

export interface FaviconResponse {
  success: boolean;
  faviconUrl?: string;
  domain?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FaviconRequest = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate and parse URL
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Extract domain
    const domain = urlObj.hostname;

    // Use Google's favicon service (size 64x64)
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    return NextResponse.json({
      success: true,
      faviconUrl,
      domain
    });
  } catch (error) {
    console.error('[Favicon API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process favicon request' },
      { status: 500 }
    );
  }
}
