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
          <span className="bg-gradient-to-r from-leaf-500 to-leaf-400 bg-clip-text text-transparent">MyStrain+</span>
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
              By accessing or using MyStrain+ ("the Service," "we," "us," or "our"), you ("User," "you," or "your") agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, do not access or use the Service. You must be at least 21 years of age to use this Service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">2. Service Description</h2>
            <p>
              MyStrain+ is a free informational platform that provides cannabis strain information based on publicly available community-reported data, terpene profiles, and cannabinoid compositions. The Service includes a quiz-based informational tool, strain comparison features, a personal journal, and educational content. <strong className="text-gray-900 dark:text-[#e8f0ea]">The Service is provided free of charge. MyStrain+ does not sell, distribute, deliver, or facilitate the sale or delivery of any cannabis products.</strong>
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">3. Not Medical, Legal, or Professional Advice</h2>
            <p>
              <strong className="text-gray-900 dark:text-[#e8f0ea]">THE SERVICE DOES NOT PROVIDE MEDICAL ADVICE, DIAGNOSES, OR TREATMENT RECOMMENDATIONS.</strong> All information, content, strain descriptions, effect predictions, and recommendations presented on MyStrain+ are for <strong className="text-gray-900 dark:text-[#e8f0ea]">general educational and informational purposes only</strong>. They are based on aggregated community-reported data and publicly available research, and do not constitute medical, legal, or professional advice of any kind.
            </p>
            <p className="mt-2">
              No information on this Service should be interpreted as a claim that any cannabis strain or product can treat, cure, prevent, or diagnose any disease or medical condition. Individual experiences with cannabis vary widely based on personal physiology, tolerance, dosage, product quality, and other factors.
            </p>
            <p className="mt-2">
              <strong className="text-gray-900 dark:text-[#e8f0ea]">Always consult a qualified healthcare provider</strong> before using any cannabis product, especially if you have a medical condition, take prescription medications, are pregnant or nursing, or have a history of substance use disorder.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">4. Legal Compliance & User Responsibility</h2>
            <p>
              Cannabis remains a Schedule I controlled substance under United States federal law (21 U.S.C. § 812). State, local, and international laws regarding cannabis use, possession, purchase, and cultivation vary significantly by jurisdiction.
            </p>
            <p className="mt-2">
              <strong className="text-gray-900 dark:text-[#e8f0ea]">You are solely and exclusively responsible</strong> for understanding and complying with all applicable local, state, federal, and international laws in your jurisdiction. The Service does not encourage, facilitate, or advise any illegal activity. Use of this Service does not constitute legal permission to purchase, possess, or consume cannabis in any jurisdiction.
            </p>
            <p className="mt-2">
              MyStrain+ makes no representation or warranty that the information provided is legal, appropriate, or applicable in your jurisdiction.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">5. Age Requirement</h2>
            <p>
              You must be at least 21 years of age to create an account or use the Service. By using the Service, you represent and warrant that you are at least 21 years old and have the legal capacity to enter into these Terms. If we learn that a user is under 21, we will immediately terminate their account.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">6. Assumption of Risk</h2>
            <p>
              <strong className="text-gray-900 dark:text-[#e8f0ea]">You expressly acknowledge and agree that your use of the Service and any decisions you make regarding cannabis are at your sole risk.</strong> Cannabis use carries inherent risks including but not limited to: impaired cognitive and motor function, adverse psychological reactions, drug interactions, addiction, and legal consequences.
            </p>
            <p className="mt-2">
              You assume full responsibility for any and all consequences arising from your use of the Service or any cannabis-related decisions made with or without reference to the information provided by the Service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">7. Accounts</h2>
            <p>
              You may create a free account to access the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">8. User Conduct</h2>
            <p>
              You agree not to: (a) use the Service for any unlawful purpose; (b) attempt to reverse-engineer, scrape, or abuse the Service; (c) share your account credentials with others; (d) submit false or misleading information; (e) use the Service in any way that could damage, disable, or impair the Service; (f) use the Service to promote or facilitate the illegal sale or distribution of cannabis.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">9. Data Accuracy & No Warranties</h2>
            <p>
              Strain data including cannabinoid percentages, terpene profiles, effect descriptions, and community reviews are <strong className="text-gray-900 dark:text-[#e8f0ea]">estimates and approximations</strong> based on aggregated community-reported data and publicly available sources. Actual cannabis products vary significantly by grower, batch, harvest, curing process, and testing methodology. <strong className="text-gray-900 dark:text-[#e8f0ea]">Always verify product details directly with your licensed dispensary and review lab-tested Certificates of Analysis (COAs) before purchasing or consuming any product.</strong>
            </p>
            <p className="mt-2">
              We do not guarantee the accuracy, completeness, reliability, or currentness of any information on the Service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">10. Disclaimer of Warranties</h2>
            <p>
              <strong className="text-gray-900 dark:text-[#e8f0ea]">THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.</strong> To the fullest extent permitted by applicable law, MyStrain+ disclaims all warranties, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement.
            </p>
            <p className="mt-2">
              We do not warrant that (a) the Service will meet your requirements; (b) the Service will be uninterrupted, timely, secure, or error-free; (c) the information provided through the Service will be accurate, reliable, or complete; or (d) any defects in the Service will be corrected.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">11. Limitation of Liability</h2>
            <p>
              <strong className="text-gray-900 dark:text-[#e8f0ea]">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL MYSTRAIN+, ITS OWNERS, OPERATORS, AFFILIATES, OR CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES</strong>, including but not limited to damages for loss of profits, goodwill, use, data, or other intangible losses, arising out of or in connection with: (a) your use of or inability to use the Service; (b) any information provided by the Service; (c) any cannabis-related decision or action taken by you; (d) any adverse health outcomes, legal consequences, or other damages resulting from cannabis use; or (e) any unauthorized access to your account or data.
            </p>
            <p className="mt-2">
              Our total aggregate liability for all claims arising from or relating to these Terms or the Service shall not exceed the amount you have paid us in the twelve (12) months preceding the claim, or ten dollars ($10.00), whichever is greater.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless MyStrain+ and its owners, operators, affiliates, and contributors from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; (d) any cannabis-related decision, purchase, or consumption; or (e) any claim that your use of the Service caused harm to you or any third party.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">13. Intellectual Property</h2>
            <p>
              All content, design, code, logos, trademarks, and other intellectual property on the Service are owned by or licensed to MyStrain+. You may not copy, modify, distribute, sell, or lease any part of the Service without prior written consent. Community-reported data is aggregated from publicly available sources and is not claimed as proprietary.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">14. Dispute Resolution & Arbitration</h2>
            <p>
              Any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall be resolved through binding individual arbitration administered by the American Arbitration Association ("AAA") under its Consumer Arbitration Rules. Arbitration shall take place in the state of the Service operator's principal place of business.
            </p>
            <p className="mt-2">
              <strong className="text-gray-900 dark:text-[#e8f0ea]">You agree that any claims will be brought in your individual capacity, and not as a plaintiff or class member in any purported class, consolidated, or representative proceeding.</strong> The arbitrator may not consolidate more than one person's claims.
            </p>
            <p className="mt-2">
              Notwithstanding the above, either party may bring an individual action in small claims court for disputes within the court's jurisdiction.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">15. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions. To the extent litigation is permitted under these Terms, you consent to the exclusive jurisdiction of the state and federal courts located in the State of California.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">16. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid by a court of competent jurisdiction, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">17. Changes to Terms</h2>
            <p>
              We reserve the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the updated Terms. We will make reasonable efforts to notify you of material changes via email or in-app notification, but it is your responsibility to review these Terms periodically.
            </p>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-[#e8f0ea] mb-2">18. Contact</h2>
            <p>
              Questions about these Terms? Contact us at <a href="mailto:mystrainplus@gmail.com" className="text-leaf-500 hover:text-leaf-400">mystrainplus@gmail.com</a>.
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
          <span>MyStrain+ &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
