import { redirect } from 'next/navigation'

// Short, shareable URL (emails, support replies) for the dashboard's Notifications page.
// /dashboard is login-gated in the proxy, so signed-out visitors land on login first.
export default function NotificationsRedirect() {
  redirect('/dashboard?tab=notifications')
}
