import { jobService } from '../src/lib/jobs';
import { historyService } from '../src/lib/history';
import { prisma } from '../src/lib/prisma';

async function verify() {
    console.log('Verifying SQLite integration...');

    // 1. Create a job
    console.log('Creating a test job...');
    const job = await jobService.createJob('https://example.com', { depth: 1 });
    console.log('Job created:', job.id);

    // Verify it exists in Prisma
    const savedJob = await prisma.job.findUnique({ where: { id: job.id } });
    if (!savedJob) {
        throw new Error('Job not found in Prisma!');
    }
    console.log('Job found in Prisma:', savedJob.id);

    // 2. Update job status
    console.log('Updating job status...');
    await jobService.updateJobStatus(job.id, 'running');
    const runningJob = await prisma.job.findUnique({ where: { id: job.id } });
    if (runningJob?.status !== 'running') {
        throw new Error('Job status not updated!');
    }
    console.log('Job status updated to running.');

    // 3. Complete job and save to history
    console.log('Completing job...');
    // Mock results
    await jobService.updateJobStatus(job.id, 'completed', {
        results: [{
            url: 'https://example.com',
            status: 'ok',
            statusCode: 200,
            foundOn: new Set()
        }]
    });

    // Verify history
    console.log('Verifying history...');
    const history = await prisma.scanHistory.findUnique({ where: { id: job.id } });
    if (!history) {
        throw new Error('History not found in Prisma!');
    }
    console.log('History found:', history.id);
    console.log('Results:', history.results);

    console.log('Verification successful!');
}

verify()
    .catch(e => {
        console.error('Verification failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
