"use client";

import Link from "next/link";
import { ComponentPropsWithoutRef } from "react";
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";

interface TransitionLinkProps extends ComponentPropsWithoutRef<typeof Link> {
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
  const pathname = usePathname();
  const isActive = pathname === href || (pathname === '/' && href === '/');

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        className,
        isActive && activeClassName
      )}
      {...props}
    >
      {children}
    </Link>
  );
} 