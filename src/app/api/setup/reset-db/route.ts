import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        // 1. Disconnect Prisma to unlock the file
        await prisma.$disconnect();

        const cwd = process.cwd();
        const basePaths = [
            '.app_settings.json',
            'prisma/dev.db',
            '.scan_history',
            '.scan_params',
            '.scan_queue',
            '.scan_configs',
            '.scan_jobs',
            'scan_output.json'
        ];

        const locations = [
            cwd,
            path.join(cwd, '..'), // Parent
            path.join(cwd, '..', '..'), // Root from standalone
        ];

        for (const loc of locations) {
            for (const basePath of basePaths) {
                const p = path.join(loc, basePath);
                try {
                    // Check if exists first to avoid unnecessary log noise
                    const stats = await fs.stat(p).catch(() => null);
                    if (stats) {
                        await fs.rm(p, { recursive: true, force: true });
                        console.log(`Deleted: ${p}`);
                    }
                } catch (err) {
                    console.warn(`Failed to delete ${p}:`, err);
                }
            }
        }

        return NextResponse.json({ message: 'Database reset successfully. App will return to setup.' });
    } catch (error: any) {
        console.error('Reset DB error:', error);
        return NextResponse.json({ error: error.message || 'Failed to reset database' }, { status: 500 });
    }
}
