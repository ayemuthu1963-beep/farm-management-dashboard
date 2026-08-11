import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import '@fontsource/merriweather/latin-700.css'
import '@fontsource/merriweather/latin-900.css'
import { LocalEnvironmentBanner } from '@/components/farm/local-environment-banner'
import { PageTitleSync } from '@/components/farm/page-title-sync'
import './globals.css'

export const metadata: Metadata = {
  title: 'MFMS-Dashboard',
  description: 'Muthu Farms Management System',
  icons: {
    icon: '/muthu-farms-logo.png',
    shortcut: '/muthu-farms-logo.png',
    apple: '/muthu-farms-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        <PageTitleSync />
        <LocalEnvironmentBanner />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
