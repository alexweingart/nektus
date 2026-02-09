import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./animations.css";
import { SessionProvider } from "./providers/SessionProvider";
import { ProfileProvider } from "./context/ProfileContext";
import AdminModeProvider from './providers/AdminModeProvider';
import AdminBanner from './components/ui/banners/AdminBanner';
import { LayoutBackground } from './components/ui/layout/LayoutBackground';
import { HeightDebugger } from './components/debug/HeightDebugger';
import { ScrollBehavior } from './components/ui/layout/ScrollBehavior';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Theme color for PWA - transparent to let gradient show through
const THEME_COLOR = 'transparent';

export const metadata: Metadata = {
  title: "Nekt - Turn conversations into friendships",
  description: "Exchange contacts & socials and schedule meetings in seconds",
  manifest: "/manifest.json",
  metadataBase: new URL('https://nekt.us'),
  alternates: {
    canonical: 'https://nekt.us',
  },
  openGraph: {
    title: 'Nekt - Turn conversations into friendships',
    description: 'Exchange contacts & socials and schedule meetings in seconds',
    url: 'https://nekt.us',
    siteName: 'Nekt',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Nekt - Turn conversations into friendships',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nekt - Turn conversations into friendships',
    description: 'Exchange contacts & socials and schedule meetings in seconds',
    images: ['/og-image.png'],
  },
  icons: {
    apple: [
      { url: '/pwa/nektus-logo-pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa/nektus-logo-pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Nekt',
    statusBarStyle: 'black-translucent',
    startupImage: '/pwa/nektus-logo-pwa-192x192.png',
  },
  other: {
    'msapplication-TileColor': THEME_COLOR,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html
        lang="en"
        data-scroll-behavior="smooth"
      >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="rgb(10, 15, 26)" />
        {/* Smart App Banner for App Clip */}
        <meta name="apple-itunes-app" content="app-clip-bundle-id=com.nektus.app.Clip, app-clip-display=card" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/pwa/nektus-logo-pwa-192x192.png" sizes="192x192" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" sizes="16x16 32x32" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <SessionProvider>
          <ProfileProvider>
            <AdminModeProvider>
              <ScrollBehavior />
              <HeightDebugger />
              {/* V2: LayoutBackground wraps children - no wrapper div needed */}
              <LayoutBackground>
                <AdminBanner />
                {children}
              </LayoutBackground>
            </AdminModeProvider>
          </ProfileProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
