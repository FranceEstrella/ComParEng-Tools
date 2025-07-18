export interface PatchNote {
  version: string
  date: string
  changes: string[]
}

export const patchNotes: PatchNote[] = [
  {
    "version": "v1.39",
    "date": "April 13, 2025",
    "changes": [
      "Fixed issue in Calendar View.",
      "Corrected an error where Thursday schedules were incorrectly interpreted as Tuesday schedules.",
      "Resolved a text rendering problem when saving the schedule as an image.",
      "Fixed a bug preventing course addition when schedule slots were full.",
      "Added functionality to save the schedule as an .ics file for calendar application import.",
      "Implemented autosave for the schedule maker across different sessions.",
      "Introduced a Table View for both available and selected courses tabs.",
      "Added a toggle button to display courses for different programs.",
      "Enabled customization of the title and color of course blocks in the added courses section of the schedule view.",
      "Grouped available courses by department.",
      "Added sorting options for available courses by department, course code, section, available slots, and meeting days.",
      "Implemented a 'Replace Section' button for existing courses in the schedule, allowing users to select a different section from the available courses.",
      "Enabled customization of the calendar title."
    ]
  },
  {
    version: "v1.38",
    date: "April 10, 2025",
    changes: [
      "Fixed 'Reset All Progress' button error in Course Tracker",
      "Added Patch Notes section to the home page",
      "Improved Schedule Maker with department filtering and grouping",
      "Added option to show all extracted courses in Schedule Maker",
      "Added manual extension installation guide",
      "Allow adding courses with no available slots to schedule",
      "Added course section replacement option",
      "Fixed visual bug in downloaded schedule images",
      "Changed calendar integration to use Google Calendar",
      "Minimized redundancy in time and room information display",
      "Fixed consistency of navigation buttons across all pages",
    ],
  },
  {
    version: "v1.37",
    date: "April 5, 2025",
    changes: [
      "Fixed newline character in calendar export",
      "Completed LOCATION field in ICS file",
      "Enhanced course conflict detection",
      "Improved course addition logic",
      "Added department sorting feature",
      "Enhanced calendar export functionality",
      "Added dynamic button text",
      "Added reset progress button",
      "Improved search experience",
      "Added year synchronization in Academic Planner",
      "Added cross-component communication",
    ],
  },
]
