"use client";

import { ComponentPropsWithoutRef } from "react";
import { usePageTransition } from "@/hooks/usePageTransition";
import { cn } from "@/lib/utils";

interface TransitionLinkProps extends ComponentPropsWithoutRef<"a"> {
  href: string;
  activeClassName?: string;
}

export function TransitionLink({
  href,
  children,
  className,
  activeClassName = "",
  onClick,
  ...props
}: TransitionLinkProps) {
  const { navigateWithTransition, currentPath } = usePageTransition();
  const isActive = currentPath === href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClick) {
      onClick(e);
    }
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
      {...props}
    >
      {children}
    </a>
  );
} 