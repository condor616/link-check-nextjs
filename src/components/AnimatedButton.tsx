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
        return "bg-purple-600 text-white hover:bg-purple-700";
      case "secondary":
        return "bg-blue-600 text-white hover:bg-blue-700";
      case "outline":
        return "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50";
      case "ghost":
        return "bg-transparent text-gray-700 hover:bg-gray-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
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