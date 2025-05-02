import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from 'next/link';
import "./globals.css";
import { 
  AlertCircle, 
  History, 
  Settings, 
  LogOut 
} from 'lucide-react';

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
    <html lang="en">
      <body
        className={`${geistSans.variable} antialiased bg-gradient-to-br from-purple-300 to-purple-500 min-h-screen`}
      >
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-purple-900 text-white p-4 flex flex-col">
            <div className="mb-8 mt-2">
              <Link href="/" className="text-2xl font-bold text-white">Link Checker Pro</Link>
            </div>
            
            <nav className="space-y-1 flex-1">
              <Link href="/scan" className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors">
                <AlertCircle size={20} />
                <span>New Scan</span>
              </Link>
              <Link href="/history" className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors">
                <History size={20} />
                <span>History</span>
              </Link>
              <Link href="/settings" className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors">
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </nav>
            
            <div className="mt-auto space-y-1 pt-4 border-t border-purple-800">
              <button className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors">
                <LogOut size={20} />
                <span>Log out</span>
              </button>
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-xl shadow-lg p-6 min-h-full">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
