"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-24 h-8 bg-muted/20 animate-pulse border border-primary/20" />;
    }

    return (
        <div className="flex items-center gap-0 border border-primary/30 bg-card/40 p-0.5 overflow-hidden">
            <button
                onClick={() => setTheme("light")}
                className={cn(
                    "p-1.5 transition-all duration-200 group relative",
                    theme === "light" ? "bg-primary text-primary-foreground shadow-[0_0_10px_var(--primary)]" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Light Mode"
            >
                <Sun size={14} className={cn(theme === "light" ? "scale-110" : "scale-100")} />
                {theme === "light" && <div className="absolute inset-0 border border-white/20" />}
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={cn(
                    "p-1.5 transition-all duration-200 group relative",
                    theme === "dark" ? "bg-primary text-primary-foreground shadow-[0_0_10px_var(--primary)]" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Dark Mode"
            >
                <Moon size={14} className={cn(theme === "dark" ? "scale-110" : "scale-100")} />
                {theme === "dark" && <div className="absolute inset-0 border border-white/20" />}
            </button>
        </div>
    );
}
