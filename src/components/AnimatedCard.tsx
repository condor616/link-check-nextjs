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
        "bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_var(--primary)] hover:bg-card/80 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
} 