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
    desc: "Track keyword trends derived from Etsy listing data. Know when buyer interest peaks for your products using signals available through the official Etsy API.",
  },
  {
    icon: "🌍",
    title: "Market Insights",
    desc: "Analyze competition levels and tag usage patterns across active Etsy listings to identify market gaps and opportunities.",
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
/* Pricing plans coming soon. Currently all features are free during beta. */


// Pricing section is coming soon. Currently in beta — all features are free.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Pricing() {
  return null
}

/* ─── About + Contact Teaser ───────────────────────────────────────────────── */
export function AboutContactTeaser() {
  return (
    <section style={{ padding: '80px 48px', background: C.snow }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        {/* About card */}
        <a
          href="/about"
          style={{
            background: C.warmGray, padding: '48px 40px', display: 'block',
            textDecoration: 'none', transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          <div style={{
            width: 44, height: 44, background: C.forest, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, marginBottom: 20,
          }}>🌱</div>
          <div style={{
            fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
            textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            color: C.mutedGreen, marginBottom: 10,
          }}>
            Our Story
          </div>
          <h3 style={{
            fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 300,
            letterSpacing: '-0.8px', color: C.forest, lineHeight: 1.15, marginBottom: 16,
          }}>
            Built by Etsy sellers,<br />for Etsy sellers.
          </h3>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 28 }}>
            We spent years selling on Etsy, manually tracking keywords in spreadsheets. Ranksty is the tool we always wished existed.
          </p>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 500, color: C.forest,
          }}>
            Read our story →
          </span>
        </a>

        {/* Contact card */}
        <a
          href="/contact"
          style={{
            background: C.forest, padding: '48px 40px', display: 'block',
            textDecoration: 'none', transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          <div style={{
            width: 44, height: 44, background: 'rgba(255,96,8,0.10)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, marginBottom: 20,
          }}>✉️</div>
          <div style={{
            fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
            textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            color: C.mutedGreen, marginBottom: 10,
          }}>
            Get in touch
          </div>
          <h3 style={{
            fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 300,
            letterSpacing: '-0.8px', color: C.snow, lineHeight: 1.15, marginBottom: 16,
          }}>
            Questions? We&apos;re<br />always listening.
          </h3>
          <p style={{ fontSize: 14, color: 'rgba(252,252,247,0.6)', lineHeight: 1.7, marginBottom: 28 }}>
            From technical support to feature requests, our team responds within 24 hours on business days.
          </p>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 500, color: C.pale,
          }}>
            Contact us →
          </span>
        </a>
      </div>
    </section>
  )
}

/* ─── CTA ──────────────────────────────────────────────────────────────────── */
export function CTA() {
  return (
    <section
      style={{
        padding: "96px 48px",
        background: C.charcoal,
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontSize: "clamp(32px,4vw,52px)",
          fontWeight: 700,
          color: '#FFFFFF',
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
          color: "rgba(255,255,255,0.6)",
          marginBottom: 48,
        }}
      >
        Join Etsy sellers using data to rank higher and sell more.
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
            background: C.orange,
            border: "none",
            color: '#fff',
            padding: "16px 36px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
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
            border: "1.5px solid rgba(255,255,255,0.35)",
            color: '#fff',
            padding: "16px 36px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#fff')}
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)")
          }
        >
          View live demo
        </button>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────────────────────────────── */
const FOOTER_LINK_MAP: Record<string, string> = {
  "About": "/about",
  "Pricing": "/#pricing",
  "Contact": "/contact",
  "Privacy Policy": "/privacy",
  "Terms": "/terms",
}

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
        <div style={{ color: C.charcoal }}>
          <img
            src="/website_logo.png"
            alt="Ranktsy"
            style={{ width: 130, height: 44, objectFit: 'contain', display: 'block', marginBottom: 14 }}
          />
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
                href={FOOTER_LINK_MAP[l] ?? "#"}
                style={{
                  display: "block",
                  fontSize: 14,
                  color: "#666",
                  textDecoration: "none",
                  marginBottom: 10,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.orange)}
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
          © 2026 Ranktsy. All rights reserved.
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
          The term 'Etsy' is a trademark of Etsy, Inc. Ranksty is an independent
          application and is not endorsed, certified, or affiliated with Etsy,
          Inc.
        </p>
      </div>
    </footer>
  );
}
