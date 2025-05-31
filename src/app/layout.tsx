import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { authOptions } from "./api/auth/[...nextauth]/options";
import { getAuthSession } from "@/lib/auth";
import { SessionProvider } from "./providers/SessionProvider";
import { ProfileProvider } from "./context/ProfileContext";
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
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nekt.Us',
    startupImage: '/icons/icon-192x192.png',
  },
  other: {
    'msapplication-TileColor': '#4CAF50',
    'theme-color': '#4CAF50',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=overlays-content" />
        <meta name="theme-color" content="#f4f9f4" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${inter.variable} antialiased bg-background`}
        style={{ backgroundColor: 'var(--background, #f4f9f4)' }}
      >
        <SessionProvider session={session}>
          <ProfileProvider>
            <AdminModeProvider>
              <ClientComponents />
              {children}
            </AdminModeProvider>
          </ProfileProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
