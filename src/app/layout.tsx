import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import { PageTransition } from "@/components/PageTransition";
import { NotificationProvider } from "@/components/NotificationContext";
import { Toaster } from "@/components/ui/sonner";
import { TopNav } from "@/components/TopNav";
import { MobileNav } from "@/components/MobileNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import BootstrapClient from "@/components/BootstrapClient";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Link Checker Pro",
  description: "Scan websites for broken links",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Hotfix: Remove invalid localStorage polyfill that causes SSR errors
  if (typeof global !== 'undefined') {
    try {
      delete (global as any).localStorage;
    } catch (e) {
      // Ignore
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased ${geistSans.variable} ${geistMono.variable} min-vh-100 d-flex flex-column`}
        suppressHydrationWarning
      >
        <BootstrapClient />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NotificationProvider>
            {/* App Shell Wrapper - Natural Flow */}
            <div className="d-flex flex-column flex-grow-1 w-100">
              {/* Desktop Top Navigation (Sticky) */}
              <div className="sticky-top z-3">
                <TopNav />
              </div>

              {/* Mobile Header & Nav (Sticky) */}
              <div className="sticky-top z-3 d-lg-none">
                <MobileNav />
              </div>

              {/* Main Content Area */}
              <div className="flex-grow-1 d-flex flex-column main-content-wrapper">
                {/* Page Content */}
                <main className="flex-grow-1 d-flex flex-column">
                  <div className="container-fluid px-4 px-md-5 py-4 pb-5 pb-md-0 flex-grow-1">
                    <PageTransition>
                      {children}
                    </PageTransition>
                  </div>
                  <Footer />
                </main>
              </div>
            </div>
            <Toaster />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
