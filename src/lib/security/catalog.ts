/**
 * Every kind of security event Rankkw records, with how serious it is, what it
 * means in plain words, and what to do about it. Shared by the server (logging)
 * and the admin Security section (labels, explanations, fixes). No server imports.
 */
export type Severity = 'info' | 'warn' | 'high'
export type SecurityCategory = 'login' | 'signup' | 'search' | 'scraping' | 'admin' | 'blocked'

export interface EventInfo {
  label: string
  severity: Severity
  category: SecurityCategory
  meaning: string
  fix: string
}

export const SECURITY_EVENTS = {
  login_failed: {
    label: 'Wrong password', severity: 'warn', category: 'login',
    meaning: 'Someone tried to log in with a wrong password. A few are normal typos; many from one IP or against one email is password guessing.',
    fix: 'If one IP has many, block it. If one email is targeted, tell that user to change their password.',
  },
  login_rate_limited: {
    label: 'Login attempts blocked (too many)', severity: 'high', category: 'login',
    meaning: 'An IP or email hit the login attempt limit (10 per IP / 6 per email in 15 minutes). This is what password guessing looks like.',
    fix: 'Block the IP. The limit already stops it; blocking stops it from coming back.',
  },
  captcha_failed: {
    label: 'Robot check failed', severity: 'warn', category: 'login',
    meaning: 'A login or signup was sent without passing the "I am not a robot" check. Usually a script.',
    fix: 'Block the IP if it repeats.',
  },
  register_temp_mail: {
    label: 'Signup with temp mail blocked', severity: 'warn', category: 'signup',
    meaning: 'Someone tried to sign up with a throwaway email (temp-mail sites). It was refused.',
    fix: 'Nothing needed, it was blocked. Many from one IP means someone farming free accounts: block the IP.',
  },
  register_ip_limit: {
    label: 'Too many signups from one IP', severity: 'high', category: 'signup',
    meaning: 'One connection tried to create more than the daily account limit (3). Someone making accounts for free credits.',
    fix: 'Block the IP. Check the Accounts tab for other accounts from this IP and delete the fake ones.',
  },
  register_bad_domain: {
    label: 'Signup with fake email domain', severity: 'info', category: 'signup',
    meaning: 'The email domain cannot receive email (a typo like "gmial.com", or an invented domain). It was refused.',
    fix: 'Nothing needed. Usually a typo.',
  },
  register_rate_limited: {
    label: 'Signup attempts blocked (too many)', severity: 'high', category: 'signup',
    meaning: 'An IP sent too many signup requests in an hour.',
    fix: 'Block the IP.',
  },
  verify_code_wrong: {
    label: 'Wrong email code', severity: 'info', category: 'signup',
    meaning: 'A wrong 6-digit email verification code was entered.',
    fix: 'Nothing needed unless it repeats a lot from one IP.',
  },
  verify_code_locked: {
    label: 'Email code guessing stopped', severity: 'warn', category: 'signup',
    meaning: '5 wrong codes in a row, so the code was cancelled. Either a confused user or someone guessing.',
    fix: 'If one IP does this for many emails, block it.',
  },
  password_reset_limited: {
    label: 'Password reset spam blocked', severity: 'warn', category: 'login',
    meaning: 'Too many password-reset emails were requested (could be someone flooding a person’s inbox).',
    fix: 'Block the IP if it repeats.',
  },
  search_rate_limited: {
    label: 'Search limit hit', severity: 'warn', category: 'search',
    meaning: 'A user or IP hit the hourly search cap.',
    fix: 'Heavy users hit this sometimes. The same account every hour is likely a bot: restrict it.',
  },
  search_captcha: {
    label: 'Robot check shown in search', severity: 'info', category: 'search',
    meaning: 'After 25 searches the user was asked to confirm they are human.',
    fix: 'Nothing needed.',
  },
  extension_rate_limited: {
    label: 'Extension lookup limit hit', severity: 'info', category: 'search',
    meaning: 'A browser-extension user hit the hourly lookup cap.',
    fix: 'Nothing needed unless it is the same account all day (scraping with the extension).',
  },
  api_rate_limited: {
    label: 'Tool request limit hit', severity: 'warn', category: 'search',
    meaning: 'Too many requests to a tool in a short time.',
    fix: 'Restrict the account if it repeats; block the IP if there is no account.',
  },
  etsy_budget_exceeded: {
    label: 'Daily Etsy data limit hit (scraping)', severity: 'high', category: 'scraping',
    meaning: 'One account used up its daily Etsy data allowance (15,000 calls). Normal users never get close: this is scraping.',
    fix: 'Restrict the account. If it keeps happening with new accounts, block their IP.',
  },
  blocked_ip: {
    label: 'Blocked IP tried again', severity: 'high', category: 'blocked',
    meaning: 'An IP you blocked tried to use the site. It was refused.',
    fix: 'Nothing needed. If a real customer was blocked by mistake, unblock the IP.',
  },
  restricted_access: {
    label: 'Restricted user tried to use the site', severity: 'warn', category: 'blocked',
    meaning: 'An account you restricted tried to use the dashboard or tools. It was refused.',
    fix: 'Nothing needed. If they keep trying from new accounts, block their IP.',
  },
  admin_denied: {
    label: 'Admin area access denied', severity: 'high', category: 'admin',
    meaning: 'A non-admin tried to open the admin panel or admin API. Could be curiosity or someone probing.',
    fix: 'Repeated attempts from one IP: block it.',
  },
  danger_password_wrong: {
    label: 'Wrong bulk-delete password', severity: 'high', category: 'admin',
    meaning: 'Someone signed in as an admin typed the wrong password for bulk delete. After 5 wrong tries in 15 minutes it locks.',
    fix: 'If it was not you, an admin session may be stolen: change that admin\'s password and log out everywhere.',
  },
  admin_action: {
    label: 'Admin action', severity: 'info', category: 'admin',
    meaning: 'An admin changed something important (bulk delete, IP block, restriction).',
    fix: 'Just a record for the audit trail.',
  },
} satisfies Record<string, EventInfo>

export type SecurityEventType = keyof typeof SECURITY_EVENTS
export const SECURITY_TYPES = Object.keys(SECURITY_EVENTS) as SecurityEventType[]
