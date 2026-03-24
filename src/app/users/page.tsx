import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import UsersClient from './UsersClient';

export default async function UsersPage() {
    const currentUser = await getCurrentUser();

    // Secondary protection just to be safe (AuthGuard catches most, but we strictly enforce 'admin')
    if (!currentUser || currentUser.role !== 'admin') {
        redirect('/');
    }

    // Fetch all users
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="container-fluid py-4 max-w-7xl mx-auto">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 fw-bold mb-1">User Management</h1>
                    <p className="text-muted mb-0">Control application access for registered users.</p>
                </div>
            </div>

            <div className="card prof-card shadow-sm border-0">
                <div className="card-body p-0">
                    <UsersClient users={users} currentUserId={currentUser.id} />
                </div>
            </div>
        </div>
    );
}
