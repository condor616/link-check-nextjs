import React from 'react';
import { Metadata } from 'next';
import { SettingsClient } from '@/components/SettingsClient';

export const metadata: Metadata = {
  title: 'Configuration & Settings',
  description: 'Manage your Link Checker Pro configuration. Set up data storage (Local or Supabase), tweak scan performance, and customize your link checking experience.',
};

export default function SettingsPage() {
  return <SettingsClient />;
}