"use client"

import * as React from "react"
import { DayPicker, UI } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  navLayout = "around",
  ...props
}: CalendarProps) {
  const isAroundNav = navLayout === "around"

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout}
      className={cn("p-2", className)}
      classNames={{
        // v9 UI keys (fixes weekday/header alignment)
        [UI.Months]: "flex flex-col",
        // Month is relative so we can pin nav buttons to the caption row.
        [UI.Month]: "relative flex flex-col gap-2",
        // Reserve horizontal space so the caption label never overlaps buttons.
        [UI.MonthCaption]: "relative flex h-8 items-center justify-center px-9",
        [UI.CaptionLabel]: "text-xs font-medium leading-none",
        // Only used when navLayout !== "around" (default DayPicker nav).
        [UI.Nav]: "flex items-center justify-between",
        [UI.PreviousMonthButton]: cn(
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100",
          "inline-flex items-center justify-center rounded-md",
          "hover:bg-accent hover:text-accent-foreground",
          isAroundNav ? "absolute left-1 top-0.5" : ""
        ),
        [UI.NextMonthButton]: cn(
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100",
          "inline-flex items-center justify-center rounded-md",
          "hover:bg-accent hover:text-accent-foreground",
          isAroundNav ? "absolute right-1 top-0.5" : ""
        ),
        [UI.MonthGrid]: "w-full border-collapse space-y-1",
        [UI.Weekdays]: "flex",
        [UI.Weekday]: "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem]",
        [UI.Weeks]: "",
        [UI.Week]: "flex w-full mt-1",
        [UI.Day]:
          "group h-8 w-8 text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
        [UI.DayButton]: cn(
          "h-8 w-8 p-0 font-normal",
          "inline-flex items-center justify-center rounded-full",
          "hover:bg-accent hover:text-accent-foreground",
          "group-data-[today=true]:bg-accent group-data-[today=true]:text-accent-foreground",
          "aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        ),
        // Selection + flags (strings match the enum values)
        selected: "",
        today: "",
        outside:
          "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        range_end: "range-end",
        range_start: "range-start",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: iconClassName, ...iconProps }) =>
          (iconProps as any).orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", iconClassName)} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", iconClassName)} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
