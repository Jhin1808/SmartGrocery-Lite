---
target: Simple ToBuyLists demo and account URL editing removal
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:/workspace/SmartGrocery-Lite/frontend/src/pages/DemoLists.jsx"
target_fingerprint: "sha256:ec15e95c6ab6f8994a57f00e2ca2819cef601156dddfc3a70340d8f14c227499"
target_path: /workspace/SmartGrocery-Lite/frontend/src/pages/DemoLists.jsx
timestamp: 2026-10-29T23-45-39Z
slug: frontend-src-pages-demolists-jsx
---
Method: dual-agent (A: /root/demo_design_review; B: /root/demo_design_evidence).

Target: simple ToBuyLists demo. Requested scope: demo permits only creating/selecting simple grocery lists and adding/removing items. Account image URL editing removed from form and API.

Qualitative design review for the simple-demo goal, not measured user testing:

| Heuristic | Before | After |
|---|---:|---:|
| System status | 3 | 3 |
| Match with real world | 3 | 4 |
| User control | 2 | 3 |
| Consistency | 2 | 3 |
| Error prevention | 2 | 3 |
| Recognition over recall | 2 | 4 |
| Efficiency | 2 | 3 |
| Aesthetic/minimalism | 2 | 3 |
| Error recovery | 2 | 3 |
| Help/documentation | 2 | 3 |
| Total | 22/40 | 32/40 |

All ten heuristics apply; max40. Scope differs from previous whole-app reviews.

Specificity: grocery-note surface, existing self-hosted typography, restrained green/paper surfaces and grocery language create a coherent product identity. A single task surface replaces the signed-in workspace's advanced controls. No decorative metrics, feature tiles or nested cards were introduced.

Cognitive load: only create a list, choose a list, add a grocery, remove a grocery, and exit. Sample data is reduced to one list with Milk, Bread and Eggs. Inline status and empty-state text explain what happened and what to do next. Demo changes are explicitly temporary and reset on refresh/exit.

Priority issues addressed: dedicated demo routing replaces accidental access to Account, Recipes, Stores, Templates and shared list details. All such demo routes redirect to /lists. Demo contains no authenticated navigation, backend calls, profile editing, catalog/search, quantities, expiry controls or sharing. Account UI submits only name; profile API rejects picture fields with422. Existing provider pictures remain display-only.

Strengths: task-focused labels, honest reset notice, 46px form controls, named remove buttons, preserved input focus, safe empty/disabled states and responsive layout. Keyboard/mobile visitors get predictable feedback without advanced navigation. Temporary-data deletion has no undo; acceptable for this demo's limited scope. Broader account redesign is outside this pass.

Assessment B: source scan of DemoLists.jsx and Account.jsx: zero warnings/errors. No live overlay was presented. Source scanning alone does not establish browser behavior.

Parent validation:31 frontend tests and105 backend tests pass; production build passes with existing dependency warnings. Chromium/Playwright checks at320/390/768/1440: create/add/remove, focus, route redirects, zero backend requests, exit clears demo flag, no horizontal overflow. Axe WCAG2A/AA and2.1AA scans at390 and1440: zero violations. These automated checks do not certify complete accessibility or replace user testing.

User already specified the scope and authorized fixes. Changes remain local on design/tobuylists-ui pending a push request.
