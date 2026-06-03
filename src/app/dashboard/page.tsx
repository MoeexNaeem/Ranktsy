'use client'
import dynamic from 'next/dynamic'

const DashboardLayout = dynamic(
  () => import('@/components/dashboard/DashboardLayout').then(m => ({ default: m.DashboardLayout })),
  { ssr: false }
)

export default function DashboardPage() {
  return <DashboardLayout />
}
