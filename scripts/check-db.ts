
import { prisma } from '../src/lib/prisma';

async function main() {
    try {
        const count = await prisma.scanHistory.count();
        console.log(`Total scans in DB: ${count}`);

        if (count > 0) {
            const lastScan = await prisma.scanHistory.findFirst({
                orderBy: { scan_date: 'desc' }
            });
            console.log('Last Scan:', lastScan ? { ...lastScan, results: '...truncated...' } : null);

            if (lastScan) {
                try {
                    const parsed = JSON.parse(lastScan.results as string);
                    console.log('Parsed results type:', typeof parsed);
                    console.log('Is Array?', Array.isArray(parsed));
                } catch (e) {
                    console.error('JSON parse error:', e);
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
