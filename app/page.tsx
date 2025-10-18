"use client"

import Link from "next/link"
import { BookOpen, Calendar, GraduationCap, Download, ExternalLink, Info } from "lucide-react"
import { ThemeProvider } from "@/components/theme-provider"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { patchNotes } from "@/lib/patch-notes"

export default function Home() {
  const { theme, setTheme } = useTheme()

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            {/* Header with Dark Mode Toggle */}
            <div className="relative mb-8">
              <div className="flex justify-end items-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                  className="rounded-full"
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none">
                FEU Tech ComParEng Tools
              </h1>
            </div>

            {/* Hero Section */}
            <div className="text-center mb-8">
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                A collection of tools designed to help Computer Engineering students at FEU Tech manage their academic
                journey more effectively.
              </p>
            </div>

            {/* Extension Installation Guide */}
            <Card className="mb-8 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Extension Installation Required
                </CardTitle>
                <CardDescription>
                  For full functionality of Schedule Maker and Academic Planner, please install the ComParEng Course
                  Data Extractor Extension
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <Button
                    className="w-full flex items-center gap-2"
                    onClick={() =>
                      window.open(
                        "https://chromewebstore.google.com/detail/compareng-courses-data-ex/fdfappahfelppgjnpbobconjogebpiml",
                        "_blank",
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                    Install Extension
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                        View Installation Guide
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>ComParEng Academic Tools Web App - Installation Guide</DialogTitle>
                        <DialogDescription>Follow these steps to install and use the extension</DialogDescription>
                      </DialogHeader>

                      {/* Content moved outside DialogDescription */}
                      <div className="space-y-4 mt-4">
                        <div>
                          <h3 className="font-bold">Pre-requisites (for Schedule Maker and Academic Planner):</h3>
                          <p>Install ComParEng Course Data Extractor Extension</p>
                        </div>

                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
                          <ol className="list-decimal pl-5 space-y-2">
                            <li>
                              Download the extension from the &nbsp;
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                                onClick={() =>
                                  window.open(
                                    "https://chromewebstore.google.com/detail/compareng-courses-data-ex/fdfappahfelppgjnpbobconjogebpiml",
                                    "_blank",
                                  )
                                }
                              >
                                chrome web store. <ExternalLink className="h-3 w-3 inline" />
                              </Button>
                            </li>
                            <li>Click the "Add to Chrome" button to install.</li>
                            <li>A popup will open and click "Add extension".</li>
                          </ol>

                          <p className="font-medium mt-4">You have successfully installed the extension!</p>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h3 className="font-bold mb-2">Using the Extension:</h3>
                          <ol className="list-decimal pl-5 space-y-2">
                            <li>
                              Login to SOLAR and go to{" "}
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                                onClick={() => window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")}
                              >
                                https://solar.feutech.edu.ph/course/offerings
                              </Button>
                            </li>
                            <li>Select the current term and school year.</li>
                            <li>
                              Open the ComParEng Tools Web App:
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal ml-2"
                                onClick={() => window.open("https://compareng-tools.vercel.app/", "_blank")}
                              >
                                https://compareng-tools.vercel.app/
                              </Button>
                            </li>
                          </ol>
                          <p className="font-medium mt-4">You are ready to use the App!</p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Tools Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* Course Tracker Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105">
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6">
                  <BookOpen className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Course Tracker</h2>
                  <p className="text-blue-100 mt-2">Track your academic progress through the CpE curriculum</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Mark courses as Pending, Active, or Passed</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>View prerequisites and dependent courses</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Track your progress through the curriculum</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>See which courses you can take next</span>
                    </li>
                  </ul>
                  <Link
                    href="/course-tracker"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Open Course Tracker
                  </Link>
                </div>
              </div>

              {/* Schedule Maker Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105">
                <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6">
                  <Calendar className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Schedule Maker</h2>
                  <p className="text-purple-100 mt-2">Create your perfect class schedule with ease</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>View available course sections</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Filter courses in your curriculum</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Check for schedule conflicts</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Optimize your weekly schedule</span>
                    </li>
                  </ul>
                  <Link
                    href="/schedule-maker"
                    className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Open Schedule Maker
                  </Link>
                </div>
              </div>

              {/* Academic Planner Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105">
                <div className="bg-gradient-to-r from-green-600 to-green-800 p-6">
                  <GraduationCap className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Academic Planner</h2>
                  <p className="text-green-100 mt-2">Plan your path to graduation efficiently</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Get personalized course recommendations</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Optimize your remaining semesters</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Identify courses needing petitions</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Estimate your graduation timeline</span>
                    </li>
                  </ul>
                  <Link
                    href="/academic-planner"
                    className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Open Academic Planner
                  </Link>
                </div>
              </div>
            </div>

            {/* Patch Notes Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Patch Notes</CardTitle>
                <CardDescription>Latest updates and improvements to the ComParEng Tools</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={patchNotes[0].version}>
                  <TabsList className="mb-4">
                    {patchNotes.map((note) => (
                      <TabsTrigger key={note.version} value={note.version}>
                        {note.version}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {patchNotes.map((note) => (
                    <TabsContent key={note.version} value={note.version}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold">{note.version}</h3>
                          <Badge variant="outline">{note.date}</Badge>
                        </div>
                        <ul className="space-y-2">
                          {note.changes.map((change, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span>{change.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
              <CardFooter className="text-sm text-gray-500 dark:text-gray-400">
                If you encounter any issues with the app, feel free to message them to our page.
              </CardFooter>
            </Card>

            {/* About Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">About These Tools</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                These tools were created to help FEU Tech Computer Engineering students plan their academic journey more
                effectively. They are not officially affiliated with FEU Tech or the FEU Tech CpE Department.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Created by France Estrella. For feedback or suggestions, please reach out via the{" "}
                <Button
                  variant="link"
                  className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                  onClick={() => window.open("https://www.facebook.com/feutechCpEO", "_blank")}
                >
                  CpEO Page
                </Button>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
