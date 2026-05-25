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
      </body>
    </html>
  )
}
