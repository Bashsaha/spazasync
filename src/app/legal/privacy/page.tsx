import type { Metadata } from 'next'
import { PageHeader, Card, SectionHeader, Callout } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Privacy Policy — Movestock',
  description: 'How Movestock collects, uses, and protects your information.',
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

export default function PrivacyPolicyPage() {
  return (
    <div>
      <PageHeader title="Privacy Policy" subtitle={`Last updated ${LAST_UPDATED}`} />

      <Callout tone="brand" className="mb-6">
        Movestock is built for South African spaza shop and small retail owners.
        We keep the data we collect to the minimum we need to run the app, and we
        never sell it. This policy explains, in plain language, what we collect
        and what you can do about it.
      </Callout>

      <Card padding="lg" className="space-y-6">
        <section>
          <SectionHeader title="Who we are" />
          <P>
            Movestock is operated by <strong>Veyon</strong> (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;, &ldquo;our&rdquo;). For the purposes of the
            Protection of Personal Information Act, 2013 (POPIA), Veyon is the
            responsible party for the personal information processed through the
            Movestock app.
          </P>
          <P>
            If you have any questions about this policy or your information, email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </P>
        </section>

        <section>
          <SectionHeader title="Information we collect" />
          <P>We only collect what the app needs to work for you:</P>
          <Bullets
            items={[
              <><strong>Your account</strong> — your email address and name when you sign up as a shop owner, or your display name and a PIN when you are added as a teller.</>,
              <><strong>Your shop</strong> — the shop name, shop code, location/area, municipality, and optional details you choose to add (WhatsApp number, registration number, whether you have a fridge/freezer, whether you have employees).</>,
              <><strong>Sales and stock</strong> — the products you add, prices, stock counts, sales you record, and stock movements. This is the core of what the app is for.</>,
              <><strong>Compliance details</strong> — if you use the compliance features, information you choose to enter such as your nationality status, food-safety training, supplier and waste/pest records, and which documents you have. We do <strong>not</strong> store your ID number, passport number, or tax number — those are left blank on every form for you to fill in yourself.</>,
              <><strong>Payment</strong> — your subscription status and a payment reference. Card payments are handled by our payment provider (PayFast); we never see or store your card number.</>,
              <><strong>Technical</strong> — basic information needed to keep you signed in and to make the app work offline (a login session, your chosen language, and a local copy of your products cached on your device).</>,
            ]}
          />
        </section>

        <section>
          <SectionHeader title="How we use your information" />
          <Bullets
            items={[
              'To run the app — record sales, deduct stock, show your daily summary, and keep your data separated from every other shop.',
              'To let you log in and to keep your account secure.',
              'To process your subscription payment.',
              'To show you compliance guidance relevant to your shop and area.',
              'To fix problems and improve the app.',
            ]}
          />
          <P>
            We do not use your information for advertising, and we do not sell or
            rent it to anyone.
          </P>
        </section>

        <section>
          <SectionHeader title="Where your information is stored" />
          <P>
            Your data is stored in a secure cloud database managed by{' '}
            <strong>Supabase</strong>, and the app is hosted on{' '}
            <strong>Vercel</strong> (European Union region). Each shop&rsquo;s data
            is isolated at the database level so one shop can never see
            another&rsquo;s information.
          </P>
          <P>
            Because our infrastructure providers operate outside South Africa,
            your information may be processed in other countries. We only use
            reputable providers that apply strong security and data-protection
            standards, as allowed under section 72 of POPIA.
          </P>
        </section>

        <section>
          <SectionHeader title="Cookies and local storage" />
          <P>
            We do <strong>not</strong> use advertising or tracking cookies. The
            only things we store on your device are:
          </P>
          <Bullets
            items={[
              'A login session, so you stay signed in.',
              'Your chosen language.',
              'A local copy of your products and any sales made while offline, so the app keeps working without signal and syncs when you reconnect.',
            ]}
          />
          <P>
            These are strictly necessary for the app to function, which is why we
            don&rsquo;t show a cookie consent banner.
          </P>
        </section>

        <section>
          <SectionHeader title="Who we share it with" />
          <P>
            We only share your information with the service providers that help us
            run Movestock (our database host, app host, and payment provider), and
            only so they can perform their service. We may also disclose
            information if the law requires us to. We do not share your data for
            any other purpose.
          </P>
        </section>

        <section>
          <SectionHeader title="How long we keep it" />
          <P>
            We keep your information for as long as your account is active. If you
            delete your account, your shop and all of its data are permanently
            removed from our database. We may keep limited payment records where
            the law requires us to.
          </P>
        </section>

        <section>
          <SectionHeader title="Your rights under POPIA" />
          <P>You have the right to:</P>
          <Bullets
            items={[
              'See the personal information we hold about you. You can download a full copy of your shop’s data at any time from Settings → Your data.',
              'Ask us to correct anything that is wrong.',
              'Delete your account and data (you can do this yourself in Settings → Danger zone, or email us).',
              'Object to how we use your information.',
              'Complain to the Information Regulator if you believe we have not handled your information properly.',
            ]}
          />
          <P>
            To exercise any of these rights, email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </P>
        </section>

        <section>
          <SectionHeader title="Deleting your data" />
          <P>
            As a shop owner you can permanently delete your account at any time
            from <strong>Settings → Danger zone</strong>. This removes your shop,
            your products, sales, stock, staff, and compliance records, and frees
            up your email to sign up again later.
          </P>
        </section>

        <section>
          <SectionHeader title="Children" />
          <P>
            Movestock is a business tool intended for shop owners and their staff.
            It is not directed at children.
          </P>
        </section>

        <section>
          <SectionHeader title="Changes to this policy" />
          <P>
            If we change this policy, we will update the date at the top of this
            page. Significant changes will be communicated in the app.
          </P>
        </section>

        <section>
          <SectionHeader title="Contact us" />
          <P>
            Questions about your information? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </P>
          <P>
            You may also contact the Information Regulator (South Africa):{' '}
            <a
              href="https://inforegulator.org.za"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              inforegulator.org.za
            </a>{' '}
            — complaints email{' '}
            <a
              href="mailto:POPIAComplaints@inforegulator.org.za"
              className="text-brand underline"
            >
              POPIAComplaints@inforegulator.org.za
            </a>
            .
          </P>
        </section>
      </Card>
    </div>
  )
}
