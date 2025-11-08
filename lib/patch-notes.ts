export interface PatchNote {
  version: string
  date: string
  title: string
  changes: {
    type: "new" | "improved" | "fixed"
    description: string
  }[]
}

export const patchNotes: PatchNote[] = [
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
