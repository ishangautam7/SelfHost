import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SelfHost',
    short_name: 'SelfHost',
    description: 'Host apps from your own device through secure public tunnels.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/selfhost-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/selfhost-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
