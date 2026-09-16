'use client'
/**
 * Google Ads: connect your OWN Google Ads account and work with its Search campaigns
 * from Rankkw: connect, pick an account, and see full reports (account, campaigns,
 * ads, keywords, search terms, bidding strategies). Creating and managing campaigns
 * builds on this connection.
 */
import { useCallback, useEffect, useState } from 'react'
import { C } from '@/utils'
import { Card, EmptyState, primaryBtn } from '../kit'
import { toast } from '@/components/ui/toast'
import { ReportsPanel } from '../googleads/Reports'
import { CreateCampaignWizard, GADS_PREFILL_KEY } from '../googleads/CreateCampaign'

interface AccountRef { customerId: string; display: string; name: string; currency: string | null; timeZone: string | null; testAccount: boolean; loginCustomerId: string | null }
interface Connection {
  enabled: boolean
  connected?: boolean
  googleEmail?: string | null
  accounts?: AccountRef[]
  selectedCustomerId?: string | null
  needsReconnect?: boolean
  lastError?: string | null
}
// Messages for the ?gads= result the OAuth callback redirects back with.
const RETURN_MESSAGES: Record<string, { ok: boolean; title: string; body: string }> = {
  connected:   { ok: true,  title: 'Google Ads connected', body: 'Your Google Ads accounts are now linked to Rankkw.' },
  noaccounts:  { ok: false, title: 'No Google Ads accounts found', body: 'That Google login has no Google Ads accounts you can manage. Sign in with the Google account that owns your ads.' },
  denied:      { ok: false, title: 'Connection cancelled', body: 'Google Ads was not connected.' },
  scope:       { ok: false, title: 'Permission not granted', body: 'Please allow Rankkw to manage your Google Ads campaigns on the Google screen.' },
  state:       { ok: false, title: 'Connection expired', body: 'Please click Connect Google Ads again.' },
  norefresh:   { ok: false, title: 'Connection incomplete', body: 'Google did not return long-term access. Please try connecting again.' },
  failed:      { ok: false, title: 'Could not connect Google Ads', body: 'Something went wrong talking to Google. Please try again.' },
  unavailable: { ok: false, title: 'Not available yet', body: 'Google Ads management is not enabled for your account yet.' },
}


