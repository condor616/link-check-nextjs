import React from 'react';
import { Metadata } from 'next';
import { HistoryClient } from '@/components/HistoryClient';

export const metadata: Metadata = {
  title: 'Scan History',
  description: 'Review and compare all your previous website link scans. Access detailed historical reports and monitor your site\'s health over time.',
};

export default function HistoryPage() {
  return <HistoryClient />;
}