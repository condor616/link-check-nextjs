import React from 'react';
import { Metadata } from 'next';
import { JobsClient } from '@/components/JobsClient';

export const metadata: Metadata = {
    title: 'Active Jobs',
    description: 'Monitor your ongoing website scans in real-time. View progress, link details, and manage active workers.',
};

export default function JobsPage() {
    return <JobsClient />;
}
