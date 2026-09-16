# Google Ads: verification + Standard Access submission guide

Rankkw now has everything Google's Required Minimum Functionality (RMF) asks for on Search campaigns:
connect your own account, create campaigns, manage them, reports, conversion tracking and callouts.
Follow these steps in order. Nothing here costs money.

---

## 1. Deploy and secure (do first)

1. Deploy the latest code to rankkw.com.
2. Replace the secrets that were pasted in chat (client secret, Ads refresh token, developer token).
3. Production env (server):
   - `GOOGLE_ADS_BETA_EMAILS=` the reviewer account email from step 2 (comma-separate more emails).
     Admin accounts always have access.
   - Leave `GOOGLE_ADS_MANAGE_PUBLIC` **unset** until step 5 is approved (unverified apps are capped at
     100 users for the life of the project).
4. Google Cloud → Credentials → OAuth client `873206916710-pk8g…` must include
   `https://rankkw.com/api/google-ads/connect/callback` (already added).

## 2. Reviewer account (used by both Google reviews)

1. Create a Gmail you control for reviews, e.g. `rankkw.review@gmail.com`.
2. Register it on https://rankkw.com and give it the Enterprise plan in Admin → Users.
3. Add it to `GOOGLE_ADS_BETA_EMAILS` and redeploy/restart.
4. Log in to rankkw.com as the reviewer → Dashboard → **Google Ads** → **Connect Google Ads** →
   choose `ayesharafiq825@gmail.com` (the TEST account login) → allow.
5. Create one sample campaign (Manual CPC is fine), add a callout and a conversion action, so every
   screen has data to look at. Test accounts never spend money.

Give reviewers only this reviewer login, never your admin login.

## 3. Branding (Google Auth Platform → Branding)

| Field | Value |
|---|---|
| App name | Rankkw |
| User support email | rankkwoffical@gmail.com |
| App logo | Rankkw logo, square PNG 120x120 |
| Application home page | https://rankkw.com |
| Privacy policy | https://rankkw.com/privacy |
| Terms of service | https://rankkw.com/terms |
| Authorized domains | rankkw.com |
| Developer contact | rankkwoffical@gmail.com |

Verify ownership of `rankkw.com` in Google Search Console with the **same Google account** that owns the
Cloud project (Google checks this during verification).

## 4. Demo video (for OAuth verification)

Record on the **live site** (rankkw.com), in English, 3 to 5 minutes, and upload to YouTube as **Unlisted**.

1. Open https://rankkw.com, scroll to the footer and click **Privacy Policy** (show section 7, Google Ads).
2. Log in with the reviewer account. Open **Google Ads** in the sidebar.
3. Click **Connect Google Ads**. On Google's consent screen, **zoom into the browser address bar** so the
   `client_id=873206916710-...` is readable, and show the "See, edit, create, and delete your Google Ads
   accounts and data" permission. Click Continue/Allow.
4. Back in Rankkw: show the connected Google email and the account picker.
5. **Reports:** click Overview, Campaigns, Ads, Keywords (point at First page CPC / First position CPC),
   Search terms, Bidding strategies. Change the date range once.
6. **Create:** click **+ New campaign**, go through Campaign (budget, bidding), Targeting (countries,
   language), Keywords (keywords with match types, negative keywords), Ad (headlines, descriptions,
   final URL, preview), Review → **Check with Google** → **Create campaign (paused)**.
7. **Manage:** on the new campaign click **Edit**, change the budget and a country, Save. Click
   **Enable**, then **Pause**. In Keywords, pause one keyword and click **+ Add keywords**.
8. **Conversion tracking:** create a website conversion action and click **Show tag**.
9. **Callouts:** add two callouts.
10. **Keyword research → ads:** Dashboard → Keywords, search a keyword, click **Advertise on Google**
    and show the wizard pre-filled.
11. **Disconnect:** click **Disconnect** and confirm. Say that this revokes access at Google.

## 5. Submit OAuth verification (Google Auth Platform → Verification center)

1. Click **Prepare for verification** and confirm the branding from step 3.
2. Scope: `https://www.googleapis.com/auth/adwords`. The justification is already saved on Data access.
3. Demo video: the unlisted YouTube link from step 4.
4. Submit. Google emails rankkwoffical@gmail.com; answer quickly. Sensitive-scope reviews usually take
   a few days to a few weeks.
5. When approved, set `GOOGLE_ADS_MANAGE_PUBLIC=true` in production and restart. The Google Ads tab
   then appears for every user.

## 6. Re-apply for Standard Access

Google Cloud Console → Google Ads API → Access levels → **Manage** → **Start application**.
Do **not** use "Apply selected fields" from old cases.

| Question | Answer |
|---|---|
| 1. Cloud project number | `873206916710` |
| 2. Contact email | `rankkwoffical@gmail.com` |
| 3. Relationship with a Google rep | No |
| 4. Company website | `https://rankkw.com` |
| 5. Business model, tool, audience | See text below |
| 6. Design documentation | `docs/google-ads/Rankkw-Google-Ads-API-Design-Document-v2.pdf` |
| 7. Accessible to users outside your organization | Yes |
| 8. Token used with a tool developed by someone else | No |
| 9. Campaign types | `Search` |
| 10. Capabilities | Campaign Creation, Campaign Management, Reporting, Keyword Planning Services |
| 11. Public homepage | `https://rankkw.com` |

**Question 5 text:**

> Rankkw is a subscription SaaS for Etsy sellers and small e-commerce businesses (free and paid monthly
> plans). It combines keyword research with Google Ads management. Users connect their own Google Ads
> accounts with Google OAuth and, inside Rankkw, create Search campaigns (budget, geo and language
> targeting, Maximize Conversions / Target CPA / Target ROAS standard and portfolio bidding, ad groups,
> keywords with match types, campaign negative keywords, responsive search ads), set up website and call
> conversion tracking and account-level callouts, edit campaign settings and bidding, pause/enable/remove
> campaigns, ads and keywords, and view reports at account, campaign, ad, keyword (including first page
> and first position CPC), search term and bidding strategy level. Keyword Planner data (search volume,
> competition, keyword ideas) helps sellers choose keywords and feeds directly into the campaign wizard.
> Campaigns are created paused and nothing changes without the user's action. Audience: independent
> Etsy sellers and small online shops advertising their own businesses. We need Standard Access because
> keyword research across our user base plus daily campaign management exceeds the 15,000 daily
> operations of Basic Access, even with 30-day caching of Keyword Planner results.

If asked for access: give the reviewer login from step 2 and say it is connected to a Google Ads **test**
account, so reviewers can create, edit and remove freely without spending money.

## 7. After approval

- Standard Access needs no code change (same developer token).
- Keep watching Google Cloud → APIs & Services → Google Ads API → Metrics: errors should stay near 0%.
