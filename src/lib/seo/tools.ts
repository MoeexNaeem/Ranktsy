/**
 * Programmatic-SEO content for each tool/feature landing page.
 *
 * One entry → one page at /<slug> (e.g. /keyword-research) → one <url> in
 * /features-sitemap.xml. Content is honest to what the product actually does
 * (real Etsy Open API + Google Ads data; no fabricated metrics), so these pages
 * double as accurate documentation and rank without over-promising.
 */
export interface ToolFaq { q: string; a: string }
export interface ToolStep { title: string; desc: string }

export interface ToolPage {
  slug: string
  name: string
  category: 'Research' | 'Optimize' | 'Analytics'
  /** Deep-links the primary CTA straight to the tool inside the dashboard. */
  dashTab: string
  tagline: string            // hero subheading
  intro: string              // 1–2 sentence lede
  overview: string[]         // "Overview" — 2 narrative paragraphs
  useCases: ToolStep[]       // "What you'll do with it" — real scenarios
  what: string[]             // "What it does"
  how: ToolStep[]            // "How it works"
  benefits: ToolStep[]       // "How it helps you"
  features: string[]         // quick feature chips
  faqs: ToolFaq[]
  related: string[]          // other tool slugs
  metaTitle: string
  metaDescription: string
}

export const TOOL_PAGES: ToolPage[] = [
  {
    slug: 'keyword-research',
    name: 'Keyword Research',
    category: 'Research',
    dashTab: 'keywords',
    tagline: 'Find the keywords worth ranking for — measured, not guessed.',
    intro: 'Rankkw’s Etsy keyword research tool shows the real demand and competition behind any search term, using live data from the official Etsy Open API and Google Ads Keyword Planner.',
    overview: [
      'Keyword research is where every successful Etsy listing starts. Before you write a title, choose your 13 tags, or even decide what to make, you need to know two things: how many people are actually searching for a term, and how many sellers you’ll be competing against for it. Rankkw answers both with measured data — Google Ads Keyword Planner for real monthly search demand, and the live Etsy Open API for the exact number of active listings already targeting the phrase.',
      'Instead of a single vanity “score”, you get the full picture on one screen: search volume by country, advertiser competition and CPC, the true Etsy listing count, and engagement signals — views, favorites and favorites-per-view — from the listings that genuinely rank. Related, long-tail and near-match suggestions branch out from every search, each with its own numbers, so you can steer toward the low-competition, high-intent phrases real buyers type instead of fighting over saturated head terms.',
    ],
    useCases: [
      { title: 'Validate a product idea', desc: 'Check real demand and competition before you spend hours photographing and listing — commit only to what has an audience.' },
      { title: 'Escape saturated terms', desc: 'Trade “wall art” for the specific long-tail phrases you can realistically rank for and that convert far better.' },
      { title: 'Build a keyword shortlist', desc: 'Collect winners across a session and feed them straight into the Tag Optimizer and AI generators.' },
    ],
    what: [
      'Real Google monthly search volume, advertiser competition and CPC for any keyword, with a per-country breakdown.',
      'The true number of active Etsy listings competing for the exact phrase — your real competition, not an estimate.',
      'Engagement signals from the listings that actually rank: views, favorites and favorites-per-view.',
      'Related, long-tail and near-match keywords surfaced from live Etsy search, each with its own metrics.',
    ],
    how: [
      { title: 'Enter a keyword', desc: 'Type any product idea or phrase. Pick a country if you want geo-specific Google demand.' },
      { title: 'We measure it live', desc: 'Rankkw queries the Etsy and Google APIs in parallel and probes real competition per keyword.' },
      { title: 'Read the signals', desc: 'Compare volume, competition, KD and engagement side by side to spot low-competition, high-intent terms.' },
      { title: 'Act on it', desc: 'Save winners to a list, feed them into the AI generators, or check the top-ranking listings.' },
    ],
    benefits: [
      { title: 'Target what’s reachable', desc: 'Stop competing for saturated head terms — find long-tail keywords real buyers use that you can actually rank for.' },
      { title: 'Decide before you make', desc: 'See demand and competition for a product idea before you spend hours listing it.' },
      { title: 'Trust every number', desc: 'Every figure is measured from an official API or shown as a dash. Nothing is invented.' },
    ],
    features: ['Google search volume', 'Etsy competition count', 'Keyword Difficulty (KD)', 'Favs ÷ views', 'Country filter', 'CSV export'],
    faqs: [
      { q: 'Where does the search volume come from?', a: 'From the Google Ads Keyword Planner — real monthly search demand, competition and CPC. Etsy itself publishes no search volume, so we never invent one.' },
      { q: 'Is the competition number real?', a: 'Yes — it’s the actual count of active Etsy listings for the exact keyword, pulled live from the Etsy Open API.' },
      { q: 'Do I need to connect my Etsy shop?', a: 'No. Keyword research works without connecting anything. You only connect a shop for your own private analytics.' },
      { q: 'Can I research keywords for any country?', a: 'Yes. Google demand, competition and CPC can be scoped to the US, UK, AU, CA, FR, DE, IN or shown globally.' },
    ],
    related: ['competitor-analysis', 'tag-optimizer', 'trend-analysis'],
    metaTitle: 'Etsy Keyword Research Tool — Real Search Volume & Competition | Rankkw',
    metaDescription: 'Research Etsy keywords with real Google search volume, live Etsy competition and Keyword Difficulty. No estimates, no demo data — measured from official APIs.',
  },
  {
    slug: 'competitor-analysis',
    name: 'Competitor Analysis',
    category: 'Research',
    dashTab: 'competitors',
    tagline: 'See exactly what the shops beating you are doing right.',
    intro: 'Analyze the top-ranking Etsy shops and listings for any keyword — their tags, prices, engagement and listing age — so you know what you’re up against before you list.',
    overview: [
      'Ranking on Etsy never happens in a vacuum — for every search you’re competing against specific shops and specific listings. Competitor Analysis shows you exactly who those incumbents are and what they’re doing right, so you can position against them deliberately instead of guessing. Everything comes from Etsy’s official public API: the real count of active listings, the shops that rank, and the tags, prices, quantities and listing ages behind the top results.',
      'Open any leading listing to see its full 13-tag set and the price band it sits in, then read shop-level signals — lifetime transaction counts, review totals, rating and shop age — to judge how established your competition really is. Where the incumbents show weak engagement, you’ve found an opening worth taking; where they’re strong, you’ve found the exact playbook to match and then beat.',
    ],
    useCases: [
      { title: 'Reverse-engineer winners', desc: 'Copy the tags, price points and title patterns that keep appearing across the top listings for your keyword.' },
      { title: 'Spot soft niches', desc: 'Find keywords where the leaders have low favorites-per-view — weaker competition you can outrank.' },
      { title: 'Benchmark before launch', desc: 'Know the shop age, reviews and sales volume you’re up against so your entry plan is realistic.' },
    ],
    what: [
      'The real count of active listings and the incumbents ranking for a keyword.',
      'How strongly competitors convert views into favorites (real favorites ÷ views).',
      'The exact tags, price points, quantities and listing ages the top listings use.',
      'Shop-level signals: lifetime transaction counts, reviews, rating and shop age.',
    ],
    how: [
      { title: 'Search a keyword or shop', desc: 'Start from a keyword to see who ranks, or analyze a specific competitor shop directly.' },
      { title: 'Inspect the leaders', desc: 'Sort the top-ranking listings by views, favorites, price, age or tag count.' },
      { title: 'Extract their playbook', desc: 'Open any listing to see its full tag set and copy the tags that keep appearing.' },
    ],
    benefits: [
      { title: 'Reverse-engineer winners', desc: 'Learn the tags, titles and price bands that consistently rank, then out-position them.' },
      { title: 'Find weak spots', desc: 'Spot keywords where incumbents have low engagement — an opening you can take.' },
      { title: 'No guesswork', desc: 'Every competitor metric is a real Etsy field or a ratio of two, never an estimate.' },
    ],
    features: ['Top-ranking listings', 'Competitor tags', 'Price distribution', 'Engagement rate', 'Shop lifetime sales', 'Reviews & rating'],
    faqs: [
      { q: 'Can I see a competitor’s sales?', a: 'Etsy publishes shop-lifetime transaction counts (real) but not per-listing sales — so we show the real lifetime figure and verified review counts, never a fabricated per-listing “estimated sales”.' },
      { q: 'How do I see their tags?', a: 'Open any top listing in the results and its full 13-tag set is shown — one click to copy.' },
      { q: 'Is this against Etsy’s rules?', a: 'No. All data comes from Etsy’s official public API for active listings; we don’t scrape.' },
    ],
    related: ['keyword-research', 'tag-optimizer', 'top-sellers'],
    metaTitle: 'Etsy Competitor Analysis — Tags, Prices & Engagement | Rankkw',
    metaDescription: 'Analyze top-ranking Etsy competitors: their real tags, prices, listing age and engagement. Reverse-engineer what ranks, measured from the official Etsy API.',
  },
  {
    slug: 'trend-analysis',
    name: 'Trends & Demand',
    category: 'Research',
    dashTab: 'trends',
    tagline: 'Catch demand rising before everyone else does.',
    intro: 'Track how interest in a keyword moves over the year and spot seasonal windows and emerging niches while there’s still room to rank.',
    overview: [
      'Demand on Etsy is seasonal and always shifting — the difference between a listing that takes off and one that stalls is often nothing more than timing. Trends & Demand tracks how interest in a keyword moves across the year so you can list into a rising curve instead of arriving during a crowded peak. Seasonal context comes from Google search demand, while emerging-keyword signals surface the niches heating up on Etsy right now.',
      'Because Etsy’s API returns current state rather than a history, Rankkw builds its own timeline from daily snapshots going forward — real data accumulated over time, never back-filled with an invented trend line. Read the shape of the curve, identify the run-up before a season peaks, and publish early enough for your listing to mature, gather reviews and rank before the rush actually arrives.',
    ],
    useCases: [
      { title: 'Time seasonal launches', desc: 'Publish 4–8 weeks ahead of a demand spike so your listing is already ranking when buyers arrive.' },
      { title: 'Catch niches early', desc: 'Surface emerging keywords before they saturate and while there’s still ranking room.' },
      { title: 'Plan stock & production', desc: 'Align inventory and materials to real demand windows instead of hunches.' },
    ],
    what: [
      'Month-by-month demand for a keyword so you can plan around seasonality.',
      'Emerging keywords heating up on Etsy right now.',
      'Google search-demand context alongside Etsy’s live marketplace.',
    ],
    how: [
      { title: 'Enter a niche or keyword', desc: 'Search any product theme you want to understand over time.' },
      { title: 'Read the curve', desc: 'See the monthly demand shape and identify the run-up before peak season.' },
      { title: 'Plan your launch', desc: 'List and optimize weeks ahead of the seasonal spike, not during it.' },
    ],
    benefits: [
      { title: 'Beat the rush', desc: 'Publish before a season peaks so your listing has time to gain ranking and reviews.' },
      { title: 'Find the next niche', desc: 'Surface rising terms early, before they saturate.' },
      { title: 'Plan inventory', desc: 'Align production and stock to real demand windows.' },
    ],
    features: ['12-month demand', 'Seasonal windows', 'Emerging keywords', 'Monthly trends', 'Google + Etsy context'],
    faqs: [
      { q: 'Does Etsy provide search history?', a: 'No — Etsy returns current state, not a series. Seasonal demand context comes from Google, and our own daily snapshots build history over time; we never back-fill fake trend data.' },
      { q: 'How early should I list for a season?', a: 'Use the demand curve to publish during the run-up (often 4–8 weeks before peak) so your listing matures before the spike.' },
    ],
    related: ['keyword-research', 'find-hot-products', 'top-sellers'],
    metaTitle: 'Etsy Trend & Seasonal Demand Analysis | Rankkw',
    metaDescription: 'Track month-by-month Etsy keyword demand, spot seasonal windows and emerging niches early. Plan launches around real demand, not guesses.',
  },
  {
    slug: 'find-hot-products',
    name: 'Find Hot Products',
    category: 'Research',
    dashTab: 'hotproducts',
    tagline: 'Discover trending products by real engagement — not hype.',
    intro: 'Surface products gaining traction on Etsy right now, ranked by a Hot Score built from real favorite velocity and engagement, with clickable tags to explore each niche.',
    overview: [
      'Finding what’s “trending” usually means trusting someone’s estimated-sales figure — a number Etsy never publishes and no tool can truly know. Find Hot Products takes a different, honest route: it ranks products by a Hot Score built only from signals Etsy does expose — favorite velocity (how fast an item is gaining favorites relative to its age) and overall engagement.',
      'Browse trending items across niches or filter to the category you care about, read the Hot Score to see what’s genuinely accelerating, then click any tag to jump straight into its keyword space and find your own angle. It’s a discovery engine grounded in real buyer behavior rather than hype — so the opportunities you chase are ones with authentic momentum behind them.',
    ],
    useCases: [
      { title: 'Discover rising products', desc: 'See what’s gaining favorites fastest while the niche still has room to rank.' },
      { title: 'Validate before you commit', desc: 'Check real engagement on an idea before investing time in a whole new product line.' },
      { title: 'Jump product → keyword', desc: 'Click any tag on a hot item to research that phrase and build your listing around it.' },
    ],
    what: [
      'A Hot Score derived from real favorite-velocity and engagement signals.',
      'Trending products across niches, each with its live Etsy metrics.',
      'Clickable tags and tag analysis to jump from a hot product into its keyword space.',
    ],
    how: [
      { title: 'Browse or filter', desc: 'Explore trending products, or narrow to a category or niche you care about.' },
      { title: 'Read the Hot Score', desc: 'See which items are gaining favorites fastest relative to their age and views.' },
      { title: 'Dig into the tags', desc: 'Click any tag to research that keyword and find your own angle.' },
    ],
    benefits: [
      { title: 'Spot opportunities early', desc: 'Find rising products while the niche still has ranking room.' },
      { title: 'Validate ideas fast', desc: 'See engagement before committing time to a new product line.' },
      { title: 'Honest signals only', desc: 'Hot Score uses real favorites and engagement — Etsy publishes no per-listing sales, so we don’t fake them.' },
    ],
    features: ['Hot Score', 'Favorite velocity', 'Clickable tags', 'Tag analysis', 'Niche filtering'],
    faqs: [
      { q: 'How is the Hot Score calculated?', a: 'From real signals Etsy does publish — favorite velocity (favorites relative to age) and engagement — never invented sales numbers.' },
      { q: 'Can I see how many sales a hot product has?', a: 'Etsy doesn’t publish per-listing sales, so we don’t show them. We rank by real favorites and engagement instead.' },
    ],
    related: ['trend-analysis', 'keyword-research', 'top-sellers'],
    metaTitle: 'Find Hot & Trending Etsy Products by Real Engagement | Rankkw',
    metaDescription: 'Discover trending Etsy products ranked by a Hot Score built from real favorite velocity and engagement. Clickable tags to research every niche.',
  },
  {
    slug: 'tag-optimizer',
    name: 'Tag Optimizer',
    category: 'Optimize',
    dashTab: 'tags',
    tagline: 'Score your 13 tags against the tags that actually rank.',
    intro: 'Grade your listing’s tags against the tags the top-ranking listings for your keyword actually use — taken straight from the Etsy API, not generic advice.',
    overview: [
      'Every Etsy listing gets 13 tags, and each one is a separate chance to match a buyer’s search — so leaving any of them weak, duplicated or unused simply throws away ranking potential. Most tag tools hand you a generic word list. Tag Optimizer instead grades your tags against the tags the top-ranking live listings for your keyword are actually using, read straight from the Etsy Open API.',
      'Paste your current tags (or start from a keyword) and Rankkw scores all 13, flags the high-value tags you’re missing, and points out the ones pulling no weight so you can swap them out. Because every suggestion is grounded in what’s genuinely ranking today, you cover the long-tail phrases real competitors win with — not advice pulled from a static dictionary that never changes.',
    ],
    useCases: [
      { title: 'Fix a stalled listing', desc: 'Find the missing high-value tags keeping you off searches your competitors already rank for.' },
      { title: 'Use all 13 tags well', desc: 'Turn wasted or duplicate tags into distinct, searchable ranking opportunities.' },
      { title: 'Ground tags in real data', desc: 'Replace generic tag-tool guesses with the exact tags top listings use right now.' },
    ],
    what: [
      'Scores all 13 of your tags against real top-ranking listings.',
      'Shows high-value tags you’re missing and weak tags to replace.',
      'Grounds every suggestion in the tags live competitors rank with.',
    ],
    how: [
      { title: 'Enter your keyword and tags', desc: 'Paste your current tags (or start from a keyword).' },
      { title: 'We compare to the leaders', desc: 'Rankkw pulls the tags the top listings use and scores yours against them.' },
      { title: 'Fill the gaps', desc: 'Add the recommended high-value tags and drop the ones pulling no weight.' },
    ],
    benefits: [
      { title: 'Use all 13 tags well', desc: 'Every tag is a ranking opportunity — make each one count.' },
      { title: 'Beat generic tools', desc: 'Recommendations come from real ranking listings, not a static word list.' },
      { title: 'Rank for more searches', desc: 'Cover the long-tail phrases buyers actually type.' },
    ],
    features: ['13-tag scoring', 'Gap detection', 'Real competitor tags', 'One-click copy', 'Keyword-grounded'],
    faqs: [
      { q: 'Where do the suggested tags come from?', a: 'From the tags the top-ranking live listings for your keyword actually use — read from the Etsy API, not a generic list.' },
      { q: 'Does Etsy really use all 13 tags?', a: 'Yes — each tag is a chance to match a buyer search, so leaving any unused wastes ranking potential.' },
    ],
    related: ['ai-title-tag-generator', 'keyword-research', 'listing-audit'],
    metaTitle: 'Etsy Tag Optimizer — Score Tags Against What Ranks | Rankkw',
    metaDescription: 'Grade your Etsy tags against the tags top-ranking listings actually use. Find missing high-value tags and replace weak ones — grounded in real Etsy data.',
  },
  {
    slug: 'etsy-listing-generator',
    name: 'Etsy Listing Pro',
    category: 'Optimize',
    dashTab: 'listingpro',
    tagline: 'A whole optimized listing — title, tags, description and images — in one click.',
    intro: 'Generate a complete, publish-ready Etsy listing: an SEO title, 13 tags, a full description, a market-anchored price, and Etsy-style product images — all from one keyword.',
    overview: [
      'A complete Etsy listing is a surprising amount of separate work: an SEO title, 13 tags, a persuasive description, a sensible price, and photos that fit Etsy’s style. Etsy Listing Pro produces all of it from a single keyword — a publish-ready draft you can review and paste in minutes instead of piecing together over hours.',
      'The copy isn’t generic AI filler: the title and tags are grounded in real Google search volume and the tags the top-50 live listings use, and the suggested price is anchored to the real market median for your keyword. Four AI product images are generated in authentic Etsy photography styles — hero, lifestyle, feature callout and collage — which you review before publishing, since Etsy requires listing photos to represent the actual item you’re selling.',
    ],
    useCases: [
      { title: 'Launch a listing fast', desc: 'Turn a product idea into a full, optimized draft without the blank-page struggle.' },
      { title: 'Price with the market', desc: 'Start from the real median price for your keyword instead of guessing a number.' },
      { title: 'Mock up product imagery', desc: 'Generate Etsy-style images to visualize a listing before your final photos are shot.' },
    ],
    what: [
      'An SEO-optimized title and all 13 tags, grounded in real keyword data.',
      'A structured, conversion-focused description ready to paste.',
      'A suggested price anchored to the real market median for the keyword.',
      'Four AI product images shot in real Etsy styles (hero, lifestyle, feature callout, collage).',
    ],
    how: [
      { title: 'Describe your product', desc: 'Enter the product and any details; optionally upload a real photo to build mockups from.' },
      { title: 'Generate the listing', desc: 'Rankkw writes the title, tags, description and price using real Etsy + Google grounding.' },
      { title: 'Generate images', desc: 'Create Etsy-style images with Gemini and download the ones you like.' },
      { title: 'Publish', desc: 'Review, tweak, and paste straight into Etsy.' },
    ],
    benefits: [
      { title: 'List in minutes', desc: 'Turn a product idea into a full, optimized listing without the blank-page struggle.' },
      { title: 'Grounded, not generic', desc: 'Copy is built from the real keywords and tags of listings that rank.' },
      { title: 'Priced with the market', desc: 'The suggested price is anchored to the real median for your keyword.' },
    ],
    features: ['SEO title', '13 tags', 'Full description', 'Market-median price', 'AI Etsy images', 'One click'],
    faqs: [
      { q: 'Are the images really usable?', a: 'They’re AI-generated in real Etsy photography styles. Always review before publishing — Etsy requires listing photos to represent the actual item.' },
      { q: 'Is the copy just generic AI text?', a: 'No — it’s grounded in the real Google volume and the tags the top-50 live listings use, so it targets terms that actually get searched.' },
      { q: 'How is the price decided?', a: 'It’s anchored to the real median price of listings ranking for your keyword, in the dominant currency.' },
    ],
    related: ['ai-title-tag-generator', 'tag-optimizer', 'listing-audit'],
    metaTitle: 'Etsy Listing Generator — Title, Tags, Description & Images | Rankkw',
    metaDescription: 'Generate a full Etsy listing in one click: SEO title, 13 tags, description, market-anchored price and Etsy-style AI images — grounded in real data.',
  },
  {
    slug: 'ai-title-tag-generator',
    name: 'AI Title & Tag Generator',
    category: 'Optimize',
    dashTab: 'titlegen',
    tagline: 'AI Etsy titles and tags built from real search data.',
    intro: 'Generate SEO-optimized Etsy titles, tags and descriptions grounded in real Google volume and the tags top-ranking listings use — so the keywords are real, not invented.',
    overview: [
      'Writing SEO titles and tags by hand means juggling keyword research, character limits and readability all at the same time. This generator does the heavy lifting: it produces front-loaded, high-intent titles, full 13-tag sets, and structured descriptions — all built from real search data rather than the model’s imagination.',
      'Give it a focus keyword (and optional product details, audience or features) and it grounds every suggestion in measured Google demand and the tags top-ranking listings use. The AI writes the copy; it never invents analytics — so the keywords you end up targeting are ones people genuinely search for. Generate several distinct description versions and keep the one that best fits your brand voice.',
    ],
    useCases: [
      { title: 'Draft titles & tags instantly', desc: 'Skip manual keyword-stuffing and get a strong, data-grounded first draft in seconds.' },
      { title: 'Refresh tired listings', desc: 'Rewrite an old title and tag set around the phrases that are searched today.' },
      { title: 'Choose from versions', desc: 'Generate several distinct descriptions and keep the one that matches your voice.' },
    ],
    what: [
      'SEO titles that front-load high-intent, real-demand keywords.',
      'Full 13-tag sets covering the long-tail buyers actually search.',
      'Descriptions structured to rank and convert.',
    ],
    how: [
      { title: 'Enter your focus keyword', desc: 'Add optional product details, audience and features — or let the AI infer them.' },
      { title: 'Generate', desc: 'Rankkw writes titles/tags/descriptions grounded in real keyword and competitor data.' },
      { title: 'Copy & refine', desc: 'Pick the version you like, tweak, and paste into Etsy.' },
    ],
    benefits: [
      { title: 'Real keywords, not filler', desc: 'Suggestions are grounded in measured demand and ranking tags.' },
      { title: 'Save hours', desc: 'Skip the manual keyword-stuffing and get a strong first draft instantly.' },
      { title: 'Stay honest', desc: 'The AI writes copy — it never invents analytics or fake numbers.' },
    ],
    features: ['SEO titles', '13 tags', 'Descriptions', 'Real-data grounding', 'Multiple versions'],
    faqs: [
      { q: 'Does the AI make up search numbers?', a: 'No. The model writes copy only; all volume/competition figures come from the Etsy and Google APIs.' },
      { q: 'Can I generate more than one version?', a: 'Yes — the description generator produces multiple distinct versions to choose from.' },
    ],
    related: ['etsy-listing-generator', 'tag-optimizer', 'keyword-research'],
    metaTitle: 'AI Etsy Title & Tag Generator — Grounded in Real Data | Rankkw',
    metaDescription: 'Generate SEO Etsy titles, tags and descriptions grounded in real Google volume and top-ranking tags. Real keywords, never invented.',
  },
  {
    slug: 'listing-audit',
    name: 'Listing Audit',
    category: 'Optimize',
    dashTab: 'audit',
    tagline: 'Score any listing’s SEO and see exactly what to fix.',
    intro: 'Run any Etsy listing through an SEO audit that scores its title, tags and structure against best practice and the keywords that actually rank.',
    overview: [
      'You can’t fix what you can’t see. Listing Audit runs any active Etsy listing — your own or a competitor’s — through an SEO check that scores its title, tags and structure against best practice and against the listings that actually rank in your niche. The result is a clear overall score plus a prioritized list of exactly what to change, in order of impact.',
      'Instead of vague “improve your SEO” advice, you get specifics: whether your title uses its keywords well, whether all 13 tags are working, and how your structure compares to ranking listings. Re-audit after you make edits to confirm the score actually moved — measurable progress rather than guesswork, and no promises of sales that no honest tool can make.',
    ],
    useCases: [
      { title: 'Prioritize your next fix', desc: 'Work down an ordered list instead of guessing which change matters most.' },
      { title: 'Learn why rivals outrank you', desc: 'Audit a competitor’s listing to see the SEO fundamentals they get right.' },
      { title: 'Track your improvement', desc: 'Re-run the audit after editing to prove your changes raised the score.' },
    ],
    what: [
      'An overall SEO score with a clear, prioritized fix list.',
      'Checks on title keyword usage, all 13 tags, and structure.',
      'Comparisons to how ranking listings in your niche are built.',
    ],
    how: [
      { title: 'Paste a listing', desc: 'Audit your own listing or any competitor’s.' },
      { title: 'Get the score', desc: 'See where it’s strong and where it’s leaving ranking on the table.' },
      { title: 'Fix the priorities', desc: 'Work down the ordered list of improvements.' },
    ],
    benefits: [
      { title: 'Know what to fix first', desc: 'A prioritized list beats guessing which change matters most.' },
      { title: 'Benchmark rivals', desc: 'Audit competitors to see why they out-rank you.' },
      { title: 'Measurable progress', desc: 'Re-audit after edits to confirm the score improved.' },
    ],
    features: ['SEO score', 'Title check', 'Tag coverage', 'Priority fixes', 'Competitor benchmark'],
    faqs: [
      { q: 'Can I audit a competitor’s listing?', a: 'Yes — paste any active Etsy listing and it’s scored the same way, using public API data.' },
      { q: 'Does a higher score guarantee more sales?', a: 'No tool can promise sales. A better score means better SEO fundamentals, which improves your chance to rank.' },
    ],
    related: ['tag-optimizer', 'ai-title-tag-generator', 'shop-analytics'],
    metaTitle: 'Etsy Listing Audit — Score Your SEO & Fix It | Rankkw',
    metaDescription: 'Audit any Etsy listing’s SEO: score its title, tags and structure against what ranks, with a prioritized fix list. Real data, honest scoring.',
  },
  {
    slug: 'shop-analytics',
    name: 'Shop Analytics',
    category: 'Analytics',
    dashTab: 'shop',
    tagline: 'Understand any Etsy shop — including your own.',
    intro: 'Analyze any Etsy shop’s listings, engagement and lifetime performance, and connect your own shop for private views, favorites, orders and buyer geography.',
    overview: [
      'Shop Analytics works two ways. For any public Etsy shop, it summarizes the whole catalog — listing count, engagement, lifetime transactions, reviews and rating — so you can study the strong shops in your niche. Connect your own shop through Etsy’s official OAuth and it unlocks private analytics: your views, favorites, orders and buyer geography, all in one place.',
      'Because Etsy’s API returns current state rather than history, Rankkw records daily snapshots to build a real sales-over-time view going forward — a timeline Etsy itself doesn’t expose and that can’t be back-filled after the fact. Connecting is read-only and revocable at any time, and your password is never seen by us; you grant read access through Etsy directly.',
    ],
    useCases: [
      { title: 'See your shop in one place', desc: 'Views, favorites, orders and a buyer map together in one private dashboard.' },
      { title: 'Study winning shops', desc: 'Break down how strong shops in your niche build their catalog and pricing.' },
      { title: 'Build a real sales history', desc: 'Daily snapshots turn Etsy’s state-only data into a trend Etsy can’t give you.' },
    ],
    what: [
      'Shop-wide metrics: listing count, engagement, lifetime transactions, reviews and rating.',
      'Your own private analytics once you connect your shop via secure Etsy OAuth.',
      'Buyer geography and sales-over-time from daily snapshots.',
    ],
    how: [
      { title: 'Enter a shop, or connect yours', desc: 'Analyze any public shop, or connect your own for private data.' },
      { title: 'Review performance', desc: 'See engagement, lifetime sales and how the catalog is built.' },
      { title: 'Track over time', desc: 'Daily snapshots turn Etsy’s state-only data into a real history.' },
    ],
    benefits: [
      { title: 'One place for your shop', desc: 'Your views, favorites, orders and buyer map together.' },
      { title: 'Learn from any shop', desc: 'Study strong shops in your niche to model what works.' },
      { title: 'History Etsy can’t give', desc: 'Snapshots build sales-over-time that Etsy’s API doesn’t expose.' },
    ],
    features: ['Shop overview', 'Connected-shop analytics', 'Buyer geography', 'Daily snapshots', 'Reviews & rating'],
    faqs: [
      { q: 'Is connecting my shop safe?', a: 'Yes — it uses Etsy’s official OAuth 2.0. You grant read access and can revoke it anytime; we never see your password.' },
      { q: 'Why is sales history limited at first?', a: 'Etsy returns current state, not history, so we build it from daily snapshots going forward — it can’t be back-filled.' },
    ],
    related: ['competitor-analysis', 'listing-audit', 'top-sellers'],
    metaTitle: 'Etsy Shop Analytics — Yours & Any Shop | Rankkw',
    metaDescription: 'Analyze any Etsy shop’s engagement and lifetime performance, or connect your own for private views, favorites, orders and buyer geography.',
  },
  {
    slug: 'top-sellers',
    name: 'Top Sellers',
    category: 'Research',
    dashTab: 'topsellers',
    tagline: 'See the leading shops in any niche — by real lifetime sales.',
    intro: 'Rank the leading Etsy shops for any niche by their real lifetime transaction count, alongside reviews, rating, country and shop age.',
    overview: [
      'When you enter a niche, the first thing you need to know is who already owns it. Top Sellers ranks the leading Etsy shops for any keyword or category by their real lifetime transaction count — a figure Etsy genuinely publishes — alongside reviews, rating, country and shop age for context you can act on.',
      'This is deliberately a shop-level view, not per-listing “estimated sales” (which Etsy never releases and we never fabricate). Sort the field by lifetime sales, reviews or age to find the true leaders, then open any shop to study the catalog, tags and pricing that got them there. It’s the fastest honest read on how competitive a niche is and how established its top players really are.',
    ],
    useCases: [
      { title: 'Size up a niche', desc: 'See who dominates and how established they are before you commit to entering.' },
      { title: 'Model proven shops', desc: 'Learn from sellers with real, verifiable lifetime sales volume — not estimates.' },
      { title: 'Find your opening', desc: 'Spot where leaders are old and slow, and where a newcomer can realistically break in.' },
    ],
    what: [
      'Leading shops ranked by real Etsy lifetime transaction counts.',
      'Reviews, rating, country and shop age for context.',
      'A fast read on who dominates a niche and how established they are.',
    ],
    how: [
      { title: 'Search a niche', desc: 'Enter a keyword or category to find its leading shops.' },
      { title: 'Rank the field', desc: 'Sort by lifetime sales, reviews or age to see the real leaders.' },
      { title: 'Study the best', desc: 'Open a shop to learn its catalog, tags and pricing.' },
    ],
    benefits: [
      { title: 'Know the landscape', desc: 'Understand who you’re competing with before you enter a niche.' },
      { title: 'Model the leaders', desc: 'Learn from shops with proven, real sales volume.' },
      { title: 'Real numbers only', desc: 'Rankings use Etsy’s real lifetime transaction counts, not estimates.' },
    ],
    features: ['Lifetime sales rank', 'Reviews & rating', 'Shop age', 'Country', 'Niche search'],
    faqs: [
      { q: 'Are the sales numbers real?', a: 'Yes — Etsy publishes each shop’s lifetime transaction count, which is what we rank by. It’s a shop total, not per-listing.' },
      { q: 'Can I see their best-selling item?', a: 'Etsy doesn’t publish per-listing sales, so no tool can show a true best-seller. We show real shop totals and engagement instead.' },
    ],
    related: ['competitor-analysis', 'find-hot-products', 'shop-analytics'],
    metaTitle: 'Etsy Top Sellers — Leading Shops by Real Sales | Rankkw',
    metaDescription: 'Find the leading Etsy shops in any niche ranked by real lifetime transaction counts, with reviews, rating, country and shop age.',
  },
]

const BY_SLUG = new Map(TOOL_PAGES.map(t => [t.slug, t]))
export const getToolPage = (slug: string): ToolPage | undefined => BY_SLUG.get(slug)
export const allToolSlugs = (): string[] => TOOL_PAGES.map(t => t.slug)
