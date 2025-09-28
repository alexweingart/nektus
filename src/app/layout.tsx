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
    apple: [
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

  return (
      <html
        lang="en"
        className="bg-black"
        style={{
          backgroundColor: '#000'
        }}
      >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=overlays-content, viewport-fit=cover" />
        <meta name="description" content="Exchange contact info and social profiles by bumping phones" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Favicon debugging
            (function() {
              console.log('🔍 Favicon Debug: Initial load');

              // Monitor favicon changes
              const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                  if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                      if (node.nodeType === 1 && node.tagName === 'LINK' &&
                          (node.rel === 'icon' || node.rel === 'shortcut icon')) {
                        console.log('🔍 Favicon Debug: New favicon added:', node.href);
                      }
                    });
                    mutation.removedNodes.forEach(function(node) {
                      if (node.nodeType === 1 && node.tagName === 'LINK' &&
                          (node.rel === 'icon' || node.rel === 'shortcut icon')) {
                        console.log('🔍 Favicon Debug: Favicon removed:', node.href);
                      }
                    });
                  }
                  if (mutation.type === 'attributes' && mutation.target.tagName === 'LINK' &&
                      (mutation.target.rel === 'icon' || mutation.target.rel === 'shortcut icon')) {
                    console.log('🔍 Favicon Debug: Favicon modified:', mutation.target.href);
                  }
                });
              });

              observer.observe(document.head, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['href']
              });

              // Log current favicons
              document.addEventListener('DOMContentLoaded', function() {
                const favicons = document.querySelectorAll('link[rel*="icon"]');
                console.log('🔍 Favicon Debug: Current favicons:', Array.from(favicons).map(f => f.href));
              });

              // Force favicon refresh function
              function forceFaviconRefresh() {
                console.log('🔄 Forcing favicon refresh...');

                // Remove all existing favicon links (except apple-touch-icon)
                const existingFavicons = document.querySelectorAll('link[rel*="icon"]:not([rel*="apple"])');
                existingFavicons.forEach(link => link.remove());

                const timestamp = Date.now();

                // Add multiple favicon formats with cache-busting
                const favicons = [
                  { rel: 'icon', type: 'image/png', href: '/favicon.png?t=' + timestamp },
                  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?t=' + timestamp },
                  { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico?t=' + timestamp }
                ];

                favicons.forEach(favicon => {
                  const link = document.createElement('link');
                  link.rel = favicon.rel;
                  link.type = favicon.type;
                  link.href = favicon.href;
                  document.head.appendChild(link);
                });

                console.log('🔄 Favicon refreshed with PNG:', '/favicon.png?t=' + timestamp);
              }

              // Monitor page visibility changes (OAuth redirects)
              document.addEventListener('visibilitychange', function() {
                console.log('🔍 Favicon Debug: Page visibility changed:', document.visibilityState);

                if (document.visibilityState === 'visible') {
                  // Force refresh when page becomes visible again (after OAuth redirect)
                  setTimeout(forceFaviconRefresh, 500);
                }

                const favicons = document.querySelectorAll('link[rel*="icon"]');
                console.log('🔍 Favicon Debug: Favicons after visibility change:', Array.from(favicons).map(f => f.href));
              });

              // Immediate favicon refresh on load
              forceFaviconRefresh();

              // Also refresh favicon after page load
              document.addEventListener('DOMContentLoaded', function() {
                setTimeout(forceFaviconRefresh, 100);
                setTimeout(forceFaviconRefresh, 1000);
              });
            })();
          `
        }} />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <SessionProvider session={session}>
          <ProfileProvider>
            <AdminModeProvider>
              <LayoutBackground />
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
