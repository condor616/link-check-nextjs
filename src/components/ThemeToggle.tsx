"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
    const { setTheme, theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-10 h-10 rounded-full bg-light dark:bg-secondary animate-pulse" />;
    }

    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="btn btn-link text-dark dark:text-light p-2 rounded-circle hover-bg-light dark:hover-bg-opacity-10 transition-colors border-0 position-relative d-flex align-items-center justify-content-center"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            style={{ width: '40px', height: '40px' }}
        >
            <div className="position-relative" style={{ width: '20px', height: '20px' }}>
                <Sun
                    size={20}
                    className={`position-absolute top-0 start-0 transition-all duration-300 ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`}
                />
                <Moon
                    size={20}
                    className={`position-absolute top-0 start-0 transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`}
                />
            </div>
        </button>
    );
}
