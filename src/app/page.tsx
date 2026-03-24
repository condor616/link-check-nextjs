import { Metadata } from 'next';
import Script from 'next/script';
import { HomeClient } from '@/components/HomeClient';

export const metadata: Metadata = {
// ...
};

export default function HomePage() {
  const jsonLd = {
    // ...
  };

  return (
    <>
      <Script
        id="json-ld-home"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}
