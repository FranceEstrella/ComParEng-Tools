"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type FAQItem = {
  question: string
  answer: string
}

type Props = {
  buttonLabel?: string
}

const FAQS: FAQItem[] = [
  {
    question: "Is this tool usable for other programs?",
    answer: "Yes. Save your curriculum from the portal as HTML, then import it into the app.",
  },
  {
    question: "Does the app save data online?",
    answer: "No. Your progress is saved only in your browser local storage.",
  },
  {
    question: "Which courses get marked active during auto grade import?",
    answer: "Courses with the latest failing grade are automatically marked active.",
  },
  {
    question: "How are grades imported?",
    answer: "The extension extracts grades from the portal and writes them to the web app local storage.",
  },
  {
    question: "I am irregular but detected as regular. What should I do?",
    answer: "In Schedule Maker settings (gear icon), set SOLAR-OSES student type to Always Irregular.",
  },
  {
    question: "Where can I report a bug?",
    answer: "Click the warning icon at the bottom right, then describe how to reproduce the issue.",
  },
  {
    question: "Where can I access these tools? Is it free?",
    answer: "Use compareng-tools.vercel.app. Yes, it is free.",
  },
  {
    question: "Can I use this on my phone?",
    answer: "Yes, basic use works. Features needing the extension will not work without it, and some dialogs may be buggy.",
  },
  {
    question: "Is Academic Planner accurate?",
    answer: "Not fully yet. It is still in development, so review and adjust generated plans manually.",
  },
  {
    question: "Can I customize course blocks in Schedule Maker?",
    answer: "Yes. Right-click a course block or an item in Selected Courses to open customization.",
  },
  {
    question: "Can FEU Diliman or Alabang students use this?",
    answer: "Not yet. The app and extension currently support FEU Tech SOLAR only.",
  },
]

export default function FAQsButton({ buttonLabel = "FAQs" }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-white/80 text-slate-900 border-slate-300 hover:bg-white dark:bg-white/10 dark:text-white dark:border-white/40 dark:hover:bg-white/20"
        >
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>FAQs</DialogTitle>
          <DialogDescription>Quick answers for common questions.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {FAQS.map((item) => (
            <div key={item.question} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Q: {item.question}</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">A: {item.answer}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
