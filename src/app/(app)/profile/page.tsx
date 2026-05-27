import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Store, Shield, Truck, Sparkles, Wallet, ClipboardList, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { Card, PageHeader } from '@/components/ui'
import { LogoutButton } from './LogoutButton'
import { SwitchUserButton } from './SwitchUserButton'

interface SectionRow {
  href: string
  icon: typeof Store
  labelKey: string
  descKey: string
  /** Hidden if predicate returns false; default shown. */
  visible?: boolean
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['common'])

  const role = (user.app_metadata?.role as string) ?? 'owner'
  const shopId = user.app_metadata?.shop_id as string | undefined

  // Pull shop name + code + nationality (drives the fund row visibility) in one go.
  let shopName = 'Movestock'
  let shopCode: string | null = null
  let isSACitizen = false
  let fundInterest = false
  if (shopId) {
    const { data: shop } = await supabase
      .from('shops')
      .select('name, code, fund_interest')
      .eq('id', shopId)
      .single()
    if (shop?.name) shopName = shop.name as string
    if (shop?.code) shopCode = shop.code as string
    fundInterest = Boolean(shop?.fund_interest)

    const { data: profile } = await supabase
      .from('owner_profiles')
      .select('nationality_type')
      .eq('user_id', user.id)
      .maybeSingle()
    isSACitizen = profile?.nationality_type === 'sa_citizen'
  }

  // For tellers, show their display name in place of shop name in the header.
  let tellerName: string | null = null
  if (role === 'teller') {
    const { data: teller } = await supabase
      .from('tellers')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle()
    tellerName = (teller?.name as string | undefined) ?? null
  }

  const headerName = role === 'teller' ? tellerName ?? shopName : shopName
  const initial = (headerName.trim().charAt(0) || 'M').toUpperCase()
  const roleLabel =
    role === 'admin' ? t('profile_role_admin') : role === 'teller' ? t('profile_role_teller') : t('profile_role_owner')

  // Tellers don't see most owner-only sections.
  const isOwner = role === 'owner' || role === 'admin'

  const sections: SectionRow[] = [
    {
      href: '/settings',
      icon: Store,
      labelKey: 'profile_section_shop',
      descKey: 'profile_section_shop_desc',
      visible: isOwner,
    },
    {
      href: '/compliance/journey',
      icon: Shield,
      labelKey: 'profile_section_compliance',
      descKey: 'profile_section_compliance_desc',
      visible: isOwner,
    },
    {
      href: '/suppliers',
      icon: Truck,
      labelKey: 'profile_section_suppliers',
      descKey: 'profile_section_suppliers_desc',
      visible: isOwner,
    },
    {
      href: '/waste-pest',
      icon: Sparkles,
      labelKey: 'profile_section_waste_pest',
      descKey: 'profile_section_waste_pest_desc',
      visible: isOwner,
    },
    {
      href: '/compliance/fund',
      icon: Wallet,
      labelKey: 'profile_section_fund',
      descKey: 'profile_section_fund_desc',
      visible: isOwner && isSACitizen && fundInterest,
    },
    {
      href: '/subscribe',
      icon: ClipboardList,
      labelKey: 'profile_section_subscription',
      descKey: 'profile_section_subscription_desc',
      visible: isOwner,
    },
  ]

  return (
    <main className="px-4 pt-6 pb-40 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <PageHeader title={t('profile_title')} />

      {/* Hero — avatar + name + role + shop code */}
      <Card padding="lg" className="text-center mb-4">
        <div className="w-20 h-20 rounded-full bg-brand text-white text-3xl font-bold flex items-center justify-center mx-auto mb-3">
          {initial}
        </div>
        <p className="text-lg font-bold text-gray-900 truncate">{headerName}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          {roleLabel}
          {shopCode && role !== 'teller' ? ` · ${t('profile_shop_code', { code: shopCode })}` : ''}
        </p>
        <SwitchUserButton label={t('switch_user')} loadingLabel={t('signing_out')} />
      </Card>

      {/* Section rows */}
      <Card padding="none" className="overflow-hidden mb-4 divide-y divide-gray-100">
        {sections
          .filter((s) => s.visible !== false)
          .map((row) => {
            const Icon = row.icon
            return (
              <Link
                key={row.href}
                href={row.href}
                className="flex items-center gap-4 px-4 py-3.5 active:bg-gray-50"
              >
                <Icon className="w-6 h-6 text-brand shrink-0" strokeWidth={1.75} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t(row.labelKey)}</p>
                  <p className="text-xs text-gray-500 truncate">{t(row.descKey)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" strokeWidth={1.75} />
              </Link>
            )
          })}
      </Card>

      {/* Log out */}
      <Card padding="none" className="overflow-hidden mb-6">
        <LogoutButton label={t('profile_logout')} loadingLabel={t('profile_logging_out')} />
      </Card>

      <p className="text-center text-xs text-gray-400 mb-2">
        <Link href="/legal/terms" className="underline hover:text-brand">
          {t('legal_terms')}
        </Link>
        {' · '}
        <Link href="/legal/privacy" className="underline hover:text-brand">
          {t('legal_privacy')}
        </Link>
      </p>
      <p className="text-center text-xs text-gray-400">{t('profile_footer')}</p>
    </main>
  )
}
