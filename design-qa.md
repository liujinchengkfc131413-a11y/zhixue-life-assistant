# Today V3 Scene Background + Phase 1 Layout · Design QA

## 2026-08-23 · Scene background follow-up

- source visual truth path: `D:/Downloads/ChatGPT Image 2026年8月15日 15_20_54.png`
- implementation screenshot path: `D:/Documents/知雪的生活助手/docs/design/today/v3/today-scene-background/implementation-1536x1024.png`
- side-by-side comparison path: `D:/Documents/知雪的生活助手/docs/design/today/v3/today-scene-background/comparison-side-by-side.jpg`
- scene asset path: `D:/Documents/知雪的生活助手/apps/web/src/assets/today/today-scene-environment-v3.png`
- viewport / pixels / DPR: 1536 × 1024 CSS px / 1536 × 1024 px / 1
- state: Today route, `todayV3Motion=0`, real local data, static fountain presentation

Findings:

- No actionable P0, P1, or P2 remains for the requested Scene-background pass. The environment, mist, pool and wet ground now form one full-bleed plate across the 1296px Today content region; the former stage-local rectangular image edge is gone.
- The final background is the darker midpoint revision requested on 2026-08-23: its corners retain more living teal than the original dark draft, while `saturate(0.98) brightness(0.9) contrast(1.03)` keeps overall brightness and chroma biased toward that original draft rather than the rejected bright revision.
- The central fountain remains a static project asset for this phase. Fountain motion/material matching and live content-density differences remain P3 follow-up items and are not claimed as complete here.

Verification:

- Full-view reference and implementation were inspected together at equal 1536 × 1024 halves in `comparison-side-by-side.jpg`.
- Runtime audit: one full-scene backdrop, no stage-local environment image, no horizontal overflow, static fountain and all named UI regions visible.
- Browser screenshot is a real Chrome capture at 1536 × 1024, not a resized preview.

final result: passed

---

- source visual truth path: `D:/Downloads/ChatGPT Image 2026年8月15日 15_20_54.png`
- implementation screenshot path: `D:/Documents/知雪的生活助手/docs/design/today/v3/phase1-layout-refresh/implementation-1536x1024.png`
- side-by-side comparison path: `D:/Documents/知雪的生活助手/docs/design/today/v3/phase1-layout-refresh/comparison-side-by-side.png`
- viewport: 1536 × 1024 CSS px
- source pixels: 1536 × 1024
- implementation pixels: 1536 × 1024
- density normalization: source and implementation are both 1:1 at device scale 1; no resampling was used for the judged full-view pair
- state: Today route, real local demo data, static photographic fountain emphasized; unavailable weather is shown honestly

**Findings**

- No actionable P0, P1, or P2 layout mismatch remains for the requested Gate 1 goal. The 240px sidebar, 1296px continuous scene, header anchors, 930px fountain stage, 190px pressure card, four-state stack, 335px plan rail, 810px timeline, and 810px AI composer occupy the same major regions as the source.
- [P3] The supplied static fountain asset is slightly more opaque and geometrically cleaner than the reference fountain.
  Location: central fountain water body.
  Evidence: the source has denser aerated fine streams and warmer mist; the implementation uses the project's existing transparent photographic fountain asset over the existing environment and pool layers.
  Impact: it does not change the first-glance region distribution, but the water texture is not a pixel-identical recreation.
  Follow-up: leave for the later fountain-motion/material pass; do not destabilize the approved Gate 1 composition.
- [P3] The local verification state has fewer scheduled items than the concept image.
  Location: three right-side plan cards and the timeline.
  Evidence: card boundaries and internal padding match, while the real local demo data contains an empty plan/upcoming state and one flexible task.
  Impact: live content density is lower, but no production data is fabricated for visual similarity.
  Follow-up: retain real data behavior and use the existing fixture suite for dense-state regression.

**Required fidelity surfaces**

- Fonts and typography: Segoe UI / Microsoft YaHei fallback, title scale, body hierarchy, numeric emphasis, and single-line truncation are coherent with the source. The date now shares the title row and the lunar line sits beneath it.
- Spacing and layout rhythm: passed at 1536 × 1024. Major x/y anchors and card gaps match the V3 table and the source comparison; no horizontal overflow, overlap, or persistent-control clipping is visible.
- Colors and visual tokens: deep teal scene, warm-white water, weak glass borders, state accents, white sidebar, and green selected/navigation/composer states map to the source direction without neon or opaque dark panels.
- Image quality and asset fidelity: the implementation uses the existing real raster environment, pool, water-surface, and transparent fountain assets. No CSS/SVG substitute was introduced for the fountain.
- Copy and content: Today, date, lunar date, environmental sentence, weather unavailable state, pressure explanation, plan headings, timeline labels, and AI prompt are coherent. Dynamic data intentionally differs from concept data.
- Icons: sidebar and state icons use the existing Lucide icon family with consistent stroke weight; the profile uses a real library icon instead of a placeholder glyph.
- States and interactions: Today loads, sidebar navigation changes the URL to `/work` and returns to `/`, pressure factors remain operable, timeline and plan controls remain in the DOM, and the AI input retains its configured-provider disabled state.

**Full-view comparison evidence**

- The source and implementation were opened together in `comparison-side-by-side.png` at equal 1536 × 1024 halves. The comparison confirms matching first-glance distribution for every region named in the user request.

**Focused region comparison evidence**

- No extra crop was required for this Gate 1 pass because the acceptance target is overall region distribution and all named UI labels remain readable in the full-resolution 3072 × 1024 comparison. Fountain micro-material is explicitly deferred as P3.

**Comparison history**

1. Earlier evidence: `before-layout-refresh.png` showed the prior shell with smaller typography, a less reference-like sidebar brand/footer, weaker Phase 9 glass art, animated water dominating the visual judgment, and header/date/weather controls that did not follow the reference hierarchy.
2. Fixes made: enabled the finished Phase 3 visual tokens for Phase 9; rebuilt the Today sidebar brand/navigation/profile hierarchy; placed date and lunar text beside/below Today; reduced reschedule to the reference chevron; locked pressure/status/card/timeline/composer coordinates; compressed the pool vertically; promoted the static fountain asset and visually suppressed the dynamic layers for Gate 1.
3. Post-fix evidence: `implementation-1536x1024.png` and `comparison-side-by-side.png` show the corrected static composition with no actionable P0/P1/P2 findings.

**Browser verification**

- URL/title: `http://127.0.0.1:43120/` / `个人生活助手`.
- Page identity and not-blank check: passed; the DOM contains Today, 今日计划, 24 小时时间轴, and AI 助手输入.
- Framework overlay: none.
- Console health: zero relevant warnings or errors in the successful capture state.
- Screenshot evidence: passed at 1536 × 1024.
- Interaction proof: left navigation `今日 → 工作 → 浏览器返回 → 今日`; URL changed to `/work` and returned to `/`.

**Implementation checklist**

- [x] Match the 240px sidebar and continuous Today Scene.
- [x] Match all requested header, pressure, status, plan, timeline, and AI anchors.
- [x] Use a static fountain presentation for this phase without removing the renderer.
- [x] Preserve real data, routing, task, timeline, pressure, and AI control semantics.
- [x] Capture and compare equal-size 1536 × 1024 evidence.

**Follow-up polish**

- Later fountain passes may tune aeration, mist, and dynamic motion without changing the Gate 1 layout coordinates.

final result: passed
