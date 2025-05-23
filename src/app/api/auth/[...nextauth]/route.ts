import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Get the origin for redirect URLs
const origin = process.env.NEXTAUTH_URL || (process.env.NODE_ENV === "production" ? "https://nekt.us" : "http://localhost:3002");

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
      }
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
      // Allow redirects to the same site
      if (url.startsWith(baseUrl) || url.startsWith('/')) {
        return url;
      }
      // Default to homepage
      return baseUrl;
    }
  },
  pages: {
    signIn: '/setup', // Custom sign-in page
    error: '/setup', // Show errors on the setup page
  }
});

// Export the API route handlers
export { handler as GET, handler as POST };
