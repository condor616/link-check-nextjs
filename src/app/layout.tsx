import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import { PageTransition } from "@/components/PageTransition";
import { NotificationProvider } from "@/components/NotificationContext";
import { TopNav } from "@/components/TopNav";
import { MobileNav } from "@/components/MobileNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import BootstrapClient from "@/components/BootstrapClient";
import { getAppUrl } from "@/lib/settings";
import { Footer } from "@/components/Footer";
import SetupWrapper from "@/components/SetupWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getAppUrl();
  return {
    title: {
      default: "Link Checker Pro | Professional Broken Link Scanner",
      template: "%s | Link Checker Pro",
    },
    description: "Advanced website link analysis tool. Scan for broken links, identify 404 errors, and improve your site's SEO and user experience in minutes.",
    keywords: ["broken link checker", "404 error scanner", "website audit tool", "SEO optimization", "link health monitor", "dead link finder"],
    authors: [{ name: "Link Checker Pro Team" }],
    creator: "Link Checker Pro",
    publisher: "Link Checker Pro",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    icons: {
      icon: "/icon.svg",
      apple: "/icon.svg",
    },
    manifest: "/manifest.json",
    openGraph: {
      type: "website",
      locale: "en_US",
      url: baseUrl,
      siteName: "Link Checker Pro",
      title: "Link Checker Pro | Professional Broken Link Scanner",
      description: "Hunt down 404s like they owe us money. Keeping your site's reputation alive, one link at a time.",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Link Checker Pro - Professional Broken Link Scanner",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Link Checker Pro | Professional Broken Link Scanner",
      description: "Advanced website link analysis tool. Scan for broken links and improve your site's SEO.",
      images: ["/og-image.png"],
      creator: "@linkcheckerpro",
    },
    metadataBase: new URL(baseUrl),
  };
}


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
            <SetupWrapper>
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
            </SetupWrapper>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
