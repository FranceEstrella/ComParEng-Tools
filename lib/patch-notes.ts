export interface PatchNote {
  version: string
  date: string
  title: string
  silent?: boolean
  changes: {
    type: "new" | "improved" | "fixed" | "known-issue"
    description: string
  }[]
  hotfixes?: {
    date: string
    items: string[]
  }[]
}

export const patchNotes: PatchNote[] = [
  {
    version: "1.46",
    date: "December 5, 2025",
    title: "Schedule Maker quality rollup (silent)",
    silent: true,
    changes: [
      {
        type: "new",
        description:
          "A floating Selected Courses summary mirrors slot counts, credits, and collapse controls directly on the Available tab.",
      },
      {
        type: "improved",
        description:
          "Available-course groups now support per-group collapse in both card and table views plus a single collapse-all toggle shared across layouts.",
      },
      {
        type: "improved",
        description:
          "Credits are surfaced on every available and selected card, with running totals and consistent toolbar placement between tabs.",
      },
      {
        type: "improved",
        description:
          "Selected-course controls gained hex color inputs and clearer default titles in the format [CODE] NAME | SECTION so custom labels remain identifiable.",
      },
      {
        type: "fixed",
        description:
          "Importing saved selections now re-syncs slot counts, meeting details, and display metadata whenever fresh course extractions arrive.",
      },
    ],
    hotfixes: [
      {
        date: "December 3, 2025",
        items: [
          "Added a start-date picker dialog before downloading the schedule ICS file so exports anchor to your actual first class meeting.",
          "Fixed custom curriculum uploads not extracting prerequisites and required-for relationships.",
          "Improved academic plan suggestions to honor dynamic preferred minimum and maximum units per term.",
          "Added a confirmation dialog that lets you mark prerequisite chains as passed in one go when jumping ahead.",
        ],
      },
      {
        date: "December 2, 2025",
        items: [
          "Fixed the Save to ICS flow in Schedule Maker's calendar view so generated files include every selected course.",
          "Added import/export for Selected Courses to make sharing or restoring a schedule from JSON effortless.",
          "Added configurable minimum and maximum units (including onboarding prompts after curriculum uploads) so non-CpE programs avoid incorrect load warnings.",
        ],
      },
    ],
  },
  {
    version: "1.45",
    date: "November 29, 2025",
    title: "Major Update",
    changes: [
      {
        type: "new",
        description: "A floating Report an issue button sticks to the bottom-right corner on every page, letting you send feedback without leaving the screen you’re on.",
      },
      {
        type: "new",
        description: "Onboarding now ships with dedicated confirmation cards for the extension slide, CpE slide, and general slides, making the entire tour feel brand new and context-aware.",
      },
      {
        type: "new",
        description: "Course Tracker now saves every grade attempt plus your tracker timeline, so importing/exporting backups keeps the full history intact.",
      },
      {
        type: "new",
        description: "You can generate a Transcript of Records PDF directly from Course Tracker—fill in your name and number, review the entries, and download a polished file for sharing.",
      },
      {
        type: "new",
        description: "ComParEng Tools now advertises install prompts so you can add it as a desktop or mobile PWA.",
      },
    ],
  },
  {
    version: "1.44",
    date: "November 28, 2025",
    title: "Schedule Maker grouping & fresher data",
    changes: [
      {
        type: "new",
        description: "New guided onboarding walks through Course Tracker, Schedule Maker, and Academic Planner with live theme previews, privacy tips, and a CpE-only branch.",
      },
      {
        type: "new",
        description: "Non-CpE students can now upload their SOLAR curriculum during the tour before accessing the tools.",
      },
      {
        type: "improved",
        description: "Schedule Maker can group sections by department, section name, course code, or room—each group shows the full course title and richer search matches.",
      },
      {
        type: "fixed",
        description: "Fresh SOLAR extracts now replace cached sections immediately and expire after an hour so you never browse stale slots.",
      },
      {
        type: "fixed",
        description: "Uploading a different curriculum clears incompatible selections and syncs the new active-course list automatically.",
      },
      {
        type: "improved",
        description: "Extension reminder and Non-CpE helper banners gained dismiss buttons that remember your choice and keep the homepage tidy.",
      },
    ],
  },
  {
    version: "1.43",
    date: "November 8, 2025",
    title: "Responsive planner dialogs & rounded popups",
    changes: [
      {
        type: "improved",
        description:
          "Floating plan actions now collapse into a single mobile card with smoother entry animations and only appear after the top summary.",
      },
      {
        type: "improved",
        description:
          "Planner controls, including the View Plan Actions label and Unscheduled Courses list, adapt their copy and layout for small screens.",
      },
      {
        type: "improved",
        description:
          "What’s New and Send Feedback dialogs detect compact layouts, trim default content, and add toggles so mobile users no longer need to scroll.",
      },
      {
        type: "improved",
        description:
          "Browser alerts and confirmations in the planner are replaced with in-app dialogs for consistent styling and accessibility.",
      },
      {
        type: "new",
        description:
          "The academic planner now auto-detects regular students and suggests the default curriculum.",
      },
      {
        type: "new",
        description:
          "All popups now feature rounded corners, giving patch notes, feedback, and planner dialogs a unified look.",
      },
      {
        type: "known-issue",
        description:
          "Academic Planner conflict detection still misses overlaps when a class ending at 12:50 PM is compared with another starting at 12:00 PM on the same day. A fix is in progress, but you may manually double-check overlapping times in the meantime.",
      },
    ],
  },
  {
    version: "1.42",
    date: "October 23, 2025",
    title: "Smarter planning: fuller loads, paired labs, fewer terms",
    changes: [
      {
        type: "improved",
        description:
          "Your chosen priorities now help decide which subjects go first. Higher‑priority subjects are scheduled earlier when possible.",
      },
      {
        type: "improved",
        description:
          "Each term aims to fill closer to the suggested unit limit without going over the allowed maximum.",
      },
      {
        type: "improved",
        description:
          "Lectures and labs are placed together when possible so you can take them in the same term.",
      },
      {
        type: "improved",
        description:
          "When it’s safe to do so, the planner moves subjects from later terms into earlier ones to reduce tiny leftover terms and help you finish sooner (prerequisites, unit limits, and your locks are respected).",
      },
      {
        type: "improved",
        description:
          "Internship terms stay separate from regular subjects to match common school practice.",
      },
      {
        type: "improved",
        description:
          "Fewer repeated warnings about light‑load terms and clearer, more professional messages.",
      },
      {
        type: "improved",
        description:
          "The plan view stays open while you interact with it and updates automatically when you change priorities or lock a subject.",
      },
      {
        type: "new",
        description:
          "You can set a subject’s priority or lock it to a term. Your choices are saved on your device and honored by the planner.",
      },
      {
        type: "improved",
        description:
          "If you add a subject to the current term that likely needs a petition, we’ll ask you to confirm. For future terms, it’s shown as a gentle note.",
      },
    ],
  },
  {
    version: "1.41",
    date: "October 19, 2025",
    title: "Internship Term Protection & UX Improvements",
    changes: [
      {
        type: "improved",
        description:
          "Replaced browser confirm with a modal-based overload confirmation when adding non-internship courses into reserved internship terms",
      },
      {
        type: "improved",
        description: "Dropdown labels now show academic-year format (S.Y YYYY-YYYY) for clarity when selecting target terms",
      },
      {
        type: "improved",
        description: "Refactored course-add logic (extracted performAddCourseToTerm) to centralize term insertion and move history recording",
      },
      {
        type: "fixed",
        description: "Preserved semester label formatting and ensured modal uses formatted academic year in its preview",
      },
      {
        type: "improved",
        description: "Ran TypeScript checks and planner simulation to validate changes; no type errors and planner simulation output verified",
      },
    ],
  },
  {
    version: "1.40",
    date: "August 16, 2025",
    title: "Advanced Academic Planning & Course Management",
    changes: [
      {
        type: "new",
        description: "Import/Export graduation plans in JSON, CSV, and TXT formats for backup and sharing",
      },
      {
        type: "new",
        description: "Undo functionality - reverse your last course moves with one click",
      },
      {
        type: "new",
        description: "Move history tracking - see all recent changes to your graduation plan",
      },
      {
        type: "new",
        description: "Bulk course selection and moving - select multiple courses and move them together",
      },
      {
        type: "new",
        description: "Course swapping - easily swap positions of two courses between terms",
      },
      {
        type: "new",
        description: "Unscheduled courses section - manage courses removed from your plan",
      },
      {
        type: "new",
        description: "Floating unscheduled courses card - quick access when scrolling through your plan",
      },
      {
        type: "improved",
        description:
          "Enhanced conflict detection with warnings for credit limits, prerequisites, and schedule overlaps",
      },
      {
        type: "improved",
        description: "Active courses are now prioritized first in graduation plan generation",
      },
      {
        type: "improved",
        description: "Expected graduation calculation now shows the term after your final planned semester",
      },
      {
        type: "improved",
        description: "Cleaner schedule display format in course tables",
      },
      {
        type: "improved",
        description: "Simplified section dropdown display without slot counts",
      },
      {
        type: "improved",
        description: "Better course status notices for users with all pending courses",
      },
    ],
  },
  {
    version: "1.39",
    date: "August 15, 2025",
    title: "Enhanced Academic Planning",
    changes: [
      {
        type: "improved",
        description: "Active courses are now prioritized in graduation plan generation",
      },
      {
        type: "new",
        description: "Added notice for users with all pending courses to encourage status updates",
      },
      {
        type: "improved",
        description: "Better course recommendation algorithm based on current progress",
      },
    ],
  },
  {
    version: "1.38",
    date: "August 14, 2025",
    title: "Schedule Maker Improvements",
    changes: [
      {
        type: "improved",
        description: "Enhanced course filtering and section management",
      },
      {
        type: "new",
        description: "Added ability to add full courses to schedule with appropriate notices",
      },
      {
        type: "improved",
        description: "Minimized redundancy in time and room information display",
      },
    ],
  },
  {
    version: "1.37",
    date: "August 13, 2025",
    title: "Chrome Extension Integration",
    changes: [
      {
        type: "new",
        description: "Added Chrome extension integration with manual installation support",
      },
      {
        type: "new",
        description: "Extension download with clickable popup installation guide",
      },
      {
        type: "improved",
        description: "Better course data extraction from student portal",
      },
    ],
  },
  {
    version: "1.36",
    date: "August 12, 2025",
    title: "UI/UX Improvements",
    changes: [
      {
        type: "improved",
        description: "Enhanced menu button styling consistency across all pages",
      },
      {
        type: "improved",
        description: "Better navigation experience and overall user interface design",
      },
    ],
  },
]

const versionToParts = (version: string) =>
  version
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0)

const compareSemver = (a: string, b: string) => {
  const aParts = versionToParts(a)
  const bParts = versionToParts(b)
  const maxLength = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < maxLength; i++) {
    const aValue = aParts[i] ?? 0
    const bValue = bParts[i] ?? 0
    if (aValue !== bValue) {
      return aValue - bValue
    }
  }

  return 0
}

const changeTypeOrder: Record<PatchNote["changes"][number]["type"], number> = {
  new: 0,
  improved: 1,
  fixed: 2,
  "known-issue": 3,
}

export const orderedPatchNotes: PatchNote[] = [...patchNotes]
  .map((note) => ({
    ...note,
    changes: [...note.changes].sort((a, b) => changeTypeOrder[a.type] - changeTypeOrder[b.type]),
  }))
  .sort((a, b) => compareSemver(b.version, a.version))
