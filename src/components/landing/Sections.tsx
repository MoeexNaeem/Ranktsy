"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { C } from "@/utils";
import { SocialRow } from "@/components/ui/Social";
import { WhatsAppIcon, WHATSAPP_HREF, WHATSAPP_DISPLAY } from "@/components/ui/WhatsApp";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { PlanScroller, PriceNote } from "./plans";

const SANS = "'General Sans',sans-serif";

/* ─── Card icon ────────────────────────────────────────────────────────────────
   Emoji were used here originally, but the site sets `font-family: 'General Sans'`
   and that face carries no emoji glyphs - on real devices they fell back to a
   blank tofu box (visible in the contact card on iOS). Inline SVG renders
   identically everywhere, inherits colour, and matches the icon set the
   dashboard already uses. */
/* Arrow glyph used in the new arrow-circle affordances. */
function ArrowIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
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
   recommendations based on real search data" - Etsy publishes no search-volume
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
    desc: "See the true count of active listings for any exact keyword, and how strongly the incumbents convert views into favorites - so you know what you're up against before you list.",
  },
  {
    title: "Market Insights",
    desc: "Analyze tag usage, category mix, price distribution and listing age across the live listings ranking for a keyword, to spot gaps competitors have left open.",
  },
  {
    title: "Top Sellers & Real Sales",
    desc: "Rank the leading shops in any niche by their real lifetime sales - Etsy's own transaction count - alongside reviews, rating, country and year opened.",
  },
  {
    title: "Tag Optimizer",
    desc: "Score your 13 tags against the tags the listings ranking for your keyword actually use, taken straight from the Etsy API - not generic advice.",
  },
  {
    title: "Shop Analytics",
    desc: "Connect your Etsy shop to see your own views, favorites, orders, revenue and buyer geography, read from your Etsy receipts with your consent.",
  },
];


// A restrained accent per card - colour lives in the icon chip, the hover border
// and the top accent bar, so the section reads calm/premium, not loud.
const F_ACCENTS = [
  { fg: "#FB5E09", bg: "rgba(251,94,9,0.10)",   sh: "rgba(251,94,9,0.34)" },   // brand orange
  { fg: "#0E9384", bg: "rgba(14,147,132,0.10)", sh: "rgba(14,147,132,0.30)" }, // teal
  { fg: "#6366F1", bg: "rgba(99,102,241,0.10)", sh: "rgba(99,102,241,0.30)" }, // indigo
  { fg: "#C2870C", bg: "rgba(194,135,12,0.12)", sh: "rgba(194,135,12,0.30)" }, // amber
  { fg: "#DB4C3F", bg: "rgba(219,76,63,0.10)",  sh: "rgba(219,76,63,0.30)" },  // rose
  { fg: "#1F8A4C", bg: "rgba(31,138,76,0.10)",  sh: "rgba(31,138,76,0.28)" },  // green
];

const F_ICONS: React.ReactNode[] = [
  <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,                                   // search
  <><line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="8" /><line x1="18" y1="20" x2="18" y2="4" /></>, // bars
  <><path d="M21 15.5A9 9 0 1 1 8.5 3" /><path d="M21.4 12A9.4 9.4 0 0 0 12 2.6V12z" /></>,                              // pie
  <><path d="M6 9a6 6 0 0 0 12 0V4H6z" /><path d="M6 5H3v2a3 3 0 0 0 3 3" /><path d="M18 5h3v2a3 3 0 0 1-3 3" /><line x1="9" y1="21" x2="15" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>, // trophy
  <><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1.3" /></>, // tag
  <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></>, // dashboard
];

/* ─── Decorative background doodles ──────────────────────────────────────────
   The Features section is otherwise a lot of white space, so a subtle layer of
   dotted, wandering hand-drawn lines + floating sparkles gives it life without
   competing with the cards. Purely decorative → aria-hidden, pointer-events off,
   and sits behind the content (zIndex 0). Reuses the `.cx-float` animation. */
