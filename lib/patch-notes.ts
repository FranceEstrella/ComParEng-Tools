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
