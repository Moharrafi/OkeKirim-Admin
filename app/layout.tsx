import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { MobileNav } from '@/components/mobile-nav'
import { OfflineIndicator } from '@/components/offline-indicator'
import { DebtReminder } from '@/components/debt-reminder'
import { Toaster } from '@/components/ui/sonner'
import { AndroidBackHandler } from '@/components/android-back-handler'
import { ThemeProvider } from '@/lib/theme-context'
import { UserProvider } from '@/lib/user-context'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: 'OkeMitra - Manajemen Setoran Driver',
  description: 'Aplikasi mobile untuk mengelola setoran driver dengan fitur deposit, lokasi kendaraan, dan riwayat pembayaran.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OkeMitra',
  },
  other: {
    // Apple touch icons for all iOS device sizes
    'apple-touch-icon': '/logo.png',
    'apple-touch-icon-precomposed': '/logo.png',
    // iOS standalone mode splash meta
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className="bg-background" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Apple touch icons – all sizes iOS uses */}
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png" />
        {/* iOS status bar */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="OkeMitra" />
        {/* Android / Chrome */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <UserProvider>
            <OfflineIndicator />
            <AndroidBackHandler />
            <DebtReminder />
            {children}
            <MobileNav />
            <Toaster />
          </UserProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
        {/* Service Worker registration for PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('SW registered:', reg.scope); })
                    .catch(function(err) { console.log('SW error:', err); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
