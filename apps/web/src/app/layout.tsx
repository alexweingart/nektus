import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./animations.css";
import { SessionProvider } from "./providers/SessionProvider";
import { ProfileProvider } from "./context/ProfileContext";
import AdminModeProvider from './providers/AdminModeProvider';
import AdminBanner from './components/ui/banners/AdminBanner';
import { LayoutBackground } from './components/ui/layout/LayoutBackground';
import { HeightDebugger } from './components/debug/HeightDebugger';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Theme color for PWA and root background
const THEME_COLOR = '#000000';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

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
    'theme-color': THEME_COLOR,
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/favicon.png" sizes="192x192" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" sizes="16x16 32x32" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <SessionProvider>
          <ProfileProvider>
            <AdminModeProvider>
              <HeightDebugger />
              <LayoutBackground />
              {/* ParticleNetwork is rendered inside LayoutBackground with proper context-aware props */}
              <AdminBanner />
              <div style={{ position: 'relative', zIndex: 10 }}>
                {children}
              </div>
            </AdminModeProvider>
          </ProfileProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
