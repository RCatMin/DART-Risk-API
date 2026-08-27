---
schema: omd.preferences/v1
design_md_hash_at_creation:
---

# Preference Log

## 2026-08-25T03:27:12.913Z — introduced-off-palette-color-s-d92d20-2f

```omd-meta
id: pref_mt83tamp_b28c80dd
timestamp: 2026-08-25T03:27:12.913Z
scope: color
signal: ambient
confidence: inferred
status: pending
source_agent: claude-code
source_context: "dashboard/src/components/MarketPanel.css"
```

Introduced off-palette color(s) #d92d20, #2f6fed in dashboard/src/components/MarketPanel.css — not in DESIGN.md

## 2026-08-25T03:27:37.404Z — market-panel-up-down-colors

```omd-meta
id: pref_mt83toq0_3a87bae9
timestamp: 2026-08-25T03:27:37.404Z
scope: color
signal: user-statement
confidence: explicit
status: pending
source_agent: claude-code
source_context: "dashboard/src/components/MarketPanel.css, MarketPanel.tsx"
```

Market panel (KOSPI/KOSDAQ index, watchlist stock prices) needs its own up/down colors: up #d92d20 (red), down #2f6fed (blue) — follows Korean stock market convention (red=up, blue=down), deliberately a different hue from risk-severity red (color.severity-high-fg #e42939) so price direction is never confused with risk severity. Direction is never color-only — a ▲/▼ arrow always accompanies the color. Pending formal adoption into DESIGN.md Foundations as new tokens (e.g. color.market-up, color.market-down) via omd:learn.
