import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * GET /auth/callback
 * Supabase redirects here after email confirmation with ?code=xxx.
 * We exchange the code for a session, then route the user appropriately.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const role = user?.app_metadata?.role as string | undefined

      // Owner who confirmed email but hasn't set up their shop yet
      if (!role) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      // Teller confirmed their email
      if (role === 'teller') {
        return NextResponse.redirect(`${origin}/sale`)
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Code missing or exchange failed — send back to login with an error hint
  return NextResponse.redirect(`${origin}/login`)
}
