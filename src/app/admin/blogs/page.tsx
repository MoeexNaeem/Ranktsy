import { Navbar } from '@/components/landing/Navbar'
import { BlogsAdmin } from '@/components/admin/BlogsAdmin'

export const metadata = { title: 'Blog admin - Rankkw' }

export default function AdminBlogsPage() {
  return (
    <>
      <Navbar />
      <BlogsAdmin />
    </>
  )
}
