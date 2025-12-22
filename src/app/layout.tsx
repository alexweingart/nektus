import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "./providers/SessionProvider";
import { ProfileProvider } from "./context/ProfileContext";
import AdminModeProvider from './providers/AdminModeProvider';
import AdminBanner from './components/ui/banners/AdminBanner';
import { LayoutBackground } from './components/ui/layout/LayoutBackground';
import { ParticleNetwork } from './components/ui/layout/ParticleNetwork';
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
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "Nekt - Bump to Connect",
  description: "Exchange contact info and social profiles by bumping phones",
  manifest: "/manifest.json",
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
        <meta name="description" content="Exchange contact info and social profiles by bumping phones" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <SessionProvider>
          <ProfileProvider>
            <AdminModeProvider>
              <HeightDebugger />
              <LayoutBackground />
              <ParticleNetwork />
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
