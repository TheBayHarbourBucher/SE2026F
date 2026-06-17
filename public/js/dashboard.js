// Subject colours for tags and bars
const SUBJECT_COLOURS = {
    'Mathematics': { tag: '#EDE9FE', text: '#5B21B6', bar: '#7C3AED' },
    'English':     { tag: '#FFE4E6', text: '#9F1239', bar: '#F43F5E' },
    'Science':     { tag: '#CFFAFE', text: '#155E75', bar: '#06B6D4' },
    'History':     { tag: '#FEF3C7', text: '#92400E', bar: '#F59E0B' },
    'Geography':   { tag: '#F0FDF4', text: '#166534', bar: '#10B981' },
    'Art':         { tag: '#FDF4FF', text: '#6B21A8', bar: '#A855F7' },
}

function getSubjectColour(subject) {
    return SUBJECT_COLOURS[subject] || { tag: '#F1F5F9', text: '#475569', bar: '#94A3B8' }
}

//set greeting based on time of day
function setGreeting(name) {
    const hour = new Date().getHours()
    let time = 'morning'
    if (hour >= 12 && hour < 17) time = 'afternoon'
    if (hour >= 17) time = 'evening'
    document.getElementById('greeting').textContent = `Good ${time}, ${name} 👋`
}
//set date subtitle
function setDate() {
    const now = new Date()
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    document.getElementById('subdate').textContent = now.toLocaleDateString('en-AU', options)
}


//set user avatar initials
function setAvatar(name) {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    document.getElementById('userAvatar').textContent = initials
}

//the tasks list
function renderTasks(tasks) {
    const container = document.getElementById('tasksList')
    if (tasks.length === 0) {
        container.innerHTML = '<div class="loading">No tasks yet 🎉</div>'
        return
    }

    //to show the 5 most recent
    const recent = tasks.slice(0, 5)
    container.innerHTML = recent.map(task => {
        const done    = task.completion_status === 'complete'
        const colours = getSubjectColour(task.subject)
        const today   = new Date().toISOString().split('T')[0]
        const isLate  = !done && task.due_date < today

        return `
        <div class="titem" id="task-${task.task_id}">
            <div class="chk ${done ? 'done' : ''}" onclick="toggleTask(${task.task_id}, this)"></div>
            <div style="flex:1">
                <div class="tname ${done ? 'done' : ''}">${task.title}</div>
                <div class="tmeta ${isLate ? 'late' : ''}">
                    ${isLate ? 'Overdue · ' : 'Due '}${formatDate(task.due_date)}
                </div>
            </div>
            <span class="subj" style="background:${colours.tag};color:${colours.text}">${task.subject}</span>
        </div>`
    }).join('')
}

// ── Render subject progress bars ──
function renderSubjectBars(tasks) {
    const container = document.getElementById('subjectBars')

    // Group tasks by subject
    const subjects = {}
    tasks.forEach(task => {
        if (!subjects[task.subject]) subjects[task.subject] = { total: 0, done: 0 }
        subjects[task.subject].total++
        if (task.completion_status === 'complete') subjects[task.subject].done++
    })

    if (Object.keys(subjects).length === 0) {
        container.innerHTML = '<div class="loading">No data yet</div>'
        return
    }

    container.innerHTML = Object.entries(subjects).map(([subject, data]) => {
        const pct     = Math.round((data.done / data.total) * 100)
        const colours = getSubjectColour(subject)
        return `
        <div class="brow">
            <div class="blbl">${subject.split(' ')[0]}</div>
            <div class="btrack">
                <div class="bfill" style="width:${pct}%;background:${colours.bar}"></div>
            </div>
            <div class="bpct">${pct}%</div>
        </div>`
    }).join('')
}

// ── Render upcoming deadlines ──
function renderDeadlines(tasks) {
    const container = document.getElementById('deadlinesList')
    const today     = new Date().toISOString().split('T')[0]

    // Get upcoming incomplete tasks sorted by due date
    const upcoming = tasks
        .filter(t => t.completion_status !== 'complete' && t.due_date >= today)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 4)

    if (upcoming.length === 0) {
        container.innerHTML = '<div class="loading">No upcoming deadlines 🎉</div>'
        return
    }

    container.innerHTML = upcoming.map(task => {
        const date    = new Date(task.due_date)
        const day     = date.getDate()
        const month   = date.toLocaleString('en-AU', { month: 'short' })
        const colours = getSubjectColour(task.subject)

        // Colour the date based on urgency
        const daysLeft = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24))
        let dateColour = '#7C3AED'
        if (daysLeft <= 2) dateColour = '#F43F5E'
        else if (daysLeft <= 7) dateColour = '#F59E0B'

        return `
        <div class="dcard">
            <div class="dday" style="color:${dateColour}">${day}</div>
            <div class="dmon">${month}</div>
            <div class="dtitle">${task.title}</div>
            <div class="dsub">${task.subject}</div>
        </div>`
    }).join('')
}

// ── Toggle task complete/incomplete ──
async function toggleTask(taskId, checkbox) {
    const isDone  = checkbox.classList.contains('done')
    const newStatus = isDone ? 'incomplete' : 'complete'

    // Update UI immediately
    checkbox.classList.toggle('done')
    const nameEl = checkbox.closest('.titem').querySelector('.tname')
    nameEl.classList.toggle('done')

    // Send to server
    await fetch('/api/task/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, status: newStatus })
    })

    // Refresh stats
    loadDashboard()
}

// ── Format date nicely ──
function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// ── Load all dashboard data ──
async function loadDashboard() {
    try {
        // Get user info
        const userRes = await fetch('/api/me')
        if (!userRes.ok) { window.location.href = '/login'; return; }
        const user = await userRes.json()

        setGreeting(user.name)
        setAvatar(user.name)
        setDate()

        // Get dashboard data
        const dataRes = await fetch('/api/student/dashboard')
        const data    = await dataRes.json()

        // Update stat cards
        document.getElementById('statTotal').textContent     = data.total
        document.getElementById('statCompleted').textContent = data.completed
        document.getElementById('statDueSoon').textContent   = data.due_soon
        document.getElementById('statOverdue').textContent   = data.overdue

        // Render sections
        renderTasks(data.tasks)
        renderSubjectBars(data.tasks)
        renderDeadlines(data.tasks)

    } catch (err) {
        console.error('Dashboard error:', err)
    }
}

// ── Run on page load ──
loadDashboard()