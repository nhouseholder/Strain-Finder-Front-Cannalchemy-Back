/**
 * Convert a strain name to a URL-safe slug.
 * "Blue Dream" → "blue-dream"
 * "OG Kush" → "og-kush"
 * "Jack Herer #5" → "jack-herer-5"
 * "Girl Scout Cookies (GSC)" → "girl-scout-cookies-gsc"
 */
export function strainSlug(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
