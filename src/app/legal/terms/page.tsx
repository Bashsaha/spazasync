import type { Metadata } from 'next'
import { PageHeader, Card, SectionHeader, Callout } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Terms of Service — Movestock',
  description: 'The terms for using the Movestock app.',
}

const LAST_UPDATED = '22 May 2026'
const SUPPORT_EMAIL = 'hello@movestock.co.za'

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700 mb-3">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

export default function TermsOfServicePage() {
  return (
    <div>
      <PageHeader title="Terms of Service" subtitle={`Last updated ${LAST_UPDATED}`} />

      <Callout tone="brand" className="mb-6">
        These terms explain what you can expect from Movestock and what we expect
        from you. By using the app, you agree to them. We&rsquo;ve kept them as
        short and plain as we can.
      </Callout>

      <Card padding="lg" className="space-y-6">
        <section>
          <SectionHeader title="1. About Movestock" />
          <P>
            Movestock is a tool that helps spaza shop and small retail owners track
            sales and stock, run a daily summary, and work towards compliance. It
            is operated by <strong>Veyon</strong>.
          </P>
        </section>

        <section>
          <SectionHeader title="2. Your account" />
          <P>
            You are responsible for keeping your login details safe and for any
            activity under your account. As a shop owner, you are responsible for
            the staff (tellers) you add and for the actions they take in the app.
            Tell us straight away if you think someone has access they
            shouldn&rsquo;t.
          </P>
        </section>

        <section>
          <SectionHeader title="3. Acceptable use" />
          <P>You agree not to:</P>
          <Bullets
            items={[
              'Use Movestock for anything illegal, or to record or trade illegal goods.',
              'Try to break into, overload, or interfere with the app or other shops’ data.',
              'Share your access with people who are not authorised to use your shop’s account.',
            ]}
          />
        </section>

        <section>
          <SectionHeader title="4. Subscription and payment" />
          <P>
            Movestock is a paid subscription after any free trial period. Payments
            are processed securely by our payment provider (PayFast). If your
            subscription is not paid, your access may be limited until it is
            renewed. You can stop using the service at any time; fees already paid
            are not refundable except where the law requires.
          </P>
        </section>

        <section>
          <SectionHeader title="5. Compliance information — important" />
          <P>
            Movestock helps you understand and work towards South African
            compliance requirements (such as permits, certificates, and the Spaza
            Shop Support Fund). This information is provided to help you and is
            drawn from public, official sources, but:
          </P>
          <Bullets
            items={[
              'It is general guidance, not legal, tax, or professional advice.',
              'Rules, fees, and deadlines set by government and municipalities can change at any time.',
              'You should always confirm the current requirements with the relevant authority before acting.',
            ]}
          />
          <P>
            Movestock does not submit applications on your behalf and is not
            responsible for the outcome of any application you make to a
            municipality, SARS, CIPC, SEDFA, or any other body.
          </P>
        </section>

        <section>
          <SectionHeader title="6. Your data and records" />
          <P>
            We take care to store your data securely (see our Privacy Policy), but
            you are responsible for the accuracy of what you enter and for keeping
            your own records where the law requires. Sales made while offline are
            saved on your device and sync when you reconnect — keep your device and
            connection in good order so nothing is lost.
          </P>
        </section>

        <section>
          <SectionHeader title="7. Availability" />
          <P>
            We work hard to keep Movestock running, but we cannot guarantee it will
            always be available or error-free. We may update, change, or pause
            parts of the app to improve it or for maintenance.
          </P>
        </section>

        <section>
          <SectionHeader title="8. Limitation of liability" />
          <P>
            To the extent allowed by law, Movestock and Veyon are not liable for
            any indirect or consequential loss arising from your use of the app,
            including lost profits or lost data. Nothing in these terms limits any
            rights you have under South African consumer law that cannot be limited.
          </P>
        </section>

        <section>
          <SectionHeader title="9. Ending your use" />
          <P>
            You can delete your account at any time from{' '}
            <strong>Settings → Danger zone</strong>. We may suspend or end access
            if these terms are broken. When an account is deleted, its data is
            permanently removed as described in the Privacy Policy.
          </P>
        </section>

        <section>
          <SectionHeader title="10. Changes to these terms" />
          <P>
            We may update these terms from time to time. We&rsquo;ll update the
            date at the top of this page and let you know in the app when changes
            are significant. Continuing to use Movestock means you accept the
            updated terms.
          </P>
        </section>

        <section>
          <SectionHeader title="11. Governing law" />
          <P>
            These terms are governed by the laws of the Republic of South Africa.
          </P>
        </section>

        <section>
          <SectionHeader title="12. Contact us" />
          <P>
            Questions about these terms? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </P>
        </section>
      </Card>
    </div>
  )
}
