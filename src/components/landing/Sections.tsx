"use client";
import Link from "next/link";
import { C } from "@/utils";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";

const SANS = "'General Sans',sans-serif";

/* ─── Card icon ────────────────────────────────────────────────────────────────
   Emoji were used here originally, but the site sets `font-family: 'General Sans'`
   and that face carries no emoji glyphs — on real devices they fell back to a
   blank tofu box (visible in the contact card on iOS). Inline SVG renders
   identically everywhere, inherits colour, and matches the icon set the
   dashboard already uses. */
function CardIcon({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <svg
      width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
      style={{ display: 'block', marginBottom: 18 }}
    >
      {children}
    </svg>
  );
}

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
  const col = light ? C.orange : C.ink;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: "'General Sans',monospace",
        textTransform: "uppercase" as const,
        letterSpacing: "0.09em",
        color: col,
        marginBottom: 18,
        justifyContent: center ? "center" : "flex-start",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: C.orange,
          display: "inline-block",
        }}
      />
      {children}
    </div>
  );
}

/* ─── Features ─────────────────────────────────────────────────────────────────
   Copy here must describe only what the official Etsy API actually returns.
   It previously advertised "avg. searches, clicks, and CTR" and "smart tag
   recommendations based on real search data" — Etsy publishes no search-volume
   or click data at all, so those promised numbers we cannot legally obtain, and
   claiming them invites the obvious question of where we got them.
   The `icon` emoji were dead data (the cards render a numbered index) and are gone. */
const FEATURES = [
  {
    title: "Keyword Research",
    desc: "Find low-competition keywords worth targeting. Every figure is measured live from the official Etsy API: the real number of competing listings, plus the views and favorites the listings ranking for it actually earn.",
  },
  {
    title: "Competition Analysis",
    desc: "See the true count of active listings for any exact keyword, and how strongly the incumbents convert views into favorites — so you know what you're up against before you list.",
  },
  {
    title: "Market Insights",
    desc: "Analyze tag usage, category mix, price distribution and listing age across the live listings ranking for a keyword, to spot gaps competitors have left open.",
  },
  {
    title: "Top Sellers & Real Sales",
    desc: "Rank the leading shops in any niche by their real lifetime sales — Etsy's own transaction count — alongside reviews, rating, country and year opened.",
  },
  {
    title: "Tag Optimizer",
    desc: "Score your 13 tags against the tags the listings ranking for your keyword actually use, taken straight from the Etsy API — not generic advice.",
  },
  {
    title: "Shop Analytics",
    desc: "Connect your Etsy shop to see your own views, favorites, orders, revenue and buyer geography, read from your Etsy receipts with your consent.",
  },
];


