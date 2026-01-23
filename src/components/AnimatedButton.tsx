"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import React, { ButtonHTMLAttributes } from "react";
import { TransitionLink } from "./TransitionLink";

interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, "transition" | "whileHover" | "whileTap"> {
  children: React.ReactNode;
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive";
  href?: string;
  activeClassName?: string;
}

export function AnimatedButton({
  children,
  className,
  variant = "default",
  href,
  ...props
}: AnimatedButtonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-primary text-primary-foreground hover:brightness-110 hover:shadow-[0_0_20px_-5px_var(--primary)] border border-primary/50 rounded-none";
      case "secondary":
        return "bg-secondary text-secondary-foreground hover:brightness-110 hover:shadow-[0_0_20px_-5px_var(--secondary)] border border-secondary/50 rounded-none";
      case "outline":
        return "bg-transparent border border-primary/50 text-primary hover:bg-primary/10 hover:shadow-[0_0_15px_-5px_var(--primary)] rounded-none";
      case "ghost":
        return "bg-transparent hover:bg-white/5 hover:text-primary rounded-none";
      case "destructive":
        return "bg-destructive text-destructive-foreground hover:brightness-110 hover:shadow-[0_0_20px_-5px_var(--destructive)] border border-transparent rounded-none";
      default:
        return "bg-primary text-primary-foreground hover:brightness-110 hover:shadow-[0_0_20px_-5px_var(--primary)] border border-primary/50 rounded-none";
    }
  };

  const buttonContent = (
    <motion.div
      whileHover={props.disabled ? {} : {
        scale: 1.03,
        transition: { duration: 0.2 }
      }}
      whileTap={props.disabled ? {} : {
        scale: 0.97,
        transition: { duration: 0.1 }
      }}
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 w-full h-full",
        getVariantClasses(),
        className,
        props.disabled && "opacity-50 cursor-not-allowed grayscale-[0.5]"
      )}
    >
      {children}
    </motion.div>
  );

  if (href && !props.disabled) {
    return (
      <TransitionLink href={href} className="inline-block no-underline">
        {buttonContent}
      </TransitionLink>
    );
  }

  return (
    <button
      className={cn(
        "appearance-none bg-transparent border-none p-0 m-0 cursor-pointer outline-none",
        props.disabled ? "cursor-not-allowed" : "cursor-pointer"
      )}
      {...(props as any)}
      onClick={(e) => {
        if (props.disabled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (props.onClick) props.onClick(e);
      }}
    >
      {buttonContent}
    </button>
  );
}
