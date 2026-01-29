"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface SimpleModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    footer?: React.ReactNode;
}

export function SimpleModal({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    footer
}: SimpleModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
        return () => {
            document.body.style.overflow = "auto";
        };
    }, [isOpen]);

    const sizeClasses = {
        sm: "modal-sm",
        md: "",
        lg: "modal-lg",
        xl: "modal-xl",
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="modal-root" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1050, pointerEvents: 'none' }}>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="position-absolute w-100 h-100 bg-black"
                        style={{ pointerEvents: 'auto', top: 0, left: 0 }}
                        onClick={onClose}
                    />

                    {/* Modal Dialog */}
                    <div
                        className={`modal-dialog ${sizeClasses[size]}`}
                        style={{
                            position: 'relative',
                            pointerEvents: 'auto',
                            zIndex: 1051,
                            margin: '3rem auto', // 3rem from top, centered horizontally
                            maxWidth: size === 'md' ? '500px' : undefined // Ensure MD size has a width
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: -50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="modal-content border-0 shadow-lg rounded-4"
                            style={{ backgroundColor: 'var(--bg-card)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                        >
                            <div className="modal-header border-bottom-0 p-4 pb-0 d-flex align-items-center justify-content-between flex-shrink-0">
                                <h5 className="modal-title fw-black h4">{title}</h5>
                                <button
                                    type="button"
                                    className="btn-close shadow-none"
                                    onClick={onClose}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body p-4 pt-3 overflow-y-auto">
                                {children}
                            </div>
                            {footer && (
                                <div className="modal-footer border-top-0 p-4 pt-0 gap-2">
                                    {footer}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
