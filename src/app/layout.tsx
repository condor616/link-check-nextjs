import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { 
  AlertCircle, 
  History, 
  Settings, 
  LogOut,
  Save
} from 'lucide-react';
import { PageTransition } from "@/components/PageTransition";
import { TransitionLink } from "@/components/TransitionLink";
import { NotificationProvider } from "@/components/NotificationContext";
import { Toaster } from "@/components/ui/sonner";

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
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`antialiased ${geistSans.variable} font-sans bg-gray-100 text-gray-900 min-h-screen`}>
        <NotificationProvider>
          <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-purple-900 text-white p-4 flex flex-col">
              <div className="mb-6">
                <h1 className="text-xl font-bold">Link Checker Pro</h1>
                <p className="text-sm text-purple-300">Find broken links, fast.</p>
              </div>
              
              <nav className="space-y-1">
                <TransitionLink 
                  href="/" 
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors"
                  activeClassName="bg-purple-800"
                >
                  <AlertCircle size={20} />
                  <span>Home</span>
                </TransitionLink>
                
                <TransitionLink 
                  href="/scan" 
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors"
                  activeClassName="bg-purple-800"
                >
                  <AlertCircle size={20} />
                  <span>New Scan</span>
                </TransitionLink>
                
                <TransitionLink 
                  href="/history" 
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors"
                  activeClassName="bg-purple-800"
                >
                  <History size={20} />
                  <span>Scan History</span>
                </TransitionLink>
                
                <TransitionLink 
                  href="/saved-scans" 
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors"
                  activeClassName="bg-purple-800"
                >
                  <Save size={20} />
                  <span>Saved Scans</span>
                </TransitionLink>
                
                <TransitionLink 
                  href="/settings" 
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-800 transition-colors"
                  activeClassName="bg-purple-800"
                >
                  <Settings size={20} />
                  <span>Settings</span>
                </TransitionLink>
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
                <PageTransition>
                  {children}
                </PageTransition>
              </div>
            </div>
          </div>
          <Toaster />
        </NotificationProvider>
      </body>
    </html>
  );
}
