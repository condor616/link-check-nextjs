import React from 'react';
import { Metadata } from 'next';
import { SavedScansClient } from '@/components/SavedScansClient';

export const metadata: Metadata = {
  title: 'Saved Audits',
  description: 'Access your bookmarked and saved website scan configurations. Easily relaunch audits and compare historical results.',
};

export default function SavedScansPage() {
  return <SavedScansClient />;
}