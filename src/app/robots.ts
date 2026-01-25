import { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/settings';

export default async function robots(): Promise<MetadataRoute.Robots> {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/_next/'],
        },
        sitemap: `${await getAppUrl()}/sitemap.xml`,
    };
}
