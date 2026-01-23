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
        "bg-card/40 backdrop-blur-sm text-card-foreground rounded-none border border-primary/20 p-4 md:p-6 transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_30px_-10px_var(--primary)] hover:bg-card/60 cursor-pointer cyber-border",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
} 