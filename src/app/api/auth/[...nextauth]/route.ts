import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Simplest possible configuration - only what's absolutely necessary
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  secret: "nektus-app-contact-exchange-secret-key",
  pages: {
    signIn: '/setup',
    error: '/setup',
  },
});

// Export the API route handlers
export { handler as GET, handler as POST };
