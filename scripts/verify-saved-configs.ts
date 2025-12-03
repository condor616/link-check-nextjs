import { prisma } from '../src/lib/prisma';
import { SavedScanConfig } from '../src/app/api/saved-configs/route';

async function verify() {
    console.log('Verifying SavedConfig integration...');

    const testId = 'test-config-123';
    const testName = 'Test Config';
    const testUrl = 'https://example.com';
    const testConfig = { depth: 1, concurrency: 5 };

    // 1. Create a saved config directly in Prisma (simulating API save)
    console.log('Creating a test saved config...');
    await prisma.savedConfig.upsert({
        where: { id: testId },
        update: {
            name: testName,
            url: testUrl,
            config: JSON.stringify(testConfig),
            updatedAt: new Date()
        },
        create: {
            id: testId,
            name: testName,
            url: testUrl,
            config: JSON.stringify(testConfig),
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });
    console.log('Saved config created:', testId);

    // 2. Verify it exists in Prisma
    const savedConfig = await prisma.savedConfig.findUnique({ where: { id: testId } });
    if (!savedConfig) {
        throw new Error('Saved config not found in Prisma!');
    }
    console.log('Saved config found in Prisma:', savedConfig.id);
    console.log('Config content:', savedConfig.config);

    // 3. Update the config
    console.log('Updating saved config...');
    const updatedConfig = { ...testConfig, depth: 2 };
    await prisma.savedConfig.update({
        where: { id: testId },
        data: {
            config: JSON.stringify(updatedConfig),
            updatedAt: new Date()
        }
    });

    const updatedSavedConfig = await prisma.savedConfig.findUnique({ where: { id: testId } });
    if (updatedSavedConfig?.config !== JSON.stringify(updatedConfig)) {
        throw new Error('Saved config not updated!');
    }
    console.log('Saved config updated successfully.');

    // 4. Delete the config
    console.log('Deleting saved config...');
    await prisma.savedConfig.delete({ where: { id: testId } });

    const deletedConfig = await prisma.savedConfig.findUnique({ where: { id: testId } });
    if (deletedConfig) {
        throw new Error('Saved config not deleted!');
    }
    console.log('Saved config deleted successfully.');

    console.log('Verification successful!');
}

verify()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
