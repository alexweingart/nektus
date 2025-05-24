import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { SessionProvider } from "./providers/SessionProvider";
import { ProfileProvider } from "./context/ProfileContext";
import dynamic from 'next/dynamic';

import AdminModeProvider from './providers/AdminModeProvider';
import ClientComponents from './providers/ClientComponents';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Nekt.Us - Connect with a Bump",
  description: "Exchange contact info and social profiles by bumping phones",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ff0000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        <SessionProvider>
          <UserProvider>
            <ProfileProvider>
              <AdminModeProvider>
                <ClientComponents />
                {children}
              </AdminModeProvider>
            </ProfileProvider>
          </UserProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
