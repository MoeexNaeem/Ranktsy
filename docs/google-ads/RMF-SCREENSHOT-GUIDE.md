# Reply to Google: demo access + annotated RMF screenshots

Google's compliance team asked for two things:
1. A way to log in to Rankkw (demo or live account).
2. Annotated screenshots showing where each Required Minimum Functionality (RMF) feature is,
   labelled like their example (R.10.1, R.10.2 ...).

Take the screenshots on **https://rankkw.com** while logged in as the reviewer account, with the
**Google Ads** tab connected to the Google Ads test account (Rankkw Test Client 358-803-8249).

---

## 1. Before capturing

- Log in as the reviewer account, open **Dashboard → Google Ads**, and make sure it shows
  "Google Ads connected" with the test client selected.
- Make sure at least one campaign exists ("Test candles"), with keywords, one ad, one callout and
  one conversion action, so every screen has content.
- Zoom the browser to 100% and use a wide window so full tables are visible.

## 2. Screenshots to take, and what to label on each

Label each arrow with the code in the first column (red text is fine, exactly like Google's example).
File names in the last column keep the pack tidy.

| Label | What to point the arrow at | Screen | File name |
|---|---|---|---|
| **R.1** Create campaign | "+ New campaign" button, then the Campaign step (name field) | Google Ads → New campaign, step 1 | `R1-create-campaign.png` |
| **R.2** Set budget | "Average daily budget" field | New campaign, step 1 | `R2-budget.png` (can share R.1 shot) |
| **R.3** Bidding: Maximize Conversions / Target CPA / Target ROAS (standard + portfolio) | The four bidding cards, plus the "Standard / New portfolio / Existing portfolio" row and the target field | New campaign, step 1 | `R3-bidding.png` |
| **R.4** Geo targeting | Countries chips | New campaign, step 2 | `R4-geo-language.png` |
| **R.5** Language targeting | Languages chips | New campaign, step 2 | same shot as R.4 |
| **R.6** Create ad group | "Ad group name" field | New campaign, step 3 | `R6-adgroup-keywords.png` |
| **R.7** Add keyword + match type | Keywords box and the "Default match type" buttons | New campaign, step 3 | same shot as R.6 |
| **R.8** Campaign negative keywords | "Negative keywords" box | New campaign, step 3 | same shot as R.6 |
| **R.9** Create ad (responsive search ad) | Headlines, descriptions, final URL, preview panel | New campaign, step 4 | `R9-create-ad.png` |
| **R.10** Callout extensions | The Callouts section with an existing callout and the add box | Google Ads → Callouts | `R10-callouts.png` |
| **R.11** Conversion tracking (website + call) | "New conversion action" form showing "What to track" (Website / Calls from ads / Calls from your website) and an existing action with "Show tag" | Google Ads → Conversion tracking | `R11-conversion-tracking.png` |
| **R.12** Edit campaign settings | "Edit" button on the campaign row, then the Settings section (name, budget, networks) | Google Ads → Campaigns → Edit | `R12-edit-campaign.png` |
| **R.13** Edit bidding | Bidding section inside Edit campaign; also the "Edit target" button on a portfolio strategy | Edit campaign + Bidding strategies | `R13-edit-bidding.png` |
| **R.14** Pause / enable / remove campaign | Pause, Enable and Remove buttons on a campaign row | Google Ads → Campaigns | `R14-campaign-status.png` |
| **R.15** Pause / enable / remove ad | Same buttons on an ad row | Google Ads → Ads | `R15-ad-status.png` |
| **R.16** Pause / enable / remove keyword | Same buttons on a keyword row | Google Ads → Keywords | `R16-keyword-status.png` |
| **R.17** Reporting: account level | Clicks, Impressions, Cost, Conversions, All conversions tiles (label each metric) | Google Ads → Overview | `R17-account-reporting.png` |
| **R.18** Reporting: campaign level | Clicks, Impr., Cost, Conv., All conv. columns and the Status column | Google Ads → Campaigns | `R18-campaign-reporting.png` |
| **R.19** Reporting: ad level | Clicks, Impr., Cost, Conv. columns and the Status column | Google Ads → Ads | `R19-ad-reporting.png` |
| **R.20** Reporting: keyword level | Clicks, Impr., Cost, Conv. columns, "First page CPC", "First position CPC", Status | Google Ads → Keywords | `R20-keyword-reporting.png` |
| **R.21** Reporting: search terms | Search term, Match type, Clicks, Impr., Cost columns | Google Ads → Search terms | `R21-search-terms.png` |
| **R.22** Reporting: bidding strategy | Strategy, Status, Clicks, Impr., Avg. CPC, Cost, Conv., Cost / conv. columns | Google Ads → Bidding strategies | `R22-bidding-strategies.png` |
| **R.23** Keyword planning | "Advertise on Google" button and the Google search-volume columns | Dashboard → Keywords | `R23-keyword-planning.png` |
| **R.24** Connect your own Google Ads account | "Connect Google Ads" button / connected account picker | Google Ads (top bar) | `R24-connect-account.png` |

**Note for zero numbers:** the demo account is a Google Ads **test** account, so clicks, cost and
conversions are 0. Say this in the email; reviewers expect it. The columns still prove the metrics
are implemented.

**How to annotate on Windows:** open the PNG with Paint, or press Windows+Shift+S to capture, then
use the red arrow and text tools. Keep labels readable at 100% zoom.

## 3. Reply email to send

Reply to the same Google thread (keep the case number in the subject).

```
Hello,

Thank you for the review. Below is access to our tool and annotated screenshots showing where each
Required Minimum Functionality feature is implemented.

ACCESS
Tool: https://rankkw.com
Demo login: <reviewer email>
Password: <reviewer password>
After signing in, open Dashboard, then "Google Ads" in the left sidebar (section "Advertising").
This demo account is connected to a Google Ads TEST account (Rankkw Test Client, 358-803-8249), so
you can create, edit, pause and remove campaigns freely. Because it is a test account, Google does
not serve ads for it and all performance metrics show zero; the reports and columns are fully
implemented and populate for live accounts.

WHAT THE TOOL DOES
Rankkw is a keyword research and Google Ads management tool for Etsy sellers and small online shops.
Users connect their own Google Ads account with OAuth and manage Search campaigns inside Rankkw.
Supported campaign type: Search.

RMF IMPLEMENTATION (see attached annotated screenshots)
R.1 Create campaign, R.2 Budget, R.3 Bidding (Maximize Conversions, Target CPA and Target ROAS,
standard and portfolio), R.4 Geo targeting, R.5 Language targeting, R.6 Create ad group,
R.7 Add keyword with match type, R.8 Campaign negative keywords, R.9 Create responsive search ad,
R.10 Callout extensions, R.11 Website and call conversion tracking, R.12 Edit campaign settings,
R.13 Edit bidding (including portfolio strategy targets), R.14 to R.16 Pause / enable / remove
campaigns, ads and keywords, R.17 to R.22 Reporting at account, campaign, ad, keyword (including
first page CPC and first position CPC), search term and bidding strategy level, R.23 Keyword
planning, R.24 Connect your own Google Ads account.

NOT YET IMPLEMENTED
Campaign types other than Search (Shopping, Display, Video, Performance Max) are not supported, and
the tool does not create Google Ads accounts or handle billing.

Our design document is attached as well. Please let us know if you need anything else.

Kind regards,
<your name>
Rankkw (Letrank Marketing)
https://rankkw.com
```

## 4. Attach

- The annotated screenshots (a single PDF or a ZIP is fine).
- `Rankkw-Google-Ads-API-Design-Document-v2.pdf`.
