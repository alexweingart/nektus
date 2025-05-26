import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  try {
    // Get the user's session token to extract their access token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token || !token.accessToken) {
      return NextResponse.json(
        { error: "No valid session found" },
        { status: 401 }
      );
    }

    // Google's token revocation endpoint
    const revokeEndpoint = "https://oauth2.googleapis.com/revoke";
    
    // Prepare the form data for token revocation
    const formData = new URLSearchParams();
    formData.append('token', token.accessToken);
    formData.append('token_type_hint', 'access_token');
    
    console.log('Attempting to revoke token with endpoint:', revokeEndpoint);
    
    // Make the request to Google to revoke the token
    const response = await fetch(revokeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData
    });
    
    console.log('Token revocation response status:', response.status);

    if (response.ok) {
      return NextResponse.json({ success: true });
    } else {
      const errorData = await response.json();
      console.error("Token revocation failed:", errorData);
      return NextResponse.json(
        { error: "Failed to revoke token with Google" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error revoking token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
