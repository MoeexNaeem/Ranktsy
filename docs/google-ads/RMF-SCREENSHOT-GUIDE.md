# Reply to Google: demo access + annotated RMF screenshots

Google's API compliance team asked for two things before they review the Standard Access
application:
1. A way to log in to Rankkw (demo or live account).
2. Annotated screenshots showing where each Required Minimum Functionality (RMF) feature is,
   labelled with Google's own RMF IDs, like their example (R.10.1 Clicks, R.10.2 Cost ...).

Labels below use the **official IDs** from
https://developers.google.com/google-ads/api/docs/api-policy/rmf (C = Creation, M = Management,
R = Reporting). Rankkw uses KeywordPlanIdeaService, so it must implement every item marked
"Required" for Search campaigns. All of them are built and were tested live on the Google Ads test
account.

---

## 0. Before anything else

1. **Deploy the latest code.** The previous version paused ALL Google Ads calls whenever the Keyword
   Planner daily limit was hit, so a reviewer could see "quota exhausted" errors in the Google Ads tab.
   The current code only pauses Keyword Planner lookups; account management keeps working.
2. Make sure the reviewer account exists and has access (see SUBMISSION-GUIDE.md, section 2):
   registered on rankkw.com, Enterprise plan, its email in `GOOGLE_ADS_BETA_EMAILS`, and connected
   to the Google Ads **test** account (Rankkw Test Client 358-803-8249).
3. Make sure the test account has content on every screen: one campaign ("Test candles") with an ad
   group, keywords, one responsive search ad, one negative keyword, one callout, one conversion
   action, and one portfolio bidding strategy.

Take all screenshots on **https://rankkw.com**, logged in as the reviewer, browser zoom 100%, wide
window so whole tables are visible.

## 1. Screenshots to take, and what to label

Draw a red arrow to each item and write the ID next to it, exactly like Google's example.

### Creation (C)

| ID | Required feature | Where in Rankkw | File |
|---|---|---|---|
| **C.10** | Create campaign | Google Ads → "+ New campaign", step 1 (campaign name) | `C10-C120-C96-98.png` |
| **C.120** | Set budget | Same screen: "Average daily budget" field | same shot |
| **C.96** | Target CPA, standard and portfolio | Same screen: the bidding cards + "Standard / New portfolio / Existing portfolio" row + target field | same shot (select Target CPA) |
| **C.97** | Target ROAS, standard and portfolio | Same screen with Target ROAS selected | `C97.png` |
| **C.98** | Maximize Conversions, standard | Same screen with Maximize conversions selected | `C98.png` |
| **C.20** | Geo targeting | New campaign, step 2: countries chips | `C20-C30.png` |
| **C.30** | Language targeting | Same screen: languages chips | same shot |
| **C.190** | Create ad group | New campaign, step 3: "Ad group name" | `C190-C260-C270-C300.png` |
| **C.260** | Add keyword | Same screen: keywords box (also "Add keywords" on an existing ad group) | same shot |
| **C.300** | Set keyword match type | Same screen: "Default match type" buttons (broad / "phrase" / [exact]) | same shot |
| **C.270** | Campaign negative keywords | Same screen: "Negative keywords" box (also the editor on an existing campaign) | same shot |
| **C.65** | Website / call conversion + code snippet | Google Ads → Conversion tracking: "New conversion action" form ("What to track": Website / Calls from ads / Calls from your website) and an existing action with "Show tag" opened | `C65.png` |
| **C.75** | Callout extensions | Google Ads → Callouts: an existing callout and the add box | `C75.png` |

The responsive search ad (step 4 of New campaign) is not an RMF line item, but include one shot of
it (`ad-creation.png`): reviewers like to see a campaign can be completed end to end.

### Management (M)

| ID | Required feature | Where in Rankkw | File |
|---|---|---|---|
| **M.10** | Edit campaign settings | Campaigns table → "Edit" on a row → Settings (name, budget, networks, locations, languages) | `M10.png` |
| **M.96** | Edit Target CPA, standard and portfolio | Edit campaign → Bidding with Target CPA; plus "Edit target" on a portfolio strategy (Bidding strategies) | `M96.png` |
| **M.97** | Edit Target ROAS, standard and portfolio | Same, with Target ROAS | `M97.png` |
| **M.98** | Edit Maximize Conversions, standard | Edit campaign → Bidding with Maximize conversions | `M98.png` |
| **M.110** | Pause / enable / remove campaign | Campaigns table: Pause, Enable, Remove buttons on a row | `M110.png` |
| **M.130** | Pause / enable / remove ad | Ads table: the same buttons | `M130.png` |
| **M.140** | Pause / enable / remove keyword | Keywords table: the same buttons | `M140.png` |

