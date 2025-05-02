"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0.95, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.95, y: 5 }}
        transition={{ 
          duration: 0.2,
          ease: "easeInOut"
        }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
} 