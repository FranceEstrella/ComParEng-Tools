"use client"

import { useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type Modifier,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DayToken = "M" | "Tu" | "W" | "Th" | "F"

type DemoCourse = {
  id: string
  code: string
  section: string
  room: string
  units: number
  day: DayToken
  startMinutes: number
  durationMinutes: number
  colorClass: string
  chipClass: string
}

type Placement = {
  courseId: string
  day: DayToken
  startMinutes: number
}

const DAYS: Array<{ token: DayToken; label: string }> = [
  { token: "M", label: "Mon" },
  { token: "Tu", label: "Tue" },
  { token: "W", label: "Wed" },
  { token: "Th", label: "Thu" },
  { token: "F", label: "Fri" },
]

const GRID_START_MINUTES = 7 * 60
const GRID_END_MINUTES = 15 * 60 + 30
const SLOT_MINUTES = 30
const SLOT_HEIGHT = 16
const TIME_COLUMN_WIDTH = 50

const demoCourses: DemoCourse[] = [
  {
    id: "cpe0011",
    code: "CPE0011",
    section: "TE21",
    room: "TBA",
    units: 3,
    day: "F",
    startMinutes: 7 * 60,
    durationMinutes: 90,
    colorClass: "bg-amber-500/80 text-amber-50 border-amber-300/60",
    chipClass: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/40",
  },
  {
    id: "cpe0011l",
    code: "CPE0011L",
    section: "TE21",
    room: "F904",
    units: 3,
    day: "W",
    startMinutes: 10 * 60,
    durationMinutes: 120,
    colorClass: "bg-emerald-600/80 text-emerald-50 border-emerald-300/60",
    chipClass: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/40",
  },
  {
    id: "coe0019",
    code: "COE0019",
    section: "M193",
    room: "F712",
    units: 3,
    day: "M",
    startMinutes: 10 * 60,
    durationMinutes: 180,
    colorClass: "bg-orange-700/80 text-orange-50 border-orange-300/60",
    chipClass: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-100 dark:border-orange-400/40",
  },
  {
    id: "cpe0033l",
    code: "CPE0033L",
    section: "TE31A",
    room: "E609",
    units: 3,
    day: "Th",
    startMinutes: 11 * 60,
    durationMinutes: 90,
    colorClass: "bg-violet-600/80 text-violet-50 border-violet-300/60",
    chipClass: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-500/20 dark:text-violet-100 dark:border-violet-400/40",
  },
  {
    id: "coe0049",
    code: "COE0049",
    section: "TT31",
    room: "ONLINE",
    units: 3,
    day: "Tu",
    startMinutes: 11 * 60,
    durationMinutes: 90,
    colorClass: "bg-rose-700/80 text-rose-50 border-rose-300/60",
    chipClass: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-400/40",
  },
  {
    id: "cpe0009",
    code: "CPE0009",
    section: "TE31",
    room: "F1103",
    units: 3,
    day: "Tu",
    startMinutes: 13 * 60,
    durationMinutes: 90,
    colorClass: "bg-yellow-700/80 text-yellow-50 border-yellow-300/60",
    chipClass: "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-100 dark:border-yellow-400/40",
  },
]

const defaultPlacements: Placement[] = demoCourses.map((course) => ({
  courseId: course.id,
  day: course.day,
  startMinutes: course.startMinutes,
}))

const version2Template: Placement[] = defaultPlacements.map((placement) => {
  if (placement.courseId === "coe0049") {
    return { ...placement, day: "W", startMinutes: 10 * 60 }
  }
  if (placement.courseId === "cpe0033l") {
    return { ...placement, day: "W", startMinutes: 10 * 60 + 30 }
  }
  return placement
})

function getVersionPlacements(version: "v1" | "v2"): Placement[] {
  const source = version === "v1" ? defaultPlacements : version2Template
  // Return fresh objects so switching/reset always triggers a reliable state update.
  return source.map((placement) => ({ ...placement }))
}

const slotTimes: number[] = []
for (let minutes = GRID_START_MINUTES; minutes < GRID_END_MINUTES; minutes += SLOT_MINUTES) {
  slotTimes.push(minutes)
}

function formatMinutes(minutes: number) {
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${minute.toString().padStart(2, "0")}${suffix}`
}

function formatTimeRange(startMinutes: number, durationMinutes: number) {
  return `${formatMinutes(startMinutes)}-${formatMinutes(startMinutes + durationMinutes)}`
}

function formatMinutesCompact(minutes: number) {
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour24 >= 12 ? "P" : "A"
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${minute.toString().padStart(2, "0")}${suffix}`
}

function formatTimeRangeCompact(startMinutes: number, durationMinutes: number) {
  return `${formatMinutesCompact(startMinutes)}-${formatMinutesCompact(startMinutes + durationMinutes)}`
}

function findCourse(courseId: string) {
  return demoCourses.find((course) => course.id === courseId)
}

function clampStart(courseId: string, nextStart: number) {
  const course = findCourse(courseId)
  if (!course) return nextStart
  const maxStart = GRID_END_MINUTES - course.durationMinutes
  return Math.min(Math.max(nextStart, GRID_START_MINUTES), Math.max(GRID_START_MINUTES, maxStart))
}

function DraggableCourseChip({ course }: { course: DemoCourse }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${course.id}`,
    data: { type: "chip", courseId: course.id },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight transition",
        course.chipClass,
        isDragging && "opacity-70"
      )}
      aria-label={`Drag ${course.code}`}
    >
      <div>{course.code}</div>
      <div className="text-[9px] opacity-80">{course.section}</div>
      <div className="text-[8px] opacity-75">{course.day} • {formatTimeRange(course.startMinutes, course.durationMinutes)}</div>
    </button>
  )
}

function DroppableSlot({ id, children }: { id: string; children?: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-transparent transition-colors",
        isOver && "border-emerald-400/70 bg-emerald-500/10"
      )}
    >
      {children}
    </div>
  )
}

function DraggableBlock({
  course,
  placement,
  isConflict,
}: {
  course: DemoCourse
  placement: Placement
  isConflict: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${course.id}`,
    data: { type: "block", courseId: course.id },
  })

  const top = ((placement.startMinutes - GRID_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT
  const height = (course.durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-[9px] font-semibold leading-tight shadow-sm",
        course.colorClass,
        isConflict && "ring-2 ring-rose-400/90",
        isDragging && "opacity-70"
      )}
      style={{ top, height }}
      aria-label={`${course.code} block`}
    >
      <div className="truncate">{course.code}</div>
      <div className="truncate opacity-90">{course.section}</div>
      <div className="truncate text-[8px] leading-tight opacity-80">{placement.day} • {formatTimeRangeCompact(placement.startMinutes, course.durationMinutes)}</div>
    </div>
  )
}

