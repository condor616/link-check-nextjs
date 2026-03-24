import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './database';

const globalForPrisma = global as unknown as { 
    prisma: PrismaClient;
    dbUrl?: string;
};

// Resolve the database URL using the shared utility
const dbUrl = getDatabaseUrl();

// Log the current database configuration for troubleshooting in dev/prod
if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
        const pid = process.pid;
        const sanitizedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
        if (globalForPrisma.dbUrl !== dbUrl) {
            console.log(`[PRISMA] ${globalForPrisma.dbUrl ? 'Re-initializing' : 'Initializing'} in process ${pid} with URL: ${sanitizedUrl}`);
        }
    }
}

// Re-initialize if URL changed (e.g. storage switch in dev mode)
if (!globalForPrisma.prisma || globalForPrisma.dbUrl !== dbUrl) {
    if (globalForPrisma.prisma) {
        // Attempt to disconnect old client
        try {
            (globalForPrisma.prisma as any).$disconnect();
        } catch (e) {}
    }
    
    globalForPrisma.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
        datasources: {
            db: {
                url: dbUrl
            }
        }
    });
    globalForPrisma.dbUrl = dbUrl;
}

export const prisma = globalForPrisma.prisma;
