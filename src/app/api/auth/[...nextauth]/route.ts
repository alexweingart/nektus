import NextAuth from "next-auth";
import { authOptions } from "./options.js";

// Logging for better debugging
console.log('AUTH CONFIG ENVIRONMENT:');
console.log('- NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('- Has GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID);
console.log('- Has GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET);

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
