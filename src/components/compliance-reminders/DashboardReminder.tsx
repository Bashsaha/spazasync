import { getDashboardReminder } from '@/lib/db/reminders'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { ReminderBanner } from './ReminderBanner'

interface DashboardReminderProps {
  shopId: string
  userId: string
}

/**
 * Server component — resolves the highest-priority reminder for this owner
 * and renders the banner. Returns null when nothing's eligible.
 *
 * Translations are resolved server-side and passed in as plain strings so the
 * client banner has no async-loaded i18n on first render. Avoids the hydration
 * mismatch we hit when ReminderBanner used `useTranslation` under a Suspense
 * boundary — the LanguageProvider's useEffect would populate translations
 * before the suspended branch hydrated, so server saw the raw key while client
 * saw the resolved string.
 */
export async function DashboardReminder({
  shopId,
  userId,
}: DashboardReminderProps) {
  const reminder = await getDashboardReminder(shopId, userId)
  if (!reminder) return null

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['compliance-reminders'])

  return (
    <ReminderBanner
      reminder={reminder}
      title={t(reminder.titleKey, reminder.params)}
      body={t(reminder.bodyKey, reminder.params)}
      ctaLabel={reminder.ctaKey ? t(reminder.ctaKey, reminder.params) : undefined}
    />
  )
}
