import { redirect } from 'next/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { PopupAdsAdmin } from '@/components/admin/PopupAdsAdmin'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const metadata = { title: 'Popup ads — Admin — Rankkw' }
export const dynamic = 'force-dynamic'

export default async function AdminAdsPage() {
  const user = await getCurrentUser()
  if (!isAdmin(user)) redirect('/')

  return (
    <>
      <Navbar />
      <PopupAdsAdmin />
    </>
  )
}
