import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function ManageHubPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['manage'])

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('hint')}</p>
      </div>

      <div className="space-y-3">
        <Link
          href="/tellers"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_staff')}</p>
            <p className="text-gray-400 text-sm">{t('card_staff_desc')}</p>
          </div>
          <span className="text-3xl">👤</span>
        </Link>

        <Link
          href="/inspection"
          className="flex items-center justify-between bg-indigo-50 rounded-2xl p-5 border border-indigo-100 shadow-sm active:bg-indigo-100"
        >
          <div>
            <p className="font-bold text-indigo-900">{t('card_compliance')}</p>
            <p className="text-indigo-600 text-sm">{t('card_compliance_desc')}</p>
          </div>
          <span className="text-3xl">📋</span>
        </Link>
      </div>
    </main>
  )
}
