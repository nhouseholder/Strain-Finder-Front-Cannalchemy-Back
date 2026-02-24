import { Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle'

export default function TermsPage() {
  usePageTitle('Terms of Service')

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
          Terms of Service
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#5a6a5e] mb-8">Last updated: February 23, 2026</p>

        <section className="space-y-6 text-sm text-gray-600 dark:text-[#8a9a8e] leading-relaxed">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Strain Finder ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. You must be at least 21 years of age to use this Service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">2. Service Description</h2>
            <p>
              Strain Finder provides AI-powered cannabis strain recommendations based on molecular and pharmacological data. The Service includes a quiz-based matching engine, strain comparison tools, a personal journal, and dispensary search functionality.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">3. Not Medical Advice</h2>
            <p>
              <strong className="text-gray-900 dark:text-[#e8f0ea]">The Service does not provide medical advice.</strong> All information, recommendations, and content are for educational and informational purposes only. Strain Finder is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before using cannabis products, especially if you have a medical condition, take medications, or are pregnant or nursing.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">4. Legal Compliance</h2>
            <p>
              Cannabis laws vary by jurisdiction. You are solely responsible for understanding and complying with all applicable local, state, and federal laws regarding cannabis use, purchase, and possession. The Service does not sell, distribute, or facilitate the sale of cannabis products. Strain Finder makes no claims regarding the legality of cannabis in your jurisdiction.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">5. Age Requirement</h2>
            <p>
              You must be at least 21 years of age to create an account or use the Service. By using the Service, you represent and warrant that you meet this age requirement.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">6. Accounts & Subscriptions</h2>
            <p>
              You may create a free account or subscribe to our Premium plan ($0.99/month). Premium subscriptions are billed monthly through Stripe. You may cancel at any time through the subscription management portal in your dashboard. Cancellations take effect at the end of the current billing period. Refunds are handled on a case-by-case basis.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">7. User Conduct</h2>
            <p>
              You agree not to: (a) use the Service for any illegal purpose; (b) attempt to reverse-engineer, scrape, or abuse the Service; (c) share your account credentials; (d) submit false or misleading information.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">8. Data Accuracy</h2>
            <p>
              While we strive for accuracy, strain data including cannabinoid percentages, terpene profiles, and effect predictions are estimates based on aggregated sources and may vary from actual products. Always verify product details with your dispensary.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">9. Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, Strain Finder shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service or reliance on any information provided.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">10. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms. Material changes will be communicated via email or in-app notification.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">11. Contact</h2>
            <p>
              Questions about these Terms? Contact us at <a href="mailto:support@strainfinder.app" className="text-leaf-500 hover:text-leaf-400">support@strainfinder.app</a>.
            </p>
          </div>
        </section>
      </article>

      <footer className="text-center py-8 border-t border-gray-200/50 dark:border-white/[0.04]">
        <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 dark:text-[#3a4a3e]">
          <Link to="/" className="hover:text-gray-600 dark:hover:text-[#6a7a6e] transition-colors">Home</Link>
          <span>&middot;</span>
          <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-[#6a7a6e] transition-colors">Privacy Policy</Link>
          <span>&middot;</span>
          <span>Strain Finder &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
