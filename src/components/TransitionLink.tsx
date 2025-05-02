"use client";

import { ReactNode } from "react";
import { usePageTransition } from "@/hooks/usePageTransition";
import { cn } from "@/lib/utils";

interface TransitionLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
}

export function TransitionLink({
  href,
  children,
  className,
  activeClassName = "",
}: TransitionLinkProps) {
  const { navigateWithTransition, currentPath } = usePageTransition();
  const isActive = currentPath === href;
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateWithTransition(href);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        className,
        isActive && activeClassName
      )}
    >
      {children}
    </a>
  );
} 