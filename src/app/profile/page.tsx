import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ProfileClient from './ProfileClient';
import { prisma } from '@/lib/prisma';

export default async function ProfilePage() {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
        redirect('/login');
    }

    // Fetch full user data including name
    const user = await (prisma as any).user.findUnique({
        where: { id: currentUser.id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            hasAccess: true,
            createdAt: true
        }
    });

    if (!user) {
        redirect('/login');
    }

    return (
        <div className="container-fluid py-4 max-w-4xl mx-auto">
            <div className="mb-4">
                <h1 className="h3 fw-bold mb-1">Account Profile</h1>
                <p className="text-muted mb-0">Manage your personal information and security settings.</p>
            </div>

            <div className="card prof-card shadow-sm border-0 overflow-hidden">
                <div className="card-body p-0">
                    <ProfileClient user={user} />
                </div>
            </div>
        </div>
    );
}
