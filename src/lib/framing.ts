export function frameAncestors(value?: string) {
  if (!value?.trim()) return "'self'";
  const origins = value.trim().split(/\s+/);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password || url.hostname.includes('*')) {
      throw new Error('FRAME_ANCESTORS must contain exact HTTPS origins separated by spaces.');
    }
  }
  return ["'self'", ...new Set(origins)].join(' ');
}
