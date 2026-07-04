import { Navbar } from '@/components/landing/Navbar'
import { AdminDashboard } from '@/components/admin/AdminDashboard'

export const metadata = { title: 'Admin — Ranktsy' }

export default function AdminPage() {
  return (
    <>
      <Navbar />
      <AdminDashboard />
    </>
  )
}
