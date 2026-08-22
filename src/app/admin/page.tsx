import { redirect } from 'next/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const metadata = { title: 'Admin - Rankkw' }
// Verify the session on the server every request - defense in depth on top of the
// admin API routes (which already enforce isAdmin) so non-admins never see the shell.
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!isAdmin(user)) redirect('/')

  return (
    <>
      <Navbar />
      <AdminDashboard />
    </>
  )
}
