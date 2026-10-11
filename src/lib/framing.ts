export function frameAncestors(value?: string) {
  if (!value?.trim()) return "'self'";
  const origins = value.trim().split(/\s+/);
  if (origins.includes('https://sites.google.com')) {
    // Google Sites nests embeds through gstatic and a changing user-content host.
    origins.push('https://www.gstatic.com', 'https://*.googleusercontent.com');
  }
  for (const origin of origins) {
    if (origin === 'https://*.googleusercontent.com') continue;
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password || url.hostname.includes('*')) {
      throw new Error('FRAME_ANCESTORS must contain exact HTTPS origins or the Google Sites wrapper pattern, separated by spaces.');
    }
  }
  return ["'self'", ...new Set(origins)].join(' ');
}
