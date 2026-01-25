import { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/settings';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = await getAppUrl();

    const routes = [
        '',
        '/scan',
        '/history',
        '/jobs',
        '/saved-scans',
        '/settings',
    ];

    return routes.map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
    }));
}
