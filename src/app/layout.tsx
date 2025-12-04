import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PageTransition } from "@/components/PageTransition";
import { NotificationProvider } from "@/components/NotificationContext";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ThemeProvider } from "@/components/ThemeProvider";

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
        className={`antialiased ${geistSans.variable} ${geistMono.variable} font-sans bg-background text-foreground min-h-screen selection:bg-primary/30 selection:text-primary-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NotificationProvider>
            <div className="flex h-screen overflow-hidden">
              {/* Desktop Sidebar */}
              <Sidebar />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Mobile Header & Nav */}
                <MobileNav />

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth">
                  <div className="max-w-7xl mx-auto w-full min-h-full">
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
