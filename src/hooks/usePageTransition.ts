"use client";

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function usePageTransition() {
  const pathname = usePathname();
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // When the path changes, update the transition state
  useEffect(() => {
    if (pathname !== prevPathname) {
      setIsTransitioning(true);
      setPrevPathname(pathname);
      
      // Short timeout to allow animations to complete
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [pathname, prevPathname]);

  // Navigate with transition
  const navigateWithTransition = (href: string) => {
    setIsTransitioning(true);
    
    // Short delay before navigation to allow exit animations
    setTimeout(() => {
      router.push(href);
    }, 100);
  };

  return {
    isTransitioning,
    navigateWithTransition,
    currentPath: pathname
  };
} 