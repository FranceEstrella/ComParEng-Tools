const { initialCourses } = require('../lib/course-data')

// Minimal helpers copied from the app to simulate planner behavior
const getAvailableSections = (code) => []
const hasAvailableSections = (code) => false
const findBestSection = (code) => undefined
const isInternshipCourse = (course) => {
  const nameContains = course.name.toLowerCase().includes('internship')
  const descContains = course.description ? course.description.toLowerCase().includes('internship') : false
  return nameContains || descContains
}

// Simulate generateGraduationPlan behavior when no progress
function simulate(startYear = new Date().getFullYear()) {
  // Prepare courses as pending
  const courses = initialCourses.map((c) => ({ ...c, status: 'pending' }))

  const anyProgress = courses.some((c) => c.status === 'active' || c.status === 'passed')
  if (!anyProgress) {
    const grouped = new Map()
    const termOrder = ['Term 1', 'Term 2', 'Term 3']
    const sorted = [...courses].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
    })

    for (const c of sorted) {
      if (c.status === 'pending' || c.status === 'active') {
        const key = `${c.year}-${c.term}`
        if (!grouped.has(key)) grouped.set(key, { year: c.year, term: c.term, courses: [] })
        grouped.get(key).courses.push({ ...c, availableSections: getAvailableSections(c.code), needsPetition: !hasAvailableSections(c.code), recommendedSection: findBestSection(c.code) })
      }
    }

    const planArray = Array.from(grouped.values())
    return planArray
  }

  return []
}

const plan = simulate(2025)
console.log('Simulated graduation plan (curriculum-default):')
plan.forEach((s) => {
  console.log(`${s.year} ${s.term}: ${s.courses.length} courses -> ${s.courses.map((c) => c.code).join(', ')}`)
})

// Now simulate internship placement: ensure internships go to startYear+3 Term 2/3
const internshipTargetYear = 2025 + 3
console.log('\nInternship target year:', internshipTargetYear)
const internships = initialCourses.filter((c) => isInternshipCourse(c))
console.log('Detected internships:', internships.map((i) => `${i.code} (${i.name})`))
