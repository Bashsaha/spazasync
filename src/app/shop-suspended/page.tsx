import { redirect } from 'next/navigation'
import { Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { getShopForRequest } from '@/lib/db/shop'
import { isSubscriptionExpired, subscriptionEndDate } from '@/lib/subscription/expiry'
import { Card } from '@/components/ui'
import { ShopSuspendedActions } from './ShopSuspendedActions'

/**
 * Teller-facing lockout screen shown when the shop's subscription has ended.
 *
 * Deliberately a TOP-LEVEL route (outside the (app) group): the (app) layout
 * redirects an expired teller here, and because this page has its own layout
 * tree the (app) layout never re-runs for it — so there is no redirect loop
 * (BUG-047). No app chrome (BottomNav/FAB), no payment CTA (tellers can't pay).
 *
 * Self-healing: re-reads the LIVE shop row and, if the subscription is active
 * again (owner resubscribed), sends the teller back to /sale. Expired→stay,
 * active→/sale: each shop state redirects in exactly one direction, so it can
 * never bounce against the (app) layout's /sale→/shop-suspended redirect.
 */
export default async function ShopSuspendedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = (user.app_metadata?.role as string) ?? 'owner'
  // Only tellers belong here. Owners/admins manage billing on /subscribe; if
  // one lands here (e.g. an active owner navigating manually), send them home.
  if (role !== 'teller') redirect('/dashboard')

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (shopId) {
    const shop = await getShopForRequest(shopId, supabase)
    if (shop) {
      const expired = isSubscriptionExpired({
        status: shop.subscription_status,
        subUntil: subscriptionEndDate(
          shop.subscription_status,
          shop.trial_ends_at,
          shop.subscription_ends_at,
        ),
        accessGranted: shop.access_granted,
      })
      if (!expired) redirect('/sale')
    }
  }

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['common'])

  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card padding="lg" className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Lock className="h-8 w-8 text-amber-600" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('shop_suspended_title')}</h1>
          <p className="text-gray-700">{t('shop_suspended_body')}</p>
          <p className="text-sm text-gray-500">{t('shop_suspended_hint')}</p>
          <div className="pt-2">
            <ShopSuspendedActions
              label={t('switch_user')}
              loadingLabel={t('signing_out')}
            />
          </div>
        </Card>
      </div>
    </main>
  )
}
