import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Defer — not needed for first paint
});

export const metadata: Metadata = {
  metadataBase: new URL("https://idolmeta.fun"),
  title: "TARKAM — Fan Made Edition",
  description: "Komunitas Idol Meta Indonesia, turnamen tarkam mingguan cowo dan cewe, yuk ramaikan dan gabung sekarang!",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo1.webp",
    apple: "/logo1.webp",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },

  // ── Open Graph (defaults — page.tsx generateMetadata overrides these) ──
  openGraph: {
    title: "TARKAM — Fan Made Edition",
    description: "Komunitas Idol Meta Indonesia, turnamen tarkam mingguan cowo dan cewe, yuk ramaikan dan gabung sekarang!",
    url: "https://idolmeta.fun",
    siteName: "TARKAM IDM",
    locale: "id_ID",
    type: "website",
  },

  // ── Twitter Card (defaults — page.tsx generateMetadata overrides these) ──
  twitter: {
    card: "summary_large_image",
  },

  keywords: ["TARKAM", "IDM", "Idol Meta", "Fan Made", "turnamen", "tarkam", "cowo", "cewe", "komunitas", "mingguan"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#080a14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />

        {/* PWA: Register service worker (async to avoid render-blocking) */}
        <script
          async
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
