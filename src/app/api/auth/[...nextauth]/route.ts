import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Get the origin for redirect URLs
const origin = process.env.NEXTAUTH_URL || (process.env.NODE_ENV === "production" ? "https://nekt.us" : "http://localhost:3002");

// Logs for debugging
console.log('NextAuth Origin:', origin);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

// Configure NextAuth handler
const handler = NextAuth({
  debug: true, // Enable debug logs for both development and production
  
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      // Force exact callback URLs that match Google Console configuration
      checks: ['pkce', 'state']
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    // Add a redirect callback to properly handle redirects
    async redirect({ url, baseUrl }) {
      console.log('Redirect called with URL:', url);
      console.log('Base URL:', baseUrl);
      
      // Handle relative URLs (convert to absolute)
      if (url.startsWith('/')) {
        const redirectUrl = `${baseUrl}${url}`;
        console.log('Converted to:', redirectUrl);
        return redirectUrl;
      }
      
      // Allow redirects to the same site
      if (url.startsWith(baseUrl)) {
        console.log('Same site redirect:', url);
        return url;
      }
      
      // Default to setup page
      console.log('Defaulting to setup page');
      return `${baseUrl}/setup`;
    }
  },
  pages: {
    signIn: '/setup', // Custom sign-in page
    error: '/setup', // Show errors on the setup page
  }
});

// Export the API route handlers
export { handler as GET, handler as POST };
