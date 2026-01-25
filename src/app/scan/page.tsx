import React from 'react';
import { Metadata } from 'next';
import { ScanClient } from '@/components/ScanClient';

export const metadata: Metadata = {
  title: 'Launch New Scan',
  description: 'Start a new website analysis. Configure scan depth, concurrency, and exclusion rules to find broken links and improve your site\'s SEO performance.',
};

export default function ScanPage() {
  return <ScanClient />;
}