function Sparkle({ size, color, style, dur, delay }: {
  size: number; color: string; style: React.CSSProperties; dur: number; delay: number
}) {
  return (
    <div className="cx-spark cx-float" aria-hidden
      style={{ ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${delay}s`, ...style }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 0c.7 6.4 4.9 10.6 12 12-7.1 1.4-11.3 5.6-12 12-.7-6.4-4.9-10.6-12-12C7.1 10.6 11.3 6.4 12 0Z" fill={color} />
      </svg>
    </div>
  );
}

/* Outline ring (optionally dashed). */
function Ring({ size, color, dashed, style, dur, delay }: {
  size: number; color: string; dashed?: boolean; style: React.CSSProperties; dur: number; delay: number
}) {
  const r = size / 2 - 2;
  return (
    <div className="cx-spark cx-float" aria-hidden
      style={{ ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${delay}s`, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="2.4"
          strokeDasharray={dashed ? "3 6" : undefined} strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* Little plus / cross mark. */
function Plus({ size, color, style, dur, delay }: {
  size: number; color: string; style: React.CSSProperties; dur: number; delay: number
}) {
  return (
    <div className="cx-spark cx-float" aria-hidden
      style={{ ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${delay}s`, ...style }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
        strokeWidth="2.6" strokeLinecap="round">
        <line x1="12" y1="4" x2="12" y2="20" /><line x1="4" y1="12" x2="20" y2="12" />
      </svg>
    </div>
  );
}

/* Crisp hand-drawn doodle rendered in its own SVG (stays sharp - no full-bleed
   stretching). `d` is drawn in a 0..vb box; scaled by `size`. */
function Doodle({ d, vb = 60, size, color, style, dur, delay, dashed }: {
  d: string; vb?: number; size: number; color: string
  style: React.CSSProperties; dur: number; delay: number; dashed?: boolean
}) {
  return (
    <div className="cx-spark cx-float" aria-hidden
      style={{ ["--dur" as string]: `${dur}s`, ["--delay" as string]: `${delay}s`, ...style }}>
      <svg width={size} height={(size * 0.62) | 0} viewBox={`0 0 ${vb} ${vb * 0.62}`} fill="none">
        <path d={d} stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={dashed ? "2 7" : undefined} />
      </svg>
    </div>
  );
}

/* Teal from the illustrations (#1C5D5F) - deliberately darker accent so the
   line-work reads as intentional, not faint texture. */
const TEAL = "#1C5D5F";
const SQUIGGLE = "M2 19 C 8 6, 15 6, 20 15 S 32 26, 38 15 S 52 6, 58 16";
const CURL = "M6 30 C 2 14, 20 6, 30 16 C 37 23, 30 33, 22 29 C 16 26, 18 18, 25 20";

function FeaturesDecor() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <svg width="100%" height="100%" viewBox="0 0 1440 820" preserveAspectRatio="none" fill="none"
        style={{ position: "absolute", inset: 0 }}>
        {/* one long, graceful diagonal S threading the whole section (the hero line) */}
        <path d="M40 690 C 360 600, 470 360, 760 340 C 1050 320, 1160 470, 1400 300"
          stroke={TEAL} strokeWidth="3.4" strokeLinecap="round" strokeDasharray="2 13" opacity="0.85" />
        {/* gentle arc sweeping the empty top-right, beside the heading */}
        <path d="M880 120 C 1060 40, 1240 120, 1400 70"
          stroke={C.orange} strokeWidth="3.2" strokeLinecap="round" strokeDasharray="2 13" opacity="0.9" />
        {/* calm wave riding the bottom edge */}
        <path d="M60 780 C 380 720, 700 800, 1020 740 C 1240 700, 1320 770, 1400 745"
          stroke={C.stone} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 13" opacity="0.8" />
        {/* soft curve dropping down the left gutter */}
        <path d="M120 150 C 60 280, 150 360, 90 470"
          stroke={TEAL} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 12" opacity="0.55" />
        {/* short orange accent on the right */}
        <path d="M1300 430 C 1380 500, 1300 590, 1360 660"
          stroke={C.orange} strokeWidth="2.8" strokeLinecap="round" strokeDasharray="2 12" opacity="0.6" />
      </svg>

      {/* Crisp doodles */}
      <Doodle d={CURL} vb={40} size={52} color={TEAL} style={{ position: "absolute", top: 210, right: "17%" }} dur={7.2} delay={0.3} />
      <Doodle d={SQUIGGLE} size={64} color={C.orange} style={{ position: "absolute", bottom: 130, left: "23%" }} dur={6.5} delay={0.9} />
      <Doodle d={SQUIGGLE} size={54} color={C.stone} style={{ position: "absolute", top: 150, right: "33%" }} dur={6.8} delay={0.5} />

      {/* Sparkles */}
      <Sparkle size={26} color={C.orange} style={{ position: "absolute", top: 70,  right: "9%" }}  dur={5.6} delay={0.2} />
      <Sparkle size={18} color={TEAL}     style={{ position: "absolute", top: 178, right: "23%" }} dur={6.3} delay={0.9} />
      <Sparkle size={16} color={C.orange} style={{ position: "absolute", top: "46%", right: "3.5%" }} dur={6.0} delay={0.5} />
      <Sparkle size={20} color={TEAL}     style={{ position: "absolute", bottom: 84, left: "33%" }} dur={5.9} delay={1.1} />
      <Sparkle size={14} color={C.orange} style={{ position: "absolute", bottom: 160, right: "31%" }} dur={6.6} delay={0.4} />
      <Sparkle size={16} color={C.stone}  style={{ position: "absolute", top: "40%", left: "1.5%" }} dur={6.1} delay={0.7} />

      {/* Rings */}
      <Ring size={34} color={C.orange} dashed style={{ position: "absolute", top: 300, right: "9%" }} dur={7.2} delay={0.3} />
      <Ring size={22} color={TEAL}     style={{ position: "absolute", bottom: 120, left: "8%" }} dur={6.4} delay={1.0} />
      <Ring size={44} color={C.stone}  dashed style={{ position: "absolute", bottom: 40, right: "13%" }} dur={7.6} delay={0.6} />

      {/* Plus marks */}
      <Plus size={18} color={C.orange} style={{ position: "absolute", top: 120, right: "40%" }} dur={6.0} delay={0.8} />
      <Plus size={15} color={TEAL}     style={{ position: "absolute", top: "58%", right: "8%" }} dur={6.7} delay={0.2} />
      <Plus size={16} color={C.stone}  style={{ position: "absolute", bottom: 200, left: "18%" }} dur={5.7} delay={1.2} />

      {/* Solid dots */}
      <span style={{ position: "absolute", top: 44,  right: "17%", width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
      <span style={{ position: "absolute", top: 240, right: "5%",  width: 7, height: 7, borderRadius: "50%", background: TEAL }} />
      <span style={{ position: "absolute", top: "52%", left: "3%", width: 8, height: 8, borderRadius: "50%", background: C.stone }} />
      <span style={{ position: "absolute", bottom: 66, left: "47%", width: 7, height: 7, borderRadius: "50%", background: TEAL }} />
      <span style={{ position: "absolute", bottom: 210, left: "3%", width: 7, height: 7, borderRadius: "50%", background: C.orange }} />
      <span style={{ position: "absolute", bottom: 96, right: "26%", width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
    </div>
  );
}

export function Features() {
  return (
    <section id="features" style={{ padding: "84px 40px 120px", background: C.paper, position: "relative", overflow: "hidden" }}>
      <FeaturesDecor />
      <div style={{ maxWidth: 1160, margin: "0 auto", position: "relative", zIndex: 1 }}>
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
        <RevealGroup className="rgrid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} stagger={0.09}>
          {FEATURES.map((f, i) => {
            const a = F_ACCENTS[i % F_ACCENTS.length];
            return (
              <RevealItem key={f.title} style={{ height: "100%" }}>
                <div className="feature-card" style={{ "--fc-fg": a.fg, "--fc-bg": a.bg, "--fc-shadow": a.sh } as React.CSSProperties}>
                  <div className="feature-icon">
                    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {F_ICONS[i % F_ICONS.length]}
                    </svg>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: SANS, fontWeight: 600, letterSpacing: "0.11em", color: a.fg, marginBottom: 10 }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 style={{ fontSize: 23, fontWeight: 500, color: C.ink, marginBottom: 11, letterSpacing: "-0.03em", lineHeight: 1.16 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6 }}>
                    {f.desc}
                  </p>
                </div>
              </RevealItem>
            );
          })}
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
  // Palette built from the brand + illustration colours. Arranged so teal never
  // neighbours a yellow (multiply of the two would read as off-brand green).
  const STEP_COLORS = ["#FB5E09", "#1C5D5F", "#E4572E", "#C0498A"]; // orange · teal · coral · berry
  const CX = ["12.5%", "37.5%", "62.5%", "87.5%"]; // node centres across the row
  const PILLS = [
    { left: "12.5%", color: "#C0498A" }, // orange↔teal  bridged by berry
    { left: "37.5%", color: "#C0498A" }, // teal↔coral   bridged by berry
    { left: "62.5%", color: "#F6B03A" }, // coral↔berry  bridged by amber
  ];

  // Scroll-scrubbed reveal: on desktop the section PINS (sticky stage inside a tall
  // track) and scroll progress (0→1) drives the chain - node 01 on arrival, then
  // 02, 03, 04 reveal one per scroll. `at(i)` returns the settled transform when
  // progress passes that step's threshold, keeping the multiply-blend intact once
  // landed. Below 1024px there's no pin: everything is simply shown.
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const desktop = () => window.matchMedia("(min-width: 1025px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !desktop()) { setProgress(1); return; }
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!desktop()) { setProgress(1); return; }
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight; // scrubbable distance
      const p = total > 0 ? Math.min(Math.max(-rect.top, 0), total) / total : 1;
      setProgress(p);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  // Reveal thresholds: 01 on arrival, then one node per scroll step.
  const TH = [0, 0.3, 0.58, 0.85];
  const at = (i: number, rest = "none"): CSSProperties => {
    const on = progress >= TH[i];
    return {
      opacity: on ? 1 : 0,
      transform: on ? rest : (rest === "none" ? "scale(0.35)" : `${rest} scale(0.35)`),
      transition: "opacity .5s ease, transform .55s cubic-bezier(.34,1.56,.64,1)",
      willChange: "transform, opacity",
    };
  };

  return (
    <section style={{ background: C.paper }}>
      <div ref={trackRef} className="hiw-track" style={{ position: "relative", height: "220vh" }}>
        <div className="hiw-stage" style={{ position: "sticky", top: 0, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 40px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
            <Reveal>
              <SectionTag>How it works</SectionTag>
              <h2 style={{ fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 500, letterSpacing: "-0.03em", color: C.ink, lineHeight: 1.0, marginBottom: 16, maxWidth: 760 }}>
                From search to sale in four steps.
              </h2>
              <p style={{ fontSize: 18, color: "#6E6E64", lineHeight: 1.5, letterSpacing: "-0.14px", maxWidth: 500, marginBottom: 56 }}>
                Rankkw turns complex Etsy data into clear, actionable insights.
              </p>
            </Reveal>

            {/* Overlapping colour-chain - draws node-by-node as you scroll (01→04) */}
            <div className="hiw-chain" aria-hidden>
              {/* soft blobs bleeding off both edges */}
              <div className="hiw-shape" style={{ left: -60, top: 21, width: 90, height: 90, borderRadius: "50%", background: "#F6B03A", ...at(0) }} />
              <div className="hiw-shape" style={{ right: -60, top: 21, width: 90, height: 90, borderRadius: "50%", background: "#1C5D5F", ...at(3) }} />
              {/* connecting pills - each appears with the node it leads INTO */}
              {PILLS.map((p, i) => (
                <div key={i} className="hiw-shape" style={{ left: p.left, top: 43, width: "25%", height: 46, borderRadius: 23, background: p.color, ...at(i + 1) }} />
              ))}
              {/* numbered nodes */}
              {STEP_COLORS.map((c, i) => (
                <div key={i} className="hiw-shape" style={{ left: CX[i], top: 18, width: 96, height: 96, borderRadius: "50%", background: c, ...at(i, "translateX(-50%)") }} />
              ))}
              {/* numbers ride above the blend so they stay crisp white */}
              {steps.map((s, i) => (
                <span key={s.n} style={{ position: "absolute", left: CX[i], top: 66, color: "#fff", fontSize: 34, fontWeight: 600, fontFamily: "'General Sans',monospace", letterSpacing: "-1px", ...at(i, "translate(-50%,-50%)") }}>
                  {s.n}
                </span>
              ))}
            </div>

            <div className="rgrid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 28 }}>
              {steps.map((s, i) => (
                <div key={s.n} style={{ textAlign: "center", ...at(i) }}>
                  {/* inline badge - the chain's mobile fallback */}
                  <span className="hiw-badge" style={{ width: 54, height: 54, borderRadius: "50%", background: STEP_COLORS[i], color: "#fff", fontSize: 22, fontWeight: 600, fontFamily: "'General Sans',monospace", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    {s.n}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 10, fontSize: 11, fontFamily: "'General Sans',monospace", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: STEP_COLORS[i] }}>
                    Step {s.n}
                  </div>
                  <h3 style={{ fontSize: 21, fontWeight: 500, color: C.ink, marginBottom: 10, letterSpacing: "-0.3px", lineHeight: 1.2 }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 15, color: "#6E6E64", lineHeight: 1.55, letterSpacing: "-0.1px", maxWidth: 260, marginLeft: "auto", marginRight: "auto" }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ────────────────────────────────────────────────────────────────
   Roomy plan cards live in ./plans (shared with the /pricing page + compare table).
   Display-only for now - CTAs carry the chosen plan to /register (?plan=slug). */

export function Pricing() {
  return (
    <section id="pricing" style={{ padding: "120px 24px", background: C.paper }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center" }}>
          <SectionTag center>Pricing</SectionTag>
          <h2 style={{ fontSize: "clamp(34px,4.6vw,56px)", fontWeight: 500, letterSpacing: "-0.03em", color: C.ink, lineHeight: 1.0, marginBottom: 16 }}>
            Plans that grow with your shop.
          </h2>
          <p style={{ fontSize: 18, color: "#6E6E64", lineHeight: 1.5, letterSpacing: "-0.14px", maxWidth: 520, margin: "0 auto 52px" }}>
            Start free and upgrade whenever you&apos;re ready. Every plan runs on the same real Etsy data.
          </p>
        </Reveal>

        <Reveal>
          <PlanScroller fade={C.paper} />
        </Reveal>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 40 }}>
          <Link href="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 500, color: C.ink, textDecoration: "none", border: `1px solid ${C.ash}`, borderRadius: 100, padding: "12px 22px", transition: "background 0.15s, border-color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.bone; e.currentTarget.style.borderColor = C.ink; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.ash; }}>
            Compare all features →
          </Link>
          <p style={{ textAlign: "center", fontSize: 13.5, color: "#6E6E64" }}>
            <PriceNote /> Cancel anytime - no long-term contracts.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── About + Contact Teaser ───────────────────────────────────────────────── */
export function AboutContactTeaser() {
  return (
    <section style={{ padding: '96px 40px', background: C.paper }}>
      <Reveal className="rsplit" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* About card - bone surface */}
        <a
          href="/about"
          style={{
            background: C.bone, borderRadius: 28, padding: '46px 44px 40px',
            display: 'flex', flexDirection: 'column', textDecoration: 'none', transition: 'transform 0.18s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          {/* icon chip - SVG, not emoji: 'General Sans' carries no emoji glyph. */}
          <span style={{ width: 52, height: 52, borderRadius: 15, background: C.paper, display: 'grid', placeItems: 'center', marginBottom: 24, boxShadow: '0 6px 16px rgba(61,62,59,0.08)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F7A42" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21c0-6 3-9 8-10-1 6-4 9-8 10z" /><path d="M12 21c0-5-2-8-6-9 1 5 3 8 6 9z" /><line x1="12" y1="21" x2="12" y2="14" />
            </svg>
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 11.5, fontFamily: SANS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.orange }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
            Our Story
          </div>
          <h3 style={{ fontSize: 'clamp(24px, 2.7vw, 32px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.12, marginBottom: 14 }}>
            Built by Etsy sellers,<br />for Etsy sellers.
          </h3>
          <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.62, marginBottom: 30, maxWidth: 430 }}>
            We spent years selling on Etsy, manually tracking keywords in spreadsheets. Rankkw is the tool we always wished existed.
          </p>
          <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600, color: C.ink }}>
            Read our story
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', boxShadow: '0 6px 14px rgba(251,94,9,0.3)' }}>
              <ArrowIcon color="#fff" size={15} />
            </span>
          </span>
        </a>

        {/* Contact card - charcoal surface */}
        <a
          href="/contact"
          style={{
            background: C.charcoal, borderRadius: 28, padding: '46px 44px 40px',
            display: 'flex', flexDirection: 'column', textDecoration: 'none', transition: 'transform 0.18s',
            position: 'relative', overflow: 'hidden',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          <div aria-hidden style={{ position: 'absolute', top: '-30%', right: '-10%', width: 340, height: 300, background: 'radial-gradient(50% 50% at 50% 50%, rgba(251,94,9,0.18), transparent 70%)', pointerEvents: 'none' }} />
          <span style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', marginBottom: 24, position: 'relative' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.snow} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
            </svg>
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 11.5, fontFamily: SANS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.orange, position: 'relative' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
            Get in touch
          </div>
          <h3 style={{ fontSize: 'clamp(24px, 2.7vw, 32px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.snow, lineHeight: 1.12, marginBottom: 14, position: 'relative' }}>
            Questions? We&apos;re<br />always listening.
          </h3>
          <p style={{ fontSize: 15.5, color: 'rgba(245,245,235,0.66)', lineHeight: 1.62, marginBottom: 30, maxWidth: 430, position: 'relative' }}>
            From technical support to feature requests, our team responds within 24 hours on business days.
          </p>
          <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600, color: C.snow, position: 'relative' }}>
            Contact us
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', boxShadow: '0 6px 14px rgba(251,94,9,0.3)' }}>
              <ArrowIcon color="#fff" size={15} />
            </span>
          </span>
        </a>
      </Reveal>
    </section>
  )
}

/* ─── CTA - full-bleed lime accent panel (Perk's signature) ─────────────────── */
export function CTA() {
  return (
    <section style={{ padding: "56px 24px 120px", background: C.paper }}>
      <Reveal style={{ maxWidth: 1160, margin: "0 auto", background: C.charcoal, borderRadius: 40, padding: "96px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: "-38%", left: "50%", transform: "translateX(-50%)", width: 760, height: 540, background: "radial-gradient(50% 50% at 50% 50%, rgba(251,94,9,0.22), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 12, fontFamily: SANS, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(245,245,235,0.62)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.orange, display: "inline-block" }} />
            Get started
          </div>
          <h2 style={{ fontSize: "clamp(38px,5.4vw,76px)", fontWeight: 600, color: "#F5F5EB", letterSpacing: "-0.04em", lineHeight: 0.95, marginBottom: 24 }}>
            Ready to grow your Etsy shop?
          </h2>
          <p style={{ fontSize: 19, color: "rgba(245,245,235,0.6)", marginBottom: 40, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Start using real Etsy data to rank higher and sell more - free to start, upgrade anytime.
          </p>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/register" style={{ background: C.orange, color: "#fff", textDecoration: "none", padding: "16px 34px", borderRadius: 30, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", display: "inline-flex", alignItems: "center", gap: 9, boxShadow: "0 16px 34px rgba(251,94,9,0.34)", transition: "opacity 0.18s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Start free - no card <ArrowIcon color="#fff" size={16} />
            </Link>
            <a href="#keywords" style={{ color: "#F5F5EB", fontSize: 16, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 5, textDecorationColor: "rgba(245,245,235,0.4)" }}>
              Try the keyword tool ↓
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Footer - dark island (Perk's only inverted moment) ────────────────────── */
export function Footer() {
  const cols = [
    { t: "Etsy Tools", l: [
      ["Keyword Research", "/etsy-keyword-research"], ["Competitor Analysis", "/etsy-competitor-analysis"],
      ["Trends & Demand", "/etsy-trend-analysis"], ["Top Sellers", "/etsy-top-sellers"], ["Find Hot Products", "/etsy-find-hot-products"],
      ["Tag Optimizer", "/etsy-tag-optimizer"], ["Etsy Listing Pro", "/etsy-listing-generator"], ["AI Title & Tags", "/etsy-ai-title-tag-generator"],
      ["Listing Audit", "/etsy-listing-audit"], ["Shop Analytics", "/etsy-shop-analytics"],
    ] as [string, string][] },
    { t: "Product",  l: [["Live Keyword Tool", "/#keywords"], ["Pricing", "/pricing"], ["Blog", "/blogs"], ["Fee Calculator", "/etsy-fee-calculator"], ["Dashboard", "/dashboard"]] as [string, string][] },
    { t: "Company",  l: [["About", "/about"], ["Contact", "/contact"], ["Data & Methodology", "/methodology"]] as [string, string][] },
    { t: "Legal",    l: [["Privacy Policy", "/privacy"], ["Terms", "/terms"], ["Service Policy", "/service-policy"], ["Refund & Return Policy", "/refund-policy"]] as [string, string][] },
  ];
  const dim = "rgba(245,245,235,0.62)";
  return (
    <footer style={{ background: C.ink, padding: "88px 40px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Brand + link columns */}
        <div className="rgrid-4" style={{ display: "grid", gridTemplateColumns: "1.5fr 1.1fr 0.9fr 0.9fr 1fr", gap: 40, paddingBottom: 48, borderBottom: `1px solid rgba(245,245,235,0.14)` }}>
          <div>
            <img src="/website_logo.png" alt="Rankkw" style={{ width: 132, height: 44, objectFit: "contain", display: "block", marginBottom: 20, filter: "brightness(0) invert(1)" }} />
            <p style={{ fontSize: 15, color: dim, lineHeight: 1.55, maxWidth: 300, marginBottom: 22 }}>
              Data-driven keyword research and analytics for Etsy sellers. Grow smarter, not harder.
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: SANS, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: C.ash, marginBottom: 26 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange, display: "inline-block" }} />
              Built on the official Etsy Open API v3
            </div>
            <SocialRow color={dim} hoverColor="#fff" />

            {/* WhatsApp - opens a chat with support */}
            <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer"
              aria-label={`Chat with us on WhatsApp: ${WHATSAPP_DISPLAY}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 22, padding: "10px 16px", borderRadius: 100, background: "#25D366", color: "#0B141A", textDecoration: "none", fontSize: 14.5, fontWeight: 600, fontFamily: SANS, transition: "opacity 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              <WhatsAppIcon size={20} color="#0B141A" />
              {WHATSAPP_DISPLAY}
            </a>
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
            {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Service Policy", "/service-policy"], ["Refund Policy", "/refund-policy"], ["Methodology", "/methodology"], ["Contact", "/contact"]].map(([l, h]) => (
              <a key={l} href={h} style={{ fontSize: 12.5, color: dim, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = dim)}>{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
