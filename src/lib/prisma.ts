import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Robustly resolve the database URL, especially for relative SQLite paths
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.startsWith('file:')) {
    const relativePath = dbUrl.replace('file:', '');
    if (!path.isAbsolute(relativePath)) {
        // Try to find the prisma folder in current or parent directories
        let currentDir = process.cwd();
        let absolutePath = '';

        // Look up to 3 levels up for a 'prisma' directory
        for (let i = 0; i < 3; i++) {
            const checkPath = path.resolve(currentDir, 'prisma', relativePath.replace('./', ''));
            const prismaDir = path.resolve(currentDir, 'prisma');
            if (fs.existsSync(prismaDir) && !currentDir.split(path.sep).includes('.next')) {
                absolutePath = checkPath;
                break;
            }
            currentDir = path.dirname(currentDir);
        }

        if (absolutePath) {
            dbUrl = `file:${absolutePath}`;
            process.env.DATABASE_URL = dbUrl;
        }
    }
}

// Log the current database configuration for troubleshooting
if (process.env.NODE_ENV === 'production') {
    console.log(`[PRISMA] Initializing in ${process.pid} with URL: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
}

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
        datasources: {
            db: {
                url: dbUrl
            }
        }
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
