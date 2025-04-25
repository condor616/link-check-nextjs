import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from 'next/link';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Link Checker Pro",
  description: "Scan websites for broken links",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        <header className="border-b mb-4">
          <nav className="container mx-auto flex justify-between items-center p-4">
            <Link href="/" className="text-xl font-bold">Link Checker Pro</Link>
            <div className="space-x-4">
              <Link href="/" className="hover:underline">New Scan</Link>
              <Link href="/history" className="hover:underline">History</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
