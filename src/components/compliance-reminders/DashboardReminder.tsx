import { getDashboardReminder } from '@/lib/db/reminders'
import { ReminderBanner } from './ReminderBanner'

interface DashboardReminderProps {
  shopId: string
  userId: string
}

/**
 * Server component — resolves the highest-priority reminder for this owner
 * and renders the banner. Returns null when nothing's eligible.
 */
export async function DashboardReminder({
  shopId,
  userId,
}: DashboardReminderProps) {
  const reminder = await getDashboardReminder(shopId, userId)
  if (!reminder) return null
  return <ReminderBanner reminder={reminder} />
}
