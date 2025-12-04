"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import React, { ButtonHTMLAttributes } from "react";

interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, "transition" | "whileHover" | "whileTap"> {
  children: React.ReactNode;
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost";
}

export function AnimatedButton({
  children,
  className,
  variant = "default",
  ...props
}: AnimatedButtonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-primary text-primary-foreground hover:brightness-110 hover:shadow-[0_0_20px_-5px_var(--primary)] border border-transparent";
      case "secondary":
        return "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent";
      case "outline":
        return "bg-transparent border border-input hover:border-primary hover:text-primary hover:bg-primary/10 hover:shadow-[0_0_15px_-5px_var(--primary)]";
      case "ghost":
        return "bg-transparent hover:bg-accent hover:text-accent-foreground";
      default:
        return "bg-primary text-primary-foreground hover:brightness-110 hover:shadow-[0_0_20px_-5px_var(--primary)] border border-transparent";
    }
  };

  return (
    <motion.button
      whileHover={{
        scale: 1.03,
        transition: { duration: 0.2 }
      }}
      whileTap={{
        scale: 0.97,
        transition: { duration: 0.1 }
      }}
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500",
        getVariantClasses(),
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
} 