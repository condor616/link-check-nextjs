"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

// Template component for smooth page transitions
// This will wrap the page content and apply transitions
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.8 }}
      transition={{
        duration: 0.15,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
} 