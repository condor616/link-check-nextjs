import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
    const { scanId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const afterStr = searchParams.get('after');

    try {
        const after = afterStr ? new Date(afterStr) : new Date(0);

        const logs = await prisma.scanLog.findMany({
            where: {
                jobId: scanId,
                createdAt: {
                    gt: after
                }
            },
            orderBy: {
                createdAt: 'asc'
            },
            take: 1000 // Limit to avoid massive payloads
        });

        // Map to frontend format
        const formattedLogs = logs.map(log => ({
            id: log.id,
            timestamp: log.createdAt.toISOString(),
            level: log.level,
            message: log.message,
            data: log.data ? JSON.parse(log.data) : undefined
        }));

        return NextResponse.json({
            logs: formattedLogs,
            count: formattedLogs.length
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
