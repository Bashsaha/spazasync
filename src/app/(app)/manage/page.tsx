import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Map, ClipboardList } from 'lucide-react'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function ManageHubPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['manage'])

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('hint')}</p>
      </div>

      <div className="space-y-3">
        <Link
          href="/tellers"
          data-tour="manage-staff"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_staff')}</p>
            <p className="text-gray-400 text-sm">{t('card_staff_desc')}</p>
          </div>
          <Users className="w-7 h-7 text-brand" strokeWidth={1.75} />
        </Link>

        <Link
          href="/compliance/journey"
          data-tour="manage-journey"
          className="flex items-center justify-between bg-brand-light rounded-2xl p-5 border border-brand-light active:bg-brand-light"
        >
          <div>
            <p className="font-bold text-brand-hover">{t('card_journey')}</p>
            <p className="text-brand-hover text-sm">{t('card_journey_desc')}</p>
          </div>
          <Map className="w-7 h-7 text-brand-hover" strokeWidth={1.75} />
        </Link>

        <Link
          href="/inspection"
          data-tour="manage-compliance"
          className="flex items-center justify-between bg-brand-light rounded-2xl p-5 border border-brand-light active:bg-brand-light"
        >
          <div>
            <p className="font-bold text-brand-hover">{t('card_compliance')}</p>
            <p className="text-brand text-sm">{t('card_compliance_desc')}</p>
          </div>
          <ClipboardList className="w-7 h-7 text-brand-hover" strokeWidth={1.75} />
        </Link>
      </div>
    </main>
  )
}
