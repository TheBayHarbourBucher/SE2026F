const SUBJECT_COLOURS = {
    'Mathematics': { tag: '#EDE9FE', text: '#5B21B6' },
    'English':     { tag: '#FFE4E6', text: '#9F1239' },
    'Science':     { tag: '#CFFAFE', text: '#155E75' },
    'History':     { tag: '#FEF3C7', text: '#92400E' },
    'Geography':   { tag: '#F0FDF4', text: '#166534' },
    'Art':         { tag: '#FDF4FF', text: '#6B21A8' },
}

let allTasks      = []
let currentFilter = 'all'
let currentSort   = 'date-asc'  // date-asc, date-desc, subject, alpha

async function loadTasks() {
    const userRes = await fetch('/api/me')
    if (!userRes.ok) { window.location.href = '/login'; return }
    const user = await userRes.json()
    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    document.getElementById('userAvatar').textContent = initials
    document.getElementById('subdate').textContent = new Date().toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    const res  = await fetch('/api/student/dashboard')
    const data = await res.json()
    allTasks   = data.tasks

    renderTasks()
    updateSortLabel()
}
function updateSortLabel() {
    const labels = {
        'date-asc':  'Due date ↑',
        'date-desc': 'Due date ↓',
        'subject':   'Subject A-Z',
        'alpha':     'Title A-Z'
    }
    document.getElementById('sortLabel').textContent = labels[currentSort]
}

function renderTasks() {
    const today     = new Date().toISOString().split('T')[0]
    const container = document.getElementById('tasksList')

    // Filter
    let filtered = allTasks.filter(task => {
        if (currentFilter === 'all')      return true
        if (currentFilter === 'complete') return task.completion_status === 'complete'
        if (currentFilter === 'pending')  return task.completion_status !== 'complete' && task.due_date >= today
        if (currentFilter === 'overdue')  return task.completion_status !== 'complete' && task.due_date < today
    })

    // Sort
    filtered.sort((a, b) => {
        if (currentSort === 'date-asc')   return a.due_date.localeCompare(b.due_date)
        if (currentSort === 'date-desc')  return b.due_date.localeCompare(a.due_date)
        if (currentSort === 'subject')    return a.subject.localeCompare(b.subject)
        if (currentSort === 'alpha')      return a.title.localeCompare(b.title)
    })

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="ti ti-clipboard-check"></i>
                <p>No tasks here</p>
                <span>Try a different filter</span>
            </div>`
        return
    }

    container.innerHTML = filtered.map(task => {
        const done    = task.completion_status === 'complete'
        const isLate  = !done && task.due_date < today
        const isSoon  = !done && !isLate && daysBetween(today, task.due_date) <= 3
        const colours = SUBJECT_COLOURS[task.subject] || { tag: '#F1F5F9', text: '#475569' }

        let dueClass = ''
        let dueText  = `Due ${formatDate(task.due_date)}`
        if (done)   { dueClass = 'done'; dueText = 'Completed' }
        if (isLate) { dueClass = 'late'; dueText = `Overdue · ${formatDate(task.due_date)}` }
        if (isSoon) { dueClass = 'soon'; dueText = `Due ${formatDate(task.due_date)}` }

        return `
        <div class="task-row">
            <div class="task-chk ${done ? 'done' : ''}"
                 onclick="toggleTask(${task.task_id}, this)"></div>
            <div class="task-info">
                <div class="task-title ${done ? 'done' : ''}">${task.title}</div>
                <div class="task-desc">${task.description || 'No description'}</div>
            </div>
            <div class="task-right">
                <span class="task-subj" style="background:${colours.tag};color:${colours.text}">${task.subject}</span>
                <span class="task-due ${dueClass}">${dueText}</span>
            </div>
        </div>`
    }).join('')
}

// Filter
function setFilter(filter, btn) {
    currentFilter = filter
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'))
    btn.classList.add('active')
    renderTasks()
}

// Sort — cycles through 4 options
function toggleSort() {
    const options = ['date-asc', 'date-desc', 'subject', 'alpha']
    const labels  = {
        'date-asc':  'Due date ↑',
        'date-desc': 'Due date ↓',
        'subject':   'Subject A-Z',
        'alpha':     'Title A-Z'
    }
    const next = options[(options.indexOf(currentSort) + 1) % options.length]
    currentSort = next
    document.getElementById('sortLabel').textContent = labels[next]
    renderTasks()
}

// Toggle complete
async function toggleTask(taskId, checkbox) {
    const isDone    = checkbox.classList.contains('done')
    const newStatus = isDone ? 'incomplete' : 'complete'
    checkbox.classList.toggle('done')
    await fetch('/api/task/toggle', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ task_id: taskId, status: newStatus })
    })
    await loadTasks()
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function daysBetween(a, b) {
    return Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24))
}

loadTasks()