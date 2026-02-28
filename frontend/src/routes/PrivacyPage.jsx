import { Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'

export default function PrivacyPage() {
  usePageTitle('Privacy Policy')

  return (
    <div className="min-h-screen bg-[#f4f7f5] dark:bg-leaf-900">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-[#f4f7f5]/90 dark:bg-leaf-900/85 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/[0.06] shadow-sm dark:shadow-none">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          <span className="text-2xl">{'\u{1F33F}'}</span>
          <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">MyStrainAI</span>
        </Link>
      </nav>

      <article className="max-w-2xl mx-auto px-6 py-12 prose prose-sm dark:prose-invert prose-headings:font-display prose-a:text-leaf-500">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[#e8f0ea] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          Privacy Policy
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mb-8">Last updated: February 24, 2026</p>

        <section className="space-y-6 text-sm text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">1. Information We Collect</h2>
            <p><strong className="text-gray-800 dark:text-[#b0c4b4]">Account information:</strong> When you create an account, we collect your email address and an encrypted password hash. We never store passwords in plain text.</p>
            <p className="mt-2"><strong className="text-gray-800 dark:text-[#b0c4b4]">Quiz responses:</strong> Your quiz answers (desired effects, tolerance level, consumption preferences) are processed in real-time to generate informational results. Quiz data is not permanently stored on our servers and is not linked to your identity.</p>
            <p className="mt-2"><strong className="text-gray-800 dark:text-[#b0c4b4]">Journal entries:</strong> If you use the journal feature, entries are stored locally in your browser (localStorage) on your device. We do not have access to, transmit, or store your journal data on our servers.</p>
            <p className="mt-2"><strong className="text-gray-800 dark:text-[#b0c4b4]">Usage data:</strong> We collect anonymized, aggregate usage analytics (page views, feature usage) through Plausible Analytics, which does not use cookies and does not track individual users.</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">2. How We Use Your Information</h2>
            <p>We use your information solely to: (a) provide and operate the Service; (b) send transactional emails (account confirmation, password resets); (c) improve the Service based on aggregate, anonymized usage patterns.</p>
            <p className="mt-2 font-semibold text-gray-800 dark:text-[#b0c4b4]">We do NOT:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Sell, rent, trade, or share your personal information with any third parties for marketing, advertising, or commercial purposes</li>
              <li>Share your data with cannabis companies, dispensaries, or any cannabis industry entities</li>
              <li>Use your data for targeted advertising</li>
              <li>Create profiles of your cannabis preferences for sale to third parties</li>
              <li>Share your information with law enforcement unless required by a valid court order</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">3. Cannabis-Specific Privacy Protections</h2>
            <p>We recognize the sensitive nature of cannabis-related information and take additional precautions:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your quiz responses, strain preferences, and browsing history within the app are <strong className="text-gray-800 dark:text-[#b0c4b4]">never stored on our servers</strong> in a way that links them to your identity</li>
              <li>We do not maintain logs of which strains you view, favorite, or compare</li>
              <li>Journal data stays on your device only and is never transmitted</li>
              <li>We will never voluntarily disclose any user information to law enforcement agencies. We will comply only with valid, legally binding court orders and will provide notice to affected users where legally permitted</li>
              <li>We do not collect geolocation data, IP addresses for tracking, or device fingerprints</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services, each with their own privacy policies:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Supabase</strong> — Authentication and user profile storage (email and account status only)</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Plausible Analytics</strong> — Privacy-friendly, cookieless website analytics. No personal data collected. GDPR and CCPA compliant. No data shared with advertisers.</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Cloudflare</strong> — Website hosting and serverless functions</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Stripe</strong> — Payment processing for optional premium subscriptions. Stripe handles all credit card data directly and is PCI-DSS Level 1 certified. We never see, store, or process your full credit card number.</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Anthropic (Claude AI)</strong> — AI-powered dispensary discovery feature. Location queries (zip codes, city names) may be processed by Anthropic's Claude AI to search for nearby dispensary information. No personal identity data is shared with Anthropic.</li>
            </ul>
            <p className="mt-2">We do not use Google Analytics, Facebook Pixel, or any tracking-based analytics service.</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">5. Cookies & Tracking</h2>
            <p>
              We use <strong className="text-gray-800 dark:text-[#b0c4b4]">no tracking cookies, no advertising cookies, and no third-party cookies</strong>. The only local storage we use is for: age verification confirmation, theme preference (light/dark mode), and journal entries (if you use the journal). All local storage data stays on your device.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">6. Data Security</h2>
            <p>
              We implement industry-standard security measures including: HTTPS encryption for all data in transit, secure authentication via Supabase, Row-Level Security (RLS) database policies ensuring users can only access their own data, server-side API key management, and Content Security Policy headers.
            </p>
            <p className="mt-2">
              While we take reasonable steps to protect your information, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">7. Your Rights</h2>
            <p>Regardless of where you live, you have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Access</strong> — Request a copy of all personal data we hold about you</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Correct</strong> — Request correction of inaccurate data</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Delete</strong> — Request deletion of your account and all associated data</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Export</strong> — Request an export of your data in a portable format</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Withdraw consent</strong> — Withdraw consent at any time by deleting your account</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, email <a href="mailto:mystrainplus@gmail.com" className="text-leaf-500 hover:text-leaf-400">mystrainplus@gmail.com</a>. We will respond within 30 days.</p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">8. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Right to Know:</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Right to Delete:</strong> You may request that we delete your personal information</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights</li>
              <li><strong className="text-gray-800 dark:text-[#b0c4b4]">No Sale of Data:</strong> We do not sell your personal information. We have not sold personal information in the preceding 12 months. We will never sell your personal information.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">9. Data Retention</h2>
            <p>
              Account data (email and account status) is retained as long as your account is active. If you delete your account, your profile data is permanently removed within 30 days. Anonymized, aggregate analytics data (which cannot be linked back to you) may be retained indefinitely.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">10. Children's Privacy</h2>
            <p>
              The Service is strictly for users 21 years of age or older. We do not knowingly collect information from anyone under 21. If we learn we have collected data from a person under 21, we will delete it promptly and terminate the associated account.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">11. NOT a Healthcare Provider &mdash; Not HIPAA Compliant</h2>
            <p>
              <strong className="text-gray-800 dark:text-[#b0c4b4]">MyStrainAI is NOT a healthcare provider, medical facility, or covered entity under the Health Insurance Portability and Accountability Act (HIPAA).</strong> We do not collect, store, or process Protected Health Information (PHI) as defined by HIPAA. Your quiz responses, strain preferences, and usage data are NOT medical records. We do not maintain medical records or patient files of any kind.
            </p>
            <p className="mt-2">
              If you share health-related information with us (e.g., via quiz responses about desired effects), this data is treated as general preference information and is NOT protected under HIPAA or any healthcare privacy regulation. Do not share sensitive medical information through our platform. For medical advice, consult a licensed healthcare professional.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">12. AI &amp; Machine Learning Data Processing</h2>
            <p>
              MyStrainAI uses artificial intelligence and machine learning algorithms to generate strain recommendations and informational content. Here is how your data interacts with our AI systems:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Quiz responses are processed by our matching algorithm in real-time to generate informational suggestions. This processing happens server-side and results are not used to train external AI models.</li>
              <li>Dispensary search queries (zip codes, city names) may be processed by third-party AI services (Anthropic Claude) to discover nearby dispensary information. Only location data is shared &mdash; no personal identity information.</li>
              <li>AI-generated content (effect predictions, strain analyses) may contain inaccuracies. All AI outputs are for informational purposes only.</li>
              <li>We do not sell, share, or provide your quiz responses or preference data to any third-party AI training datasets.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will make reasonable efforts to notify you of material changes via email or in-app notification. Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">14. Contact</h2>
            <p>
              Questions about privacy? Contact us at <a href="mailto:mystrainplus@gmail.com" className="text-leaf-500 hover:text-leaf-400">mystrainplus@gmail.com</a>.
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
          <span>MyStrainAI &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
