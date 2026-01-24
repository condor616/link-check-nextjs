import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import { PageTransition } from "@/components/PageTransition";
import { NotificationProvider } from "@/components/NotificationContext";
import { Toaster } from "@/components/ui/sonner";
import { TopNav } from "@/components/TopNav";
import { MobileNav } from "@/components/MobileNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import BootstrapClient from "@/components/BootstrapClient";

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
        className={`antialiased ${geistSans.variable} ${geistMono.variable} min-vh-100 vh-100 d-flex flex-column overflow-hidden`}
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
            <div className="d-flex flex-column vh-100 overflow-hidden">
              {/* Desktop Top Navigation */}
              <TopNav />

              {/* Mobile Header & Nav */}
              <MobileNav />

              {/* Main Content Area */}
              <div className="flex-grow-1 d-flex flex-column overflow-hidden position-relative main-content-wrapper">
                {/* Page Content */}
                <main className="flex-grow-1 overflow-auto p-3 p-md-4 scroll-smooth">
                  <div className="container-fluid px-4 px-md-5 py-4 pb-5 pb-md-0">
                    <PageTransition>
                      {children}
                    </PageTransition>
                  </div>
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
