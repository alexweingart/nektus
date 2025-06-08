import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getAuthSession } from "@/lib/auth";
import { SessionProvider } from "./providers/SessionProvider";
import { ProfileProvider } from "./context/ProfileContext";
import AdminModeProvider from './providers/AdminModeProvider';
import ClientComponents from './providers/ClientComponents';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Theme color constant to match CSS variable --background
const THEME_COLOR = '#004D40';

export const metadata: Metadata = {
  title: "Nekt.Us - Connect with a Bump",
  description: "Exchange contact info and social profiles by bumping phones",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa/nektus-logo-pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa/nektus-logo-pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/pwa/nektus-logo-pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa/nektus-logo-pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Nekt.Us',
    statusBarStyle: 'black-translucent',
    startupImage: '/pwa/nektus-logo-pwa-192x192.png',
  },
  other: {
    'msapplication-TileColor': THEME_COLOR,
    'theme-color': THEME_COLOR,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=overlays-content" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" sizes="192x192" type="image/png" />
      </head>
      <body className={`${inter.variable} antialiased bg-background`}>
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
