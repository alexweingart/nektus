import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { SessionProvider } from "./providers/SessionProvider";
import { ProfileProvider } from "./context/ProfileContext";
import AdminModeProvider from './providers/AdminModeProvider';
import AdminBanner from './components/ui/AdminBanner';
import { LayoutBackground } from './components/layout/LayoutBackground';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Theme color for PWA and root background
const THEME_COLOR = '#000000';

export const metadata: Metadata = {
  title: "Nekt.Us - Bump to Connect",
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
  const session = await getServerSession(authOptions);
  
  const backgroundImageUrl = session?.user?.backgroundImage;

  return (
      <html
        lang="en"
        className="bg-black"
        style={{
          backgroundColor: '#000'
        }}
      >
      <head>
        {/* Preload the user background image to avoid initial flash */}
        {backgroundImageUrl && (
          <link rel="preload" href={backgroundImageUrl} as="image" />
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=overlays-content, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" sizes="192x192" type="image/png" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <SessionProvider session={session}>
          <ProfileProvider>
            <AdminModeProvider>
              <LayoutBackground />
              <AdminBanner />
              {children}
            </AdminModeProvider>
          </ProfileProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
