/**
 * Dynamic sitemap generator — Cloudflare Pages Function.
 * Serves at /sitemap.xml with all strain pages + static pages.
 * Generates ~1,100 URLs from the strain dataset.
 */
import strainDb from './_data/strain-data.js'

const STRAIN_DATA = strainDb.strains || []

function toSlug(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function isSearchEligible(name) {
  if (!name || name.length < 2) return false
  if (/\s+x\s+/i.test(name) || name.includes('\u00d7')) return false
  if (/\s+-\s+\w/.test(name)) return false
  if (/^auto\s/i.test(name) || /\bAUTO$/i.test(name)) return false
  if (/\b(autoflower|seeds?\s+(female|regular|feminized)|reg\s+\d+pk|cannabis seeds)\b/i.test(name)) return false
  if (name.length > 35) return false
  if (/\b(mix\s*\d|gift\s*set|box\s*set|best\s*sellers|beginner|bundle|collection)\b/i.test(name)) return false
  if (/\b(blimburn|extraction|fast\s*version|fast\s*flowering)\b/i.test(name)) return false
  if (/\b(f\d+|s\d+|bx\d+)\b/i.test(name) && !/^(ak|gg|og)/i.test(name)) return false
  if (/^(club|don|research)\s/i.test(name)) return false
  if (/\(.*\b(LINE|REG|FEM)\b.*\)/i.test(name)) return false
  return true
}

export async function onRequest(context) {
  const today = new Date().toISOString().split('T')[0]

  // Static pages
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/strains', priority: '0.9', changefreq: 'weekly' },
    { loc: '/strains/type/indica', priority: '0.8', changefreq: 'weekly' },
    { loc: '/strains/type/sativa', priority: '0.8', changefreq: 'weekly' },
    { loc: '/strains/type/hybrid', priority: '0.8', changefreq: 'weekly' },
    { loc: '/learn', priority: '0.8', changefreq: 'weekly' },
    { loc: '/learn/terpenes', priority: '0.7', changefreq: 'monthly' },
    { loc: '/learn/cannabinoids', priority: '0.7', changefreq: 'monthly' },
    { loc: '/explore-strains', priority: '0.7', changefreq: 'weekly' },
    { loc: '/signup', priority: '0.5', changefreq: 'monthly' },
    { loc: '/terms', priority: '0.3', changefreq: 'monthly' },
    { loc: '/privacy', priority: '0.3', changefreq: 'monthly' },
  ]

  // Strain pages from data
  const strainUrls = STRAIN_DATA
    .filter(s => isSearchEligible(s.name) && s.dataCompleteness === 'full')
    .map(s => ({
      loc: `/strains/${toSlug(s.name)}`,
      priority: '0.6',
      changefreq: 'monthly',
    }))

  const allUrls = [...staticPages, ...strainUrls]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>https://mystrainai.com${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
