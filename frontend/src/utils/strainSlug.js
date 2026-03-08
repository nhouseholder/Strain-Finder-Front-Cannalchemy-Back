/**
 * Convert a strain name to a URL-safe slug.
 * "Blue Dream" → "blue-dream"
 * "Girl Scout Cookies (GSC)" → "girl-scout-cookies-gsc"
 * "Jack Herer" → "jack-herer"
 */
export function toSlug(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/[()]/g, '')       // remove parens
    .replace(/[^a-z0-9]+/g, '-') // non-alphanum → dash
    .replace(/^-|-$/g, '')       // trim leading/trailing dashes
}

/**
 * Convert a slug back to a search-friendly name.
 * "blue-dream" → "blue dream"
 */
export function fromSlug(slug) {
  if (!slug) return ''
  return slug.replace(/-/g, ' ')
}
