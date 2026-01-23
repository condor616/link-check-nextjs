import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting data migration for broken_links and total_links...');

    // 1. Migrate Jobs
    const jobs = await prisma.job.findMany({
        where: {
            OR: [
                { broken_links: 0, total_links: 0, results: { not: null } },
            ]
        }
    });

    console.log(`Found ${jobs.length} jobs to migrate.`);

    for (const job of jobs) {
        if (!job.results) continue;
        try {
            const results = JSON.parse(job.results);
            if (Array.isArray(results)) {
                const brokenCount = results.filter((r: any) =>
                    r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400)
                ).length;

                await prisma.job.update({
                    where: { id: job.id },
                    data: {
                        broken_links: brokenCount,
                        total_links: results.length
                    }
                });
                console.log(`Updated job ${job.id}: ${brokenCount}/${results.length}`);
            }
        } catch (e) {
            console.error(`Error migrating job ${job.id}:`, e);
        }
    }

    // 2. Migrate ScanHistory
    const scans = await prisma.scanHistory.findMany({
        where: {
            broken_links: 0,
            total_links: 0
        }
    });

    console.log(`Found ${scans.length} history records to migrate.`);

    for (const scan of scans) {
        try {
            const results = JSON.parse(scan.results);
            if (Array.isArray(results)) {
                const brokenCount = results.filter((r: any) =>
                    r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400)
                ).length;

                await prisma.scanHistory.update({
                    where: { id: scan.id },
                    data: {
                        broken_links: brokenCount,
                        total_links: results.length
                    }
                });
                console.log(`Updated history ${scan.id}: ${brokenCount}/${results.length}`);
            } else if (results && typeof results === 'object') {
                const resultsArr = Object.values(results);
                const brokenCount = resultsArr.filter((r: any) =>
                    r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400)
                ).length;

                await prisma.scanHistory.update({
                    where: { id: scan.id },
                    data: {
                        broken_links: brokenCount,
                        total_links: resultsArr.length
                    }
                });
                console.log(`Updated history ${scan.id}: ${brokenCount}/${resultsArr.length}`);
            }
        } catch (e) {
            console.error(`Error migrating history ${scan.id}:`, e);
        }
    }

    console.log('Migration completed.');
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
