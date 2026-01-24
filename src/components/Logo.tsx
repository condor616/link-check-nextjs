import React from 'react';

export function Logo({ className = "", size = 24 }: { className?: string; size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Magnifying Glass Circle (Lens) - Bigger radius, shifted slightly top-left */}
            <circle cx="10" cy="10" r="9" />

            {/* Handle - adjusted for new circle position */}
            <path d="M21 21l-4.3-4.3" />

            {/* The <a> text inside - Larger to be closer to lens */}
            <text
                x="10"
                y="12.3" // Pushed down to visually center (Center 10 + ~Half Cap Height)
                textAnchor="middle"
                fill="currentColor"
                stroke="none"
                fontSize="7.5px" // Larger to fill the lens more (closer to edge)
                fontWeight="bold"
                fontFamily="monospace"
                style={{ pointerEvents: 'none' }}
            >
                &lt;a&gt;
            </text>
        </svg>
    );
}