export default function OnboardingSchedulePreview() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [placements, setPlacements] = useState<Placement[]>(() => getVersionPlacements("v1"))
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [activeVersion, setActiveVersion] = useState<"v1" | "v2">("v1")
  const [activeDragType, setActiveDragType] = useState<"chip" | "block" | null>(null)
  const [activeOverlaySize, setActiveOverlaySize] = useState<{ width: number; height: number } | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const placementMap = useMemo(() => {
    const map = new Map<string, Placement>()
    for (const placement of placements) {
      map.set(placement.courseId, placement)
    }
    return map
  }, [placements])

  const conflicts = useMemo(() => {
    const conflictIds = new Set<string>()
    for (const day of DAYS) {
      const daily = placements
        .filter((placement) => placement.day === day.token)
        .map((placement) => {
          const course = findCourse(placement.courseId)
          if (!course) return null
          return {
            id: placement.courseId,
            start: placement.startMinutes,
            end: placement.startMinutes + course.durationMinutes,
          }
        })
        .filter((entry): entry is { id: string; start: number; end: number } => Boolean(entry))
        .sort((a, b) => a.start - b.start)

      for (let i = 0; i < daily.length; i += 1) {
        for (let j = i + 1; j < daily.length; j += 1) {
          if (daily[j].start < daily[i].end) {
            conflictIds.add(daily[i].id)
            conflictIds.add(daily[j].id)
          }
        }
      }
    }
    return conflictIds
  }, [placements])

  const totalUnits = useMemo(() => {
    return placements.reduce((sum, placement) => {
      const course = findCourse(placement.courseId)
      return sum + (course?.units ?? 0)
    }, 0)
  }, [placements])

  const conflictCount = conflicts.size

  const alignOverlayToGrabPoint: Modifier = ({ transform }) => {
    const offset = dragOffsetRef.current
    if (!offset.x && !offset.y) return transform
    return {
      ...transform,
      x: transform.x - offset.x,
      y: transform.y - offset.y,
    }
  }

  const getPointerCoordinates = (event: Event): { x: number; y: number } | null => {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY }
    }
    if (event instanceof PointerEvent) {
      return { x: event.clientX, y: event.clientY }
    }
    if (event instanceof TouchEvent && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const dragId = String(event.active.id)
    const [, courseId] = dragId.split(":")
    setActiveCourseId(courseId || null)
    const dragType = event.active.data.current?.type === "block" ? "block" : "chip"
    setActiveDragType(dragType)
    const rect = event.active.rect.current.initial
    setActiveOverlaySize(rect ? { width: rect.width, height: rect.height } : null)

    const pointer = event.activatorEvent ? getPointerCoordinates(event.activatorEvent) : null
    if (rect && pointer) {
      dragOffsetRef.current = {
        x: pointer.x - rect.left,
        y: pointer.y - rect.top,
      }
    } else {
      dragOffsetRef.current = { x: 0, y: 0 }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCourseId(null)
    setActiveDragType(null)
    setActiveOverlaySize(null)
    dragOffsetRef.current = { x: 0, y: 0 }
    const overId = event.over?.id ? String(event.over.id) : null
    if (!overId) return

    const activeId = String(event.active.id)
    const [, courseId] = activeId.split(":")
    if (!courseId) return

    if (overId === "dropzone:remove") {
      setPlacements((prev) => prev.filter((placement) => placement.courseId !== courseId))
      return
    }

    if (!overId.startsWith("slot:")) return

    const [, day, start] = overId.split(":")
    if (!day || !start) return

    const nextStart = Number.parseInt(start, 10)
    if (!Number.isFinite(nextStart)) return

    const dayToken = day as DayToken

    setPlacements((prev) => {
      const existing = prev.find((placement) => placement.courseId === courseId)
      const clampedStart = clampStart(courseId, nextStart)
      if (existing) {
        return prev.map((placement) =>
          placement.courseId === courseId ? { ...placement, day: dayToken, startMinutes: clampedStart } : placement
        )
      }
      return [...prev, { courseId, day: dayToken, startMinutes: clampedStart }]
    })
  }

  const applyVersion = (version: "v1" | "v2") => {
    setActiveVersion(version)
    setPlacements(getVersionPlacements(version))
  }

  const unplacedCourses = demoCourses.filter((course) => !placementMap.has(course.id))
  const activeCourse = activeCourseId ? findCourse(activeCourseId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-2.5 text-slate-100 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-slate-50">My Schedule</p>
            <p className="text-[10px] text-slate-300">Drag chips into the grid. Move blocks to compare fits.</p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "h-6 text-[10px]",
              conflictCount === 0
                ? "bg-emerald-500/20 text-emerald-100 border border-emerald-300/30"
                : "bg-rose-500/20 text-rose-100 border border-rose-300/30"
            )}
          >
            {conflictCount === 0 ? "No conflicts" : `${conflictCount} conflicting blocks`}
          </Badge>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap gap-1 rounded-lg border border-dashed border-white/20 bg-[#121a2b] p-1.5">
            {unplacedCourses.length > 0 ? (
              unplacedCourses.map((course) => <DraggableCourseChip key={course.id} course={course} />)
            ) : (
              <p className="text-[10px] text-slate-300">All demo courses are on the schedule.</p>
            )}
          </div>
          <DroppableSlot id="dropzone:remove">
            <div className="h-full min-h-8 rounded-lg border border-dashed border-rose-300/60 bg-[#3a0f1e] px-2 py-1 text-[9px] font-semibold text-rose-100">
              Drop here to remove
            </div>
          </DroppableSlot>
        </div>

        <div className="relative z-0 mt-1.5 rounded-xl border border-white/10 bg-[#02040a]">
          <div
            className="grid w-full"
            style={{ gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${DAYS.length}, minmax(0, 1fr))` }}
          >
            <div className="border-b border-white/10 bg-slate-900 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-300">
              Time
            </div>
            {DAYS.map((day) => (
              <div
                key={`day-header-${day.token}`}
                className="border-b border-white/10 bg-slate-900 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-300"
              >
                {day.label}
              </div>
            ))}

            <div className="relative border-r border-white/10">
              {slotTimes.map((time) => (
                <div
                  key={`time-${time}`}
                  className="whitespace-nowrap border-b border-white/5 px-1 text-[8px] leading-none text-slate-400"
                  style={{ height: SLOT_HEIGHT }}
                >
                  {formatMinutes(time)}
                </div>
              ))}
            </div>

            {DAYS.map((day) => {
              const dayPlacements = placements.filter((placement) => placement.day === day.token)
              return (
                <div key={`day-col-${day.token}`} className="relative border-r border-white/10 last:border-r-0">
                  <div className="absolute inset-0">
                    {slotTimes.map((time) => (
                      <DroppableSlot key={`slot-${day.token}-${time}`} id={`slot:${day.token}:${time}`}>
                        <div className="border-b border-white/5" style={{ height: SLOT_HEIGHT }} />
                      </DroppableSlot>
                    ))}
                  </div>
                  {dayPlacements.map((placement) => {
                    const course = findCourse(placement.courseId)
                    if (!course) return null
                    return (
                      <DraggableBlock
                        key={`block-${course.id}`}
                        course={course}
                        placement={placement}
                        isConflict={conflicts.has(course.id)}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative z-20 mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <span>{totalUnits} units</span>
            <span aria-hidden>•</span>
            <span>{placements.length} courses</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant={activeVersion === "v1" ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-6 px-2 text-[10px]",
                activeVersion === "v1"
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "border-white/20 bg-[#1a2438] text-slate-100 hover:bg-[#243247]"
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => applyVersion("v1")}
            >
              Version 1
            </Button>
            <Button
              type="button"
              variant={activeVersion === "v2" ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-6 px-2 text-[10px]",
                activeVersion === "v2"
                  ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                  : "border-white/20 bg-[#1a2438] text-slate-100 hover:bg-[#243247]"
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => applyVersion("v2")}
            >
              Version 2
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-slate-100 hover:bg-[#243247]"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => applyVersion(activeVersion)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {conflictCount > 0 && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-rose-300/60 bg-[#3b0d1a] px-2 py-1 text-[10px] text-rose-100 dark:border-rose-400/40 dark:bg-[#3b0d1a] dark:text-rose-100">
            <AlertTriangle className="mt-0.5 h-3 w-3" />
            <p>Red outlines mean overlap. Move one block to resolve.</p>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null} modifiers={[alignOverlayToGrabPoint]} className="pointer-events-none">
        {activeCourse ? (
          activeDragType === "block" ? (
            <div
              className={cn(
                "rounded-md border px-1.5 py-1 text-[9px] font-semibold leading-tight shadow-lg",
                activeCourse.colorClass
              )}
              style={{
                width: activeOverlaySize?.width,
                minHeight: activeOverlaySize?.height,
              }}
            >
              <div className="truncate">{activeCourse.code}</div>
              <div className="truncate opacity-90">{activeCourse.section}</div>
              {placementMap.get(activeCourse.id) && (
                <div className="truncate text-[8px] leading-tight opacity-80">
                  {placementMap.get(activeCourse.id)?.day} • {formatTimeRangeCompact(placementMap.get(activeCourse.id)?.startMinutes ?? activeCourse.startMinutes, activeCourse.durationMinutes)}
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-lg", activeCourse.chipClass)}
              style={{
                width: activeOverlaySize?.width,
                minHeight: activeOverlaySize?.height,
              }}
            >
              <div>{activeCourse.code}</div>
              <div className="text-[9px] opacity-80">{activeCourse.section}</div>
              <div className="text-[8px] opacity-75">{activeCourse.day} • {formatTimeRange(activeCourse.startMinutes, activeCourse.durationMinutes)}</div>
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
