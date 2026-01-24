"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import React from "react";
import { TransitionLink } from "./TransitionLink";

interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, "transition" | "whileHover" | "whileTap"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "light" | "dark" | "outline-primary" | "outline-secondary" | "outline-success" | "outline-danger" | "outline-warning" | "outline-info" | "outline-light" | "outline-dark" | "link";
  size?: "sm" | "lg";
  href?: string;
  noPadding?: boolean;
}

export function AnimatedButton({
  children,
  className = "",
  variant = "primary",
  size,
  href,
  noPadding = false,
  ...props
}: AnimatedButtonProps) {
  const btnClasses = `btn btn-${variant} ${size ? `btn-${size}` : ""} ${className}`.trim();

  const buttonContent = (
    <motion.div
      whileHover={props.disabled ? {} : {
        scale: 1.05,
        y: -1,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      whileTap={props.disabled ? {} : {
        scale: 0.95,
        y: 0,
        transition: { duration: 0.1 }
      }}
      className="w-100 h-100 d-inline-flex align-items-center justify-content-center"
    >
      {children}
    </motion.div>
  );

  if (href && !props.disabled) {
    return (
      <TransitionLink
        href={href}
        className={`${btnClasses} text-decoration-none d-inline-flex align-items-center justify-content-center p-0`}
        style={(noPadding ? { width: props.style?.width, height: props.style?.height } : {}) as React.CSSProperties}
      >
        <div className={noPadding ? "w-100 h-100 d-flex align-items-center justify-content-center" : "px-3 py-2"}>
          {buttonContent}
        </div>
      </TransitionLink>
    );
  }

  return (
    <button
      className={`${btnClasses} d-inline-flex align-items-center justify-content-center`}
      {...(props as any)}
      style={{ ...props.style, padding: 0 }}
    >
      {noPadding ? buttonContent : (
        <div className="px-3 py-2 w-100 h-100 d-flex align-items-center justify-content-center">
          {buttonContent}
        </div>
      )}
    </button>
  );
}
