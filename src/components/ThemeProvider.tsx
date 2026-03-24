"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        // @ts-ignore - suppressHydrationWarning is needed for React 19 / Next 15+ theme scripts
        <NextThemesProvider {...props}>
            {children}
        </NextThemesProvider>
    )
}
