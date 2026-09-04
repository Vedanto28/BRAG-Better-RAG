# BRAG — README visual assets

Every visual referenced by the root `README.md` lives here. All of them are hand-authored SVG: no build step, no dependencies, no generation script required. Editing one is a matter of opening the file and changing numbers or text.

## Manifest

| File | Type | What it shows | Where it's used |
|---|---|---|---|
| `brag-hero.svg` | Animated (SMIL) | Wordmark plus the six-stage investigation pipeline, with a signal travelling through it and nodes activating in sequence | Hero |
| `investigation-pipeline.svg` | Animated (SMIL) | The full lifecycle including the conditional evidence gate and both branches | *How an investigation works* |
| `architecture.svg` | Static | Client → API → Mechamaru orchestrator → external plane → Neon persistence | *Architecture* |
| `hybrid-rag.svg` | Static | Vector and keyword lanes fused by RRF, with corpus and context-size figures | *Hybrid RAG* |
| `evidence-provenance.svg` | Static | Observed fact vs repository fact vs inference, each with a real example | *Evidence provenance* |
| `diagnostic-panel.svg` | Static | Representative mockup of a structured diagnostic response | *Diagnostic intelligence* |
| `provider-routing.svg` | Animated (SMIL) | Provider router, quota windows, fallback and the BYOK credential path | *Multi-provider & BYOK* |
| `engineering-proof.svg` | Static | Phase test results, build output, secret audit, ingestion counts | *Engineering proof* |
| `roadmap.svg` | Static | One implemented stage and five clearly-marked future stages | *Roadmap* |

## Conventions

**Palette** — background `#090C16`, surface `#0E1424`, border `#2A3350`, grid `#111726`. Accents: violet `#A78BFA` (agent and reasoning), sky `#38BDF8` (evidence and infrastructure), mint `#34D399` (verified, observed, passing), amber `#FBBF24` (gate, inference, caution), slate `#64748B` / `#475569` (secondary text).

**Type** — a single monospace stack (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`), set as an attribute on the root `<svg>` so it inherits everywhere.

**Animation** — SMIL only (`<animate>`, `<animateTransform>`). GitHub renders this natively for SVGs served from the repository. No CSS animation, no `<style>` blocks, no JavaScript, no external fonts or references — every asset is fully self-contained and renders identically offline.

**Restraint** — motion is used in three files only, and each animation describes system behaviour (a signal moving through the pipeline, a gate pulsing, the router selecting a provider). Nothing spins, flashes or loops purely for decoration.

## Regenerating or editing

There is nothing to regenerate. To change a value, edit the text node directly:

```bash
# example: after a new test run
grep -n "5/5" docs/assets/engineering-proof.svg
```

If you change a figure in an asset, change it in `README.md` too — the two must never disagree. Every number in these files came from real command output; keep it that way.

## Adding a new asset

Match the palette and type conventions above, keep the file self-contained, add a row to the manifest table, and reference it from the README with a plain relative `<img>` inside a `<div align="center">` block.
