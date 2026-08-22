import { redirect } from 'next/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { DealsAdmin } from '@/components/admin/DealsAdmin'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const metadata = { title: 'Deals - Admin - Rankkw' }
export const dynamic = 'force-dynamic'

export default async function AdminDealsPage() {
  const user = await getCurrentUser()
  if (!isAdmin(user)) redirect('/')

  return (
    <>
      <Navbar />
      <DealsAdmin />
    </>
  )
}