export function Features() {
  return (
    <section id="features" style={{ padding: "84px 40px 120px", background: C.paper }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <Reveal>
          <SectionTag>Features</SectionTag>
          <h2
            style={{
              fontSize: "clamp(34px,4.6vw,56px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              color: C.ink,
              lineHeight: 1.0,
              marginBottom: 16,
              maxWidth: 760,
            }}
          >
            Everything you need to rank higher on Etsy search.
          </h2>
          <p style={{ fontSize: 18, color: "#6E6E64", lineHeight: 1.5, letterSpacing: "-0.14px", maxWidth: 500, marginBottom: 56 }}>
            From keyword research to competitor tracking, Rankkw is your complete
            Etsy analytics toolkit.
          </p>
        </Reveal>
        <RevealGroup className="rgrid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {FEATURES.map((f, i) => (
            <RevealItem
              key={f.title}
              style={{
                background: C.canvas,
                border: "none",
                borderRadius: 28,
                padding: "40px 36px",
              }}
            >
              <div style={{ fontSize: 12, fontFamily: SANS, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: C.orange, marginBottom: 24 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 500, color: C.ink, marginBottom: 12, letterSpacing: "-0.03em", lineHeight: 1.14 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 16, color: C.graphite, lineHeight: 1.55 }}>
                {f.desc}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
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
      desc: "Type any product idea or keyword into Rankkw's search bar to begin your research.",
    },
    {
      n: "02",
      title: "Analyze the data",
      // Etsy publishes no search volume and no click data, so this used to promise
      // "search volumes, click-through rates" we could never honestly supply.
      desc: "Review the real number of competing listings, how well they engage buyers, their prices, tags and age.",
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
    <section style={{ padding: "120px 40px", background: C.paper }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <SectionTag>How it works</SectionTag>
          <h2 style={{ fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 500, letterSpacing: "-0.03em", color: C.ink, lineHeight: 1.0, marginBottom: 16, maxWidth: 760 }}>
            From search to sale in four steps.
          </h2>
          <p style={{ fontSize: 18, color: "#6E6E64", lineHeight: 1.5, letterSpacing: "-0.14px", maxWidth: 500, marginBottom: 56 }}>
            Rankkw turns complex Etsy data into clear, actionable insights.
          </p>
        </Reveal>
        <RevealGroup className="rgrid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 28 }}>
          {steps.map((s) => (
            <RevealItem key={s.n} style={{ borderTop: `1px solid ${C.hairInk}`, paddingTop: 18 }}>
              <div style={{ fontSize: 40, fontWeight: 500, fontFamily: "'General Sans',monospace", color: C.orange, letterSpacing: "-2px", marginBottom: 14, lineHeight: 1 }}>
                {s.n}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, fontSize: 11, fontFamily: "'General Sans',monospace", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6E6E64" }}>
                • Step {s.n}
              </div>
              <h3 style={{ fontSize: 21, fontWeight: 500, color: C.ink, marginBottom: 10, letterSpacing: "-0.3px", lineHeight: 1.2 }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 15, color: "#6E6E64", lineHeight: 1.55, letterSpacing: "-0.1px" }}>
                {s.desc}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
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
    <section style={{ padding: '96px 40px', background: C.paper }}>
      <Reveal className="rsplit" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* About card */}
        <a
          href="/about"
          style={{
            background: C.bone, border: `1px solid ${C.hairInk}`, borderRadius: 28,
            padding: '44px 40px', display: 'block',
            textDecoration: 'none', transition: 'transform 0.18s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          {/* SVG, not an emoji: 'General Sans' carries no emoji glyph, so these
              rendered as a blank tofu box on real devices. */}
          <CardIcon color={C.ink}>
            <path d="M12 21c0-6 3-9 8-10-1 6-4 9-8 10z" /><path d="M12 21c0-5-2-8-6-9 1 5 3 8 6 9z" /><line x1="12" y1="21" x2="12" y2="14" />
          </CardIcon>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12,
            fontSize: 11, fontFamily: "'General Sans', monospace", fontWeight: 500,
            textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: '#6E6E64',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
            Our Story
          </div>
          <h3 style={{
            fontSize: 'clamp(22px, 2.5vw, 29px)', fontWeight: 500,
            letterSpacing: '-0.5px', color: C.ink, lineHeight: 1.18, marginBottom: 14,
          }}>
            Built by Etsy sellers,<br />for Etsy sellers.
          </h3>
          <p style={{ fontSize: 15, color: '#6E6E64', lineHeight: 1.6, letterSpacing: '-0.1px', marginBottom: 24 }}>
            We spent years selling on Etsy, manually tracking keywords in spreadsheets. Rankkw is the tool we always wished existed.
          </p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: C.orange }}>
            Read our story →
          </span>
        </a>

        {/* Contact card */}
        <a
          href="/contact"
          style={{
            background: C.charcoal, border: `1px solid ${C.hairInk}`, borderRadius: 28, padding: '44px 40px', display: 'block',
            textDecoration: 'none', transition: 'transform 0.18s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          <CardIcon color={C.snow}>
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
          </CardIcon>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12,
            fontSize: 11, fontFamily: "'General Sans', monospace", fontWeight: 500,
            textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: 'rgba(252,252,247,0.65)',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
            Get in touch
          </div>
          <h3 style={{
            fontSize: 'clamp(22px, 2.5vw, 29px)', fontWeight: 500,
            letterSpacing: '-0.5px', color: C.snow, lineHeight: 1.18, marginBottom: 14,
          }}>
            Questions? We&apos;re<br />always listening.
          </h3>
          <p style={{ fontSize: 15, color: 'rgba(252,252,247,0.62)', lineHeight: 1.6, letterSpacing: '-0.1px', marginBottom: 24 }}>
            From technical support to feature requests, our team responds within 24 hours on business days.
          </p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: C.orange }}>
            Contact us →
          </span>
        </a>
      </Reveal>
    </section>
  )
}

/* ─── CTA — full-bleed lime accent panel (Perk's signature) ─────────────────── */
export function CTA() {
  return (
    <section style={{ padding: "56px 24px 120px", background: C.paper }}>
      <Reveal style={{ maxWidth: 1160, margin: "0 auto", background: C.charcoal, borderRadius: 40, padding: "96px 48px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 12, fontFamily: SANS, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(245,245,235,0.62)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.orange, display: "inline-block" }} />
          Get started
        </div>
        <h2 style={{ fontSize: "clamp(38px,5.4vw,76px)", fontWeight: 500, color: "#F5F5EB", letterSpacing: "-0.04em", lineHeight: 0.92, marginBottom: 24 }}>
          Ready to grow your Etsy shop?
        </h2>
        <p style={{ fontSize: 19, color: "rgba(245,245,235,0.6)", marginBottom: 40, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
          Start using real Etsy data to rank higher and sell more — free while we&apos;re in beta.
        </p>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{ background: C.orange, color: "#fff", textDecoration: "none", padding: "16px 34px", borderRadius: 28, fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em", transition: "opacity 0.18s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            Start free — no card
          </Link>
          <a href="#keywords" style={{ color: "#F5F5EB", fontSize: 16, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 5, textDecorationColor: "rgba(245,245,235,0.4)" }}>
            Try the keyword tool ↓
          </a>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Footer — dark island (Perk's only inverted moment) ────────────────────── */
export function Footer() {
  const cols = [
    { t: "Product",  l: [["Keyword Tool", "/#keywords"], ["Features", "/#features"], ["Dashboard", "/dashboard"]] as [string, string][] },
    { t: "Company",  l: [["About", "/about"], ["Contact", "/contact"]] as [string, string][] },
    { t: "Legal",    l: [["Privacy Policy", "/privacy"], ["Terms", "/terms"], ["Data & Methodology", "/methodology"]] as [string, string][] },
  ];
  const dim = "rgba(245,245,235,0.62)";
  return (
    <footer style={{ background: C.ink, padding: "88px 40px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Brand + link columns */}
        <div className="rgrid-4" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 48, paddingBottom: 48, borderBottom: `1px solid rgba(245,245,235,0.14)` }}>
          <div>
            <img src="/website_logo.png" alt="Rankkw" style={{ width: 132, height: 44, objectFit: "contain", display: "block", marginBottom: 20, filter: "brightness(0) invert(1)" }} />
            <p style={{ fontSize: 15, color: dim, lineHeight: 1.55, maxWidth: 300, marginBottom: 22 }}>
              Data-driven keyword research and analytics for Etsy sellers. Grow smarter, not harder.
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: SANS, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: C.ash }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange, display: "inline-block" }} />
              Built on the official Etsy Open API v3
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.t}>
              <h4 style={{ fontSize: 11, fontFamily: SANS, fontWeight: 500, color: C.ash, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20 }}>
                {c.t}
              </h4>
              {c.l.map(([label, href]) => (
                <a key={label} href={href}
                  style={{ display: "block", fontSize: 14.5, color: dim, textDecoration: "none", marginBottom: 13, transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = dim)}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 26 }}>
          <p style={{ fontSize: 12.5, color: dim, margin: 0 }}>© 2026 Rankkw. All rights reserved.</p>
          <div style={{ display: "flex", gap: 22 }}>
            {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Methodology", "/methodology"], ["Contact", "/contact"]].map(([l, h]) => (
              <a key={l} href={h} style={{ fontSize: 12.5, color: dim, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = dim)}>{l}</a>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "rgba(245,245,235,0.4)", margin: "16px 0 0", lineHeight: 1.6, maxWidth: 820 }}>
          The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
        </p>
      </div>
    </footer>
  );
}
