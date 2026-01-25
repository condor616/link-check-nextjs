import React from 'react';
import { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';

export const metadata: Metadata = {
  title: 'Professional SEO Broken Link Scanner',
  description: 'Hunting down 404s like they owe us money. Keeping your site\'s reputation alive, one link at a time. Professional broken link checking for SEO experts.',
  openGraph: {
    title: 'Link Checker Pro - Professional Broken Link Scanner',
    description: 'Hunt down 404s and keep your site alive. Professional broken link checking for SEO experts.',
  },
};

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'Link Checker Pro',
    'operatingSystem': 'Web',
    'applicationCategory': 'SEO Tool',
    'description': 'Advanced website link analysis tool. Scan for broken links, identify 404 errors, and improve your site\'s SEO.',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}
