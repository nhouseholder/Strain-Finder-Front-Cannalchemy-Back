import { Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'

export default function PrivacyPage() {
  usePageTitle('Privacy Policy')

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f0c]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-white/80 dark:bg-[#0a0f0c]/80 backdrop-blur-md border-b border-gray-200/50 dark:border-white/[0.04]">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          <span className="text-2xl">{'\u{1F33F}'}</span>
          <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">Strain Finder</span>
        </Link>
      </nav>

      <article className="max-w-2xl mx-auto px-6 py-12 prose prose-sm dark:prose-invert prose-headings:font-display prose-a:text-leaf-500">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          Privacy Policy
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mb-8">Last updated: February 23, 2026</p>

        <section className="space-y-6 text-sm text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">1. Information We Collect</h2>
            <p><strong className="text-gray-800 dark:text-[#b0c4b4]">Account information:</strong> When you create an account, we collect your email address and an encrypted password. We do not store passwords in plain text.</p>
            <p className="mt-2"><strong className="text-gray-800 dark:text-[#b0c4b4]">Quiz responses:</strong> Your quiz answers (desired effects, tolerance, preferences) are processed in real-time to generate recommendations. Quiz data is not permanently stored on our servers.</p>
            <p className="mt-2"><strong className="text-gray-800 dark:text-[#b0c4b4]">Journal entries:</strong> If you use the journal feature, entries are stored locally in your browser (localStorage). We do not have access to your journal data.</p>
            <p className="mt-2"><strong className="text-gray-800 dark:text-[#b0c4b4]">Payment information:</strong> Payments are processed by Stripe. We never see, store, or handle your credit card numbers. We only store your Stripe customer ID and subscription status.</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">2. How We Use Your Information</h2>
            <p>We use your information to: (a) provide and operate the Service; (b) process payments and manage subscriptions; (c) send transactional emails (account confirmation, password resets); (d) improve the Service based on aggregate, anonymized usage patterns.</p>
            <p className="mt-2">We do <strong className="text-gray-800 dark:text-[#b0c4b4]">not</strong> sell, rent, or share your personal information with third parties for marketing purposes.</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">3. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Supabase</strong> — Authentication and user profile storage</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Stripe</strong> — Payment processing (PCI-DSS compliant)</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Plausible Analytics</strong> — Privacy-friendly, cookieless website analytics (no personal data collected, GDPR compliant)</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Netlify</strong> — Website hosting and serverless functions</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Anthropic (Claude AI)</strong> — Powers the dispensary search feature (prompts do not include personal information)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">4. Cookies & Tracking</h2>
            <p>
              We use <strong className="text-gray-800 dark:text-[#b0c4b4]">no tracking cookies</strong>. Our analytics provider (Plausible) is cookieless and does not track individual users. The only local storage we use is for: age verification confirmation, theme preference, journal entries (if you use the journal), and dispensary search cache.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">5. Data Security</h2>
            <p>
              We implement industry-standard security measures including: HTTPS encryption in transit, secure authentication via Supabase, Row-Level Security (RLS) database policies, server-side API key management, and Content Security Policy headers.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">6. Your Rights</h2>
            <p>You have the right to: (a) access your personal data; (b) correct inaccurate data; (c) request deletion of your account and data; (d) export your data; (e) withdraw consent at any time.</p>
            <p className="mt-2">To exercise any of these rights, email <a href="mailto:support@strainfinder.app" className="text-leaf-500 hover:text-leaf-400">support@strainfinder.app</a>.</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">7. Data Retention</h2>
            <p>
              Account data is retained as long as your account is active. If you delete your account, your profile data is removed within 30 days. Anonymized, aggregated analytics data may be retained indefinitely.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">8. Children's Privacy</h2>
            <p>
              The Service is strictly for users 21 years of age or older. We do not knowingly collect information from anyone under 21. If we learn we have collected data from a minor, we will delete it promptly.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">10. Contact</h2>
            <p>
              Questions about privacy? Contact us at <a href="mailto:support@strainfinder.app" className="text-leaf-500 hover:text-leaf-400">support@strainfinder.app</a>.
            </p>
          </div>
        </section>
      </article>

      <footer className="text-center py-8 border-t border-gray-200/50 dark:border-white/[0.04]">
        <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 dark:text-[#3a4a3e]">
          <Link to="/" className="hover:text-gray-600 dark:hover:text-[#6a7a6e] transition-colors">Home</Link>
          <span>&middot;</span>
          <Link to="/terms" className="hover:text-gray-600 dark:hover:text-[#6a7a6e] transition-colors">Terms of Service</Link>
          <span>&middot;</span>
          <span>Strain Finder &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
