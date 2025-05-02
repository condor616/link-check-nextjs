"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "transition" | "initial" | "animate" | "whileHover"> {
  delay?: number;
  children: React.ReactNode;
}

export function AnimatedCard({ 
  children, 
  className, 
  delay = 0,
  ...props 
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: delay,
        ease: "easeOut"
      }}
      whileHover={{ 
        y: -5,
        transition: { duration: 0.2 }
      }}
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm p-6",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
} 