### Reporting (R)

Number each metric like Google's example. Put the date-range picker in the shot too.

| ID | Required metrics (label each one) | Where in Rankkw | File |
|---|---|---|---|
| **R.10** Customer level | R.10.1 Clicks, R.10.2 Cost, R.10.3 Impressions, R.10.4 Conversions, R.10.5 All conversions | Google Ads → Overview tiles | `R10.png` |
| **R.20** Campaign level | R.20.1 Clicks, R.20.2 Cost, R.20.3 Impressions, R.20.4 Conversions, R.20.5 All conversions, R.20.6 Status | Campaigns table | `R20.png` |
| **R.40** Ad level | R.40.1 Clicks, R.40.2 Cost, R.40.3 Impressions, R.40.4 Conversions, R.40.5 Status | Ads table | `R40.png` |
| **R.50** Keyword level | R.50.1 Clicks, R.50.2 Cost, R.50.3 Impressions, R.50.4 Conversions, R.50.5 First page CPC, R.50.6 First position CPC, R.50.7 Status | Keywords table | `R50.png` |
| **R.70** Search terms | R.70.1 Search term, R.70.2 Match type, R.70.3 Clicks, R.70.4 Cost, R.70.5 Impressions | Search terms table | `R70.png` |
| **R.130** Bidding strategy | R.130.1 Strategy type, R.130.2 Clicks, R.130.3 Cost, R.130.4 Cost / conv., R.130.5 Impressions, R.130.6 Avg. CPC, R.130.7 Conversions, R.130.8 Status | Bidding strategies table | `R130.png` |

R.100 (Dynamic Search Ads search terms) is only required if the tool creates DSA campaigns. Rankkw
does not, so it is not applicable; say so in the email.

### Also include (not RMF IDs, but show how the tool fits together)

| Label | Where | File |
|---|---|---|
| Connect own Google Ads account | Google Ads tab top bar: "Connect Google Ads" / connected account picker | `connect-account.png` |
| Keyword planning | Dashboard → Keywords: Google search volume columns and the "Advertise on Google" button | `keyword-planning.png` |

**Zero numbers:** the demo is a Google Ads **test** account, so Google never serves its ads and every
metric is 0. Say this in the email; the labelled columns still prove each metric is implemented.

**How to annotate on Windows:** Windows+Shift+S to capture, then open in Paint (or the Snipping Tool
editor) and add red arrows and red text. Put all shots in one PDF, in the order above.

## 2. Reply email

Reply in the same Google thread (keep their case number in the subject).

```
Hello,

Thank you for the review. Below is access to our tool and annotated screenshots showing where each
Required Minimum Functionality feature is implemented, labelled with the RMF IDs.

ACCESS
Tool: https://rankkw.com
Demo login: <reviewer email>
Password: <reviewer password>
After signing in, open Dashboard, then "Google Ads" in the left sidebar (section "Advertising").
The demo account is connected to a Google Ads TEST account (Rankkw Test Client, 358-803-8249), so
you can create, edit, pause and remove campaigns freely. Because it is a test account, Google does
not serve its ads and all performance metrics show zero; the reports are fully implemented and
populate for live accounts.

ABOUT THE TOOL
Rankkw is a keyword research and Google Ads management tool for Etsy sellers and small online
shops. Users connect their own Google Ads account with OAuth and create, manage and report on
Search campaigns inside Rankkw. Supported campaign type: Search.

RMF IMPLEMENTATION (see the attached annotated screenshots)
Creation: C.10, C.20, C.30, C.65, C.75, C.96, C.97, C.98, C.120, C.190, C.260, C.270, C.300
Management: M.10, M.96, M.97, M.98, M.110, M.130, M.140
Reporting: R.10, R.20, R.40, R.50, R.70, R.130

NOT APPLICABLE / NOT IMPLEMENTED
R.100 is not applicable: the tool does not create Dynamic Search Ads campaigns.
Campaign types other than Search (Shopping, Display, Video, Performance Max, App, Hotel, Smart) are
not supported. The tool does not create Google Ads accounts or handle billing.

Our design document is attached as well. Please let us know if you need anything else.

Kind regards,
<your name>
Rankkw (Letrank Marketing)
https://rankkw.com
```

## 3. Attach

- The annotated screenshots as one PDF.
- `Rankkw-Google-Ads-API-Design-Document-v2.pdf` (this folder).
