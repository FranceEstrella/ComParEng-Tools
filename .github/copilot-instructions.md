<!--
Short, focused instructions to help AI coding agents be productive in this repo.
Keep this file small (20-50 lines) and specific to discovered patterns.
-->
# ComParEng-Tools — Copilot Instructions

Overview
- This is a Next.js (App Router) web app that provides three student tools: Course Tracker, Schedule Maker, and Academic Planner.
- Key UI lives under `app/` and `components/`. Course curriculum data is authored in `lib/course-data.js` and used client-side.

What to change and why
- UI and behavior edits: update files under `components/` (e.g., `components/course-tracker.tsx`, `components/layout.js`). Keep changes localized and preserve prop shapes.
- Data model changes: update `lib/course-data.js`. This file is the single source of truth for initial courses. Keep IDs stable (e.g., `COE0001`) to avoid breaking references in code.
- Server-side temporary storage: `app/api/receive-course-data/route.ts` accepts POST from the client extension and calls `lib/course-storage.js` -> `updateCourseData` (in-memory only). Do not assume persistence across server restarts.

Build, run, and dev notes
- This repo uses Next.js (version in `package.json`) and Tailwind. Standard dev command: `next dev` (run via package manager). Look at `package.json` for scripts — if missing, use `pnpm / npm / yarn` to run `next dev`.
- API routes use App Router route handlers under `app/api/*`. They include permissive CORS for browser extension integration.

Project-specific conventions
- Types: codebase mixes JS (lib) and TSX components. `lib/*.js` contain runtime data (course list) and simple storage helpers. Prefer small, incremental TS conversions only when necessary.
- Styling: Tailwind + utility components live in `components/ui/*`. Use `cn()` from `lib/utils.ts` when composing class names.
- Local state: course progress is persisted to browser localStorage via `lib/course-storage.js` helpers `saveCourseStatuses` and `loadCourseStatuses`. When modifying client logic, ensure these functions are still called where appropriate.

Integration points & examples
- Browser extension -> Web App: The extension should POST JSON to `/api/receive-course-data` with items that have { courseCode, section, classSize, remainingSlots, meetingDays, meetingTime, room, hasSlots }.
- Client fetch of available sections: frontend code calls `/api/get-available-courses` which returns the in-memory `courseDataStorage` set by the POST route.
- Example: to add a new course field (e.g., `semesterHours`), update `lib/course-data.js`, then update `components/course-tracker.tsx` where course objects are read (search for `.credits`, `.prerequisites`, `.year`).

Quick pointers for automation
- When changing data shapes, update both `lib/course-data.js` and validation in `app/api/receive-course-data/route.ts`.
- Avoid touching `initialCourses` IDs. Many UI behaviors (prerequisite lookups, dependents map) rely on stable `id` fields.

Files to read first
- `components/course-tracker.tsx` — largest interactive UI, examples of filtering, grouping, and status persistence.
- `lib/course-data.js` — canonical course list and primary data model.
- `lib/course-storage.js` — localStorage helpers and server in-memory storage.
- `app/api/*` — simple route handlers and CORS policy.

If unclear
- Ask for intended user-visible behavior (UI, data model, or API integration) before large refactors. For small improvements, prefer minimal, well-scoped changes and include unit-like checks (opening the app locally) in your PR description.
