import Link from 'next/link'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function NotFound() {
  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['common'])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <div className="text-5xl mb-4">🔍</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('not_found_title')}</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        {t('not_found_desc')}
      </p>
      <Link
        href="/dashboard"
        className="bg-brand text-white font-semibold px-6 py-3 rounded-full active:bg-brand-hover"
      >
        {t('btn_goto_dashboard')}
      </Link>
    </div>
  )
}
