import { prisma } from './prisma';
import { getSupabaseClient, isUsingSupabase } from './supabase';

export async function checkIsSetup(): Promise<boolean> {
    console.log('[SETUP] Checking if app is setup...');
    try {
        const useSupabase = await isUsingSupabase();
        console.log('[SETUP] storageType:', useSupabase ? 'supabase' : 'sqlite');

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) return false;

            // Check for admin
            const { data: adminUser, error: adminError } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin')
                .limit(1)
                .maybeSingle();

            return !!adminUser && !adminError;
        } else {
            // Local SQLite check
            try {
                const adminCount = await (prisma as any).user.count({
                    where: { role: 'admin' }
                });
                return adminCount > 0;
            } catch (error) {
                // If tables don't exist, it's definitely not setup
                return false;
            }
        }
    } catch (error) {
        console.error('Error checking setup status:', error);
        return false;
    }
}
