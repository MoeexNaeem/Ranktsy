"use client";
import { C } from "@/utils";

/* ─── Shared label ─────────────────────────────────────────────────────────── */
export function SectionTag({
  children,
  light = false,
  center = false,
}: {
  children: string;
  light?: boolean;
  center?: boolean;
}) {
  const col = light ? C.pale : C.forest;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        fontFamily: "'IBM Plex Mono',monospace",
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: col,
        marginBottom: 16,
        justifyContent: center ? "center" : "flex-start",
      }}
    >
      <span
        style={{
          width: 24,
          height: 1,
          background: col,
          display: "inline-block",
        }}
      />
      {children}
    </div>
  );
}

/* ─── Features ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: "🔍",
    title: "Keyword Research",
    desc: "Discover high-volume, low-competition keywords that drive traffic to your listings. Get avg. searches, clicks, and CTR data.",
  },
  {
    icon: "📈",
    title: "Search Trend Analysis",
    desc: "Track keyword trends across Etsy, Google, Amazon, and eBay. Know exactly when buyer interest peaks for your products.",
  },
  {
    icon: "🌍",
    title: "Searchers by Country",
    desc: "See where your buyers come from. Target high-value geographic markets with localized keywords and shipping strategies.",
  },
  {
    icon: "🏆",
    title: "Competition Analysis",
    desc: "Analyze top-performing listings. Understand what tags, titles, and descriptions your competitors are using to win.",
  },
  {
    icon: "🏷️",
    title: "Tag Optimizer",
    desc: "Get smart tag recommendations based on real search data. Maximize your 13-tag allowance with proven performers.",
  },
  {
    icon: "📊",
    title: "Shop Analytics",
    desc: "Connect your Etsy shop to track views, favorites, sales, and revenue trends. All in one clean, actionable dashboard.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      style={{ padding: "96px 48px", background: C.warmGray }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionTag>Features</SectionTag>
        <h2
          style={{
            fontSize: "clamp(28px,3.5vw,40px)",
            fontWeight: 300,
            letterSpacing: "-1px",
            color: C.forest,
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          Everything you need to dominate Etsy search
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#666",
            lineHeight: 1.6,
            maxWidth: 480,
            marginBottom: 64,
          }}
        >
          From keyword research to competitor tracking, Ranksty is your complete
          Etsy analytics platform.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 2,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: C.snow,
                padding: "40px 32px",
                transition: "transform 0.2s",
                cursor: "default",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-2px)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: C.pale,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                  fontSize: 20,
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: C.forest,
                  marginBottom: 12,
                  letterSpacing: "-0.3px",
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.65 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─────────────────────────────────────────────────────────── */
export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Enter a keyword",
      desc: "Type any product idea or keyword into Ranksty's search bar to begin your research.",
    },
    {
      n: "02",
      title: "Analyze the data",
      desc: "Review search volumes, click-through rates, competition levels, and trend charts.",
    },
    {
      n: "03",
      title: "Find your edge",
      desc: "Discover related low-competition keywords with high buyer intent that others are missing.",
    },
    {
      n: "04",
      title: "Optimize & grow",
      desc: "Apply data-backed tags, titles, and descriptions to your listings and track your ranking climb.",
    },
  ];
  return (
    <section style={{ padding: "96px 48px", background: C.snow }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionTag>How it works</SectionTag>
        <h2
          style={{
            fontSize: "clamp(28px,3.5vw,40px)",
            fontWeight: 300,
            letterSpacing: "-1px",
            color: C.forest,
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          From search to sale in four steps
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#666",
            lineHeight: 1.6,
            maxWidth: 480,
            marginBottom: 64,
          }}
        >
          Ranksty turns complex Etsy data into clear, actionable insights.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 32,
          }}
        >
          {steps.map((s, i) => (
            <div key={s.n} style={{ position: "relative" }}>
              {i < steps.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 40,
                    right: -60,
                    height: 1,
                    background: C.pale,
                    zIndex: 0,
                  }}
                />
              )}
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: C.pale,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontWeight: 500,
                  color: C.forest,
                  marginBottom: 16,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {s.n}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: C.forest,
                  marginBottom: 8,
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ──────────────────────────────────────────────────────────────── */
const PLANS = [
  {
    name: "Sprout",
    price: "$0",
    period: "forever free",
    featured: false,
    features: [
      { ok: true, t: "5 keyword searches / day" },
      { ok: true, t: "Basic trend charts" },
      { ok: true, t: "Top 10 related keywords" },
      { ok: true, t: "1 Etsy shop connected" },
      { ok: false, t: "Competition analysis" },
      { ok: false, t: "Tag optimizer" },
    ],
    cta: "Get started free",
    ctaStyle: "ghost",
  },
  {
    name: "Grow",
    price: "$9.99",
    period: "per month",
    featured: true,
    badge: "Most popular",
    features: [
      { ok: true, t: "Unlimited keyword searches" },
      { ok: true, t: "Full trend analysis (12 months)" },
      { ok: true, t: "All related keywords" },
      { ok: true, t: "Competition deep-dive" },
      { ok: true, t: "Tag optimizer" },
      { ok: true, t: "3 shops connected" },
    ],
    cta: "Start 14-day free trial",
    ctaStyle: "outline",
  },
  {
    name: "Scale",
    price: "$24.99",
    period: "per month",
    featured: false,
    features: [
      { ok: true, t: "Everything in Grow" },
      { ok: true, t: "Unlimited shops" },
      { ok: true, t: "API access" },
      { ok: true, t: "Bulk keyword export" },
      { ok: true, t: "Priority support" },
      { ok: true, t: "Team collaboration" },
    ],
    cta: "Start 14-day free trial",
    ctaStyle: "forest",
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      style={{ padding: "96px 48px", background: C.warmGray }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <SectionTag center>Pricing</SectionTag>
          <h2
            style={{
              fontSize: "clamp(28px,3.5vw,40px)",
              fontWeight: 300,
              letterSpacing: "-1px",
              color: C.forest,
              lineHeight: 1.1,
              marginBottom: 8,
            }}
          >
            Grow at your own pace
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#666",
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            Start free, upgrade when you're ready. No hidden fees.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 2,
          }}
        >
          {PLANS.map((p) => (
            <div
              key={p.name}
              style={{
                background: p.featured ? C.forest : C.snow,
                padding: "40px 32px",
                position: "relative",
              }}
            >
              {p.badge && (
                <span
                  style={{
                    display: "inline-block",
                    background: C.pale,
                    color: C.forest,
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontWeight: 500,
                    padding: "4px 14px",
                    borderRadius: 999,
                    marginBottom: 24,
                  }}
                >
                  {p.badge}
                </span>
              )}
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  color: p.featured ? C.snow : C.forest,
                  marginBottom: 8,
                }}
              >
                {p.name}
              </h3>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 300,
                  color: p.featured ? C.snow : C.forest,
                  letterSpacing: "-2px",
                  marginBottom: 4,
                }}
              >
                {p.price}
              </div>
              <p
                style={{
                  fontSize: 13,
                  fontFamily: "'IBM Plex Mono',monospace",
                  color: p.featured ? "rgba(252,252,247,0.4)" : "#b3b3b3",
                  marginBottom: 32,
                }}
              >
                {p.period}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginBottom: 40,
                }}
              >
                {p.features.map((f) => (
                  <li
                    key={f.t}
                    style={{
                      fontSize: 14,
                      color: p.featured
                        ? f.ok
                          ? "rgba(252,252,247,0.7)"
                          : "rgba(252,252,247,0.25)"
                        : f.ok
                          ? "#666"
                          : "#ccc",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: 9,
                        background: p.featured
                          ? "rgba(211,250,153,0.2)"
                          : C.pale,
                        color: p.featured ? C.pale : C.forest,
                      }}
                    >
                      {f.ok ? "✓" : "✗"}
                    </span>
                    {f.t}
                  </li>
                ))}
              </ul>
              <button
                style={{
                  width: "100%",
                  padding: "14px 28px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  ...(p.ctaStyle === "ghost"
                    ? {
                        background: "transparent",
                        border: `1px solid ${C.forest}`,
                        color: C.forest,
                      }
                    : {}),
                  ...(p.ctaStyle === "outline"
                    ? {
                        background: "transparent",
                        border: "1.5px solid rgba(252,252,247,0.3)",
                        color: C.snow,
                      }
                    : {}),
                  ...(p.ctaStyle === "forest"
                    ? { background: C.forest, border: "none", color: C.snow }
                    : {}),
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ──────────────────────────────────────────────────────────────────── */
export function CTA() {
  return (
    <section
      style={{
        padding: "96px 48px",
        background: C.forest,
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontSize: "clamp(32px,4vw,52px)",
          fontWeight: 300,
          color: C.snow,
          letterSpacing: "-1.5px",
          lineHeight: 1.05,
          marginBottom: 16,
        }}
      >
        Ready to grow your Etsy shop?
      </h2>
      <p
        style={{
          fontSize: 17,
          color: "rgba(252,252,247,0.6)",
          marginBottom: 48,
        }}
      >
        Join thousands of sellers using data to rank higher and sell more.
      </p>
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          style={{
            background: C.pale,
            border: "none",
            color: C.forest,
            padding: "16px 36px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Start for free →
        </button>
        <button
          style={{
            background: "transparent",
            border: "1px solid rgba(252,252,247,0.3)",
            color: C.snow,
            padding: "16px 36px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.snow)}
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "rgba(252,252,247,0.3)")
          }
        >
          View live demo
        </button>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────────────────────────────── */
export function Footer() {
  const cols = [
    {
      t: "Product",
      l: [
        "Keyword Research",
        "Trend Analysis",
        "Competition Tool",
        "Tag Optimizer",
        "Shop Analytics",
      ],
    },
    { t: "Company", l: ["About", "Blog", "Pricing", "Changelog"] },
    {
      t: "Support",
      l: ["Help Center", "Etsy API Docs", "Contact", "Privacy Policy", "Terms"],
    },
  ];
  return (
    <footer
      style={{
        padding: "48px",
        background: C.snow,
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 48,
          marginBottom: 32,
        }}
      >
        <div style={{ color: C.forest }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.5px",
              marginBottom: 12,
            }}
          >
            🌱 Ranksty
          </p>
          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
            Data-driven keyword research and analytics for Etsy sellers. Grow
            smarter, not harder.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.t}>
            <h4
              style={{
                fontSize: 11,
                fontFamily: "'IBM Plex Mono',monospace",
                fontWeight: 500,
                color: "#000",
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
                marginBottom: 16,
              }}
            >
              {c.t}
            </h4>
            {c.l.map((l) => (
              <a
                key={l}
                href={l === "Privacy Policy" ? "/privacy" : "#"}
                style={{
                  display: "block",
                  fontSize: 14,
                  color: "#666",
                  textDecoration: "none",
                  marginBottom: 10,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.forest)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
              >
                {l}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingTop: 24,
          borderTop: "1px solid rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "#b3b3b3",
            fontFamily: "'IBM Plex Mono', monospace",
            margin: 0,
          }}
        >
          © 2026 Ranksty. Built with the Seed Design System.
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#b3b3b3",
            fontFamily: "'IBM Plex Mono', monospace",
            margin: 0,
            lineHeight: "1.5",
          }}
        >
          The term 'Etsy' is a trademark of Etsy, Inc. Ranktsy is an independent
          application and is not endorsed, certified, or affiliated with Etsy,
          Inc.
        </p>
      </div>
    </footer>
  );
}
