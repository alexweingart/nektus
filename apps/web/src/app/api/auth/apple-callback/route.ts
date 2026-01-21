import { NextRequest, NextResponse } from "next/server";

/**
 * Apple Sign-In callback endpoint
 *
 * When using usePopup: true in the Apple JS SDK, this endpoint isn't actually
 * used for the main flow - the SDK handles everything client-side via JavaScript.
 *
 * However, this endpoint serves as:
 * 1. A valid registered URL for Apple's validation
 * 2. A fallback in case the popup fails and Apple redirects instead
 */
export async function GET(request: NextRequest) {
  // Redirect to home page with any params (in case of fallback redirect)
  const searchParams = request.nextUrl.searchParams;
  const error = searchParams.get("error");

  if (error) {
    console.error("[Apple Callback] Error received:", error);
    return NextResponse.redirect(new URL("/?appleError=" + error, request.url));
  }

  // Successful callback - redirect to home
  return NextResponse.redirect(new URL("/", request.url));
}

export async function POST(request: NextRequest) {
  // Apple may POST form data in some scenarios
  try {
    const formData = await request.formData();
    const idToken = formData.get("id_token");
    const error = formData.get("error");

    if (error) {
      console.error("[Apple Callback] POST error:", error);
      return NextResponse.redirect(
        new URL("/?appleError=" + error, request.url)
      );
    }

    // If we receive credentials via POST, redirect with them as URL params
    // The client-side code will need to handle this
    if (idToken) {
      console.log("[Apple Callback] Received POST callback with id_token");
      // In popup mode, this shouldn't happen, but log for debugging
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.redirect(new URL("/", request.url));
  } catch (e) {
    console.error("[Apple Callback] Error processing POST:", e);
    return NextResponse.redirect(new URL("/?appleError=callback_error", request.url));
  }
}
