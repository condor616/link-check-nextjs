"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import React from "react";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "transition" | "initial" | "animate" | "whileHover"> {
  delay?: number;
  children: React.ReactNode;
  noPadding?: boolean;
}

export function AnimatedCard({
  children,
  className = "",
  delay = 0,
  noPadding = false,
  ...props
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={`card prof-card ${className}`}
      {...props}
    >
      <div className={`card-body ${noPadding ? 'p-0' : 'p-3 p-md-4'}`}>
        {children}
      </div>
    </motion.div>
  );
}