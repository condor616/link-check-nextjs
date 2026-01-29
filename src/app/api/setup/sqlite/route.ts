import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST() {
    try {
        const cwd = process.cwd();
        console.log('[SETUP] SQLite Initialization started. CWD:', cwd);

        // Priority 1: Check for prisma in the local standalone node_modules (fixed by build:static)
        let prismaBinPath = path.join(cwd, 'node_modules', 'prisma', 'build', 'index.js');
        let prismaBin = '';

        if (fs.existsSync(prismaBinPath)) {
            console.log('[SETUP] Found standalone prisma build assets.');
            prismaBin = `node "${prismaBinPath}"`;
        } else {
            // Priority 2: Check for .bin/prisma in current or parent dirs
            const possibleBins = [
                path.join(cwd, 'node_modules', '.bin', 'prisma'),
                path.join(cwd, '..', '..', 'node_modules', '.bin', 'prisma')
            ];
            for (const bin of possibleBins) {
                if (fs.existsSync(bin)) {
                    prismaBin = `"${bin}"`;
                    break;
                }
            }
        }

        // Priority 3: Fallback to npx
        if (!prismaBin) {
            console.log('[SETUP] No local prisma binary found, falling back to npx');
            prismaBin = 'npx prisma';
        }

        // Resolve Schema
        const possibleSchemas = [
            path.join(cwd, 'prisma', 'schema.prisma'),
            path.join(cwd, '..', '..', 'prisma', 'schema.prisma')
        ];
        let schemaPath = '';
        for (const s of possibleSchemas) {
            if (fs.existsSync(s)) {
                schemaPath = s;
                break;
            }
        }

        if (!schemaPath) {
            throw new Error('Prisma schema not found. Ensure you are running in a valid project or standalone directory.');
        }

        console.log('[SETUP] Resolved Prisma Bin:', prismaBin);
        console.log('[SETUP] Resolved Schema Path:', schemaPath);

        // Run prisma db push
        const command = `${prismaBin} db push --accept-data-loss --schema="${schemaPath}"`;
        console.log('[SETUP] Executing command:', command);

        const { stdout, stderr } = await execAsync(command, {
            env: {
                ...process.env,
                DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db'
            }
        });

        console.log('[SETUP] Prisma db push completed successfully.');

        return NextResponse.json({
            success: true,
            message: 'SQLite database initialized successfully'
        });
    } catch (error: any) {
        console.error('[SETUP] SQLite setup CRITICAL ERROR:', error);
        return NextResponse.json({
            error: 'Failed to initialize SQLite database',
            details: error.stderr || error.message || 'Unknown error'
        }, { status: 500 });
    }
}