export function GoogleAdsTab() {
  const [conn, setConn] = useState<Connection | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [reportsVersion, setReportsVersion] = useState(0)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/google-ads/connection', { cache: 'no-store' })
      const j = await r.json()
      setConn(j?.success ? j.data : { enabled: false })
    } catch { setConn({ enabled: false }) }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    try { if (sessionStorage.getItem(GADS_PREFILL_KEY)) setCreating(true) } catch { /* storage blocked */ }
    // Show the result of the Google consent round-trip once, then clean the URL.
    const params = new URLSearchParams(window.location.search)
    const code = params.get('gads')
    if (code && RETURN_MESSAGES[code]) {
      const m = RETURN_MESSAGES[code]
      if (m.ok) toast.success(m.title, m.body); else toast.error(m.title, m.body)
      params.delete('gads')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [load])

  const selectAccount = async (customerId: string) => {
    setBusy(true)
    try {
      const r = await fetch('/api/google-ads/connection', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId }) })
      const j = await r.json()
      if (r.ok && j?.success) { setConn(j.data); toast.success('Account selected') }
      else toast.error('Could not select account', j?.error)
    } catch { toast.error('Could not select account', 'Network error. Please try again.') }
    finally { setBusy(false) }
  }

  const refreshAccounts = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/google-ads/accounts', { method: 'POST' })
      const j = await r.json()
      if (r.ok && j?.success) { setConn(j.data); toast.success('Accounts refreshed', `${j.data.accounts?.length ?? 0} account(s) found.`) }
      else toast.error('Could not refresh accounts', j?.error)
    } catch { toast.error('Could not refresh accounts', 'Network error. Please try again.') }
    finally { setBusy(false) }
  }

  const disconnectAds = async () => {
    if (!window.confirm('Disconnect Google Ads? Rankkw will lose access to your Google Ads accounts. Your campaigns in Google Ads are not changed.')) return
    setBusy(true)
    try {
      const r = await fetch('/api/google-ads/connection', { method: 'DELETE' })
      if (r.ok) { toast.success('Google Ads disconnected'); await load() }
      else toast.error('Could not disconnect', 'Please try again.')
    } catch { toast.error('Could not disconnect', 'Network error. Please try again.') }
    finally { setBusy(false) }
  }

  if (!conn) return <Card><div className="shimmer" style={{ height: 200, borderRadius: 8, background: '#e8e7e2' }} /></Card>

  if (!conn.enabled) {
    return <Card><EmptyState icon="🔒" title="Google Ads management is coming soon" sub="Connecting your own Google Ads account is not available for your account yet." /></Card>
  }

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!conn.connected || conn.needsReconnect) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
        <Card pad={30}>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <GoogleAdsMark />
            <div style={{ flex: 1, minWidth: 260 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
                {conn.needsReconnect ? 'Reconnect Google Ads' : 'Connect your Google Ads account'}
              </h2>
              <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.65, margin: '8px 0 16px' }}>
                {conn.needsReconnect
                  ? (conn.lastError || 'Google access was revoked or expired. Reconnect to keep managing your campaigns.')
                  : 'Run Google Search ads for your Etsy shop without leaving Rankkw: create campaigns from the keywords you research, manage budgets and bidding, pause or enable ads and keywords, and see clicks, cost and conversions.'}
              </p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 18, color: C.graphite, fontSize: 13.5, lineHeight: 1.8 }}>
                <li>You sign in with Google and choose which account to use.</li>
                <li>Rankkw only acts when you click; nothing is changed automatically.</li>
                <li>Disconnect any time. Your campaigns stay in Google Ads.</li>
              </ul>
              {/* Full-page navigation on purpose: this API route redirects to Google's consent screen. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/google-ads/connect" style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <GoogleG /> {conn.needsReconnect ? 'Reconnect Google Ads' : 'Connect Google Ads'}
              </a>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const accounts = conn.accounts ?? []
  const selected = accounts.find(a => a.customerId === conn.selectedCustomerId) ?? null

  // ── Connected ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <GoogleAdsMark size={40} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: 0 }}>Google Ads connected</p>
            <p style={{ fontSize: 13, color: C.graphite, margin: '3px 0 0' }}>{conn.googleEmail ? `Signed in as ${conn.googleEmail}` : 'Signed in with Google'} · {accounts.length} account{accounts.length === 1 ? '' : 's'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={conn.selectedCustomerId ?? ''} disabled={busy || !accounts.length} onChange={e => e.target.value && selectAccount(e.target.value)}
              aria-label="Google Ads account"
              style={{ height: 38, borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', padding: '0 10px', minWidth: 240 }}>
              {!selected && <option value="">Choose an account…</option>}
              {accounts.map(a => (
                <option key={a.customerId} value={a.customerId}>{a.name} ({a.display}){a.testAccount ? ' · TEST' : ''}</option>
              ))}
            </select>
            {selected && !creating && (
              <button onClick={() => setCreating(true)} style={{ ...ghostBtn, background: '#1A73E8', borderColor: '#1A73E8', color: '#fff' }}>+ New campaign</button>
            )}
            <button onClick={refreshAccounts} disabled={busy} style={ghostBtn}>Refresh accounts</button>
            <button onClick={disconnectAds} disabled={busy} style={{ ...ghostBtn, color: C.danger, borderColor: 'rgba(207,70,58,0.35)' }}>Disconnect</button>
          </div>
        </div>
      </Card>

      {!accounts.length ? (
        <Card><EmptyState icon="📣" title="No Google Ads accounts found" sub="This Google login can't manage any Google Ads accounts. Click Refresh accounts after you get access, or reconnect with another Google login." /></Card>
      ) : !selected ? (
        <Card><EmptyState icon="📣" title="Choose an account" sub="Pick the Google Ads account you want to work with from the menu above." /></Card>
      ) : (
        creating
          ? <CreateCampaignWizard account={selected} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setReportsVersion(v => v + 1) }} />
          : <ReportsPanel key={`${selected.customerId}-${reportsVersion}`} account={selected} initialSection={reportsVersion ? 'campaigns' : 'overview'} />
      )}
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  height: 38, borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink,
  fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', padding: '0 14px', cursor: 'pointer',
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden style={{ background: '#fff', borderRadius: '50%', padding: 2 }}>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}

// Neutral "ads" mark (not Google's logo, which has brand-use restrictions).
function GoogleAdsMark({ size = 56 }: { size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: size * 0.28, background: 'linear-gradient(135deg,#E8F0FE,#FCE8E6)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </span>
  )
}
