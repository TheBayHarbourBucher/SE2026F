const SUBJECT_COLOURS = {
    'Mathematics': { tag: '#EDE9FE', text: '#5B21B6' },
    'English':     { tag: '#FFE4E6', text: '#9F1239' },
    'Science':     { tag: '#CFFAFE', text: '#155E75' },
    'History':     { tag: '#FEF3C7', text: '#92400E' },
    'Geography':   { tag: '#F0FDF4', text: '#166534' },
    'Art':         { tag: '#FDF4FF', text: '#6B21A8' },
}

let editingTaskId = null

// ── Load dashboard ──
async function loadDashboard() {
    const userRes = await fetch('/api/me')
    if (!userRes.ok) { window.location.href = '/login'; return }
    const user = await userRes.json()

    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    document.getElementById('userAvatar').textContent  = initials
    document.getElementById('greeting').textContent   = `Welcome, ${user.name}`
    document.getElementById('subdate').textContent    = new Date().toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    const res  = await fetch('/api/teacher/dashboard')
    const data = await res.json()

    renderStats(data)
    renderTasks(data.tasks, data.completion)
    renderStudents(data.students, data.tasks.length)
}
// ──the cards ──
function renderStats(data) {
    document.getElementById('statStudents').textContent = data.students.length
    document.getElementById('statTasks').textContent    = data.tasks.length
    const totalCompletion = data.students.reduce((sum, s) => {
        const done = data.completion.filter(c => c.student_id === s.user_id && c.completion_status === 'complete').length
        return sum + (data.tasks.length > 0 ? (done / data.tasks.length) * 100 : 0)
    }, 0)
    const avg    = data.students.length > 0 ? Math.round(totalCompletion / data.students.length) : 0
    const behind = data.students.filter(s => {
        const done = data.completion.filter(c => c.student_id === s.user_id && c.completion_status === 'complete').length
        const rate = data.tasks.length > 0 ? (done / data.tasks.length) * 100 : 0
        return rate < 50
    }).length

    document.getElementById('statAvg').textContent    = avg + '%'
    document.getElementById('statBehind').textContent = behind
}

// ──tasktables──
function renderTasks(tasks, completion) {
    const container = document.getElementById('tasksList')
    const today     = new Date().toISOString().split('T')[0]

    if (tasks.length === 0) {
        container.innerHTML = '<div class="loading">No tasks yet — create one!</div>'
        return
    }

    container.innerHTML = tasks.map(task => {
        const doneCount = completion.filter(c => c.task_id === task.task_id && c.completion_status === 'complete').length
        const colours   = SUBJECT_COLOURS[task.subject] || { tag: '#F1F5F9', text: '#475569' }
        const isLate    = task.due_date < today

        return `
        <div class="task-row">
            <span class="task-name">${task.title}</span>
            <span class="subj" style="background:${colours.tag};color:${colours.text}">${task.subject}</span>
            <span class="task-due" style="${isLate ? 'color:#F43F5E;font-weight:700' : ''}">${formatDate(task.due_date)}</span>
            <div style="display:flex;align-items:center;gap:8px">
                <span class="task-count" style="color:${doneCount > 0 ? '#0F766E' : '#9CA3AF'}">${doneCount} done</span>
                <div class="task-actions">
                    <button class="action-btn edit-btn" onclick="openEditTask(${task.task_id}, '${task.title}', '${task.subject}', \`${task.description || ''}\`, '${task.due_date}')">
                        <i class="ti ti-pencil"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteTask(${task.task_id})">
                        <i class="ti ti-trash"></i>
                    </button>
                </div>
            </div>
        </div>`
    }).join('')
}

// the students list 
function renderStudents(students, taskCount) {
    const container = document.getElementById('studentsList')

    if (students.length === 0) {
        container.innerHTML = '<div class="loading">No students in this class</div>'
        return
    }
    container.innerHTML = students.map(student => {
        const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        const pct      = student.completion_rate || 0
        let   barColour = '#0F766E'
        if (pct < 50) barColour = '#F43F5E'
        else if (pct < 75) barColour = '#F59E0B'
        return `
        <div class="student-row">
            <div class="student-av">${initials}</div>
            <div class="student-name">${student.name}</div>
            <div class="student-bar-wrap">
                <div class="student-bar-track">
                    <div class="student-bar-fill" style="width:${pct}%;background:${barColour}"></div>
                </div>
            </div>
            <div class="student-pct" style="color:${barColour}">${pct}%</div>
        </div>`
    }).join('')
}

// ── Open add task modal ──
function openAddTask() {
    editingTaskId = null
    document.getElementById('modalTitle').textContent = 'New task'
    document.getElementById('editTaskId').value = ''
    document.getElementById('taskTitle').value  = ''
    document.getElementById('taskSubject').value = 'Mathematics'
    document.getElementById('taskDesc').value   = ''
    document.getElementById('taskDue').value    = ''
    document.getElementById('formError').classList.remove('show')
    document.getElementById('addModal').classList.add('open')
}

// ── Open edit task modal ──
function openEditTask(id, title, subject, desc, due) {
    editingTaskId = id
    document.getElementById('modalTitle').textContent  = 'Edit task'
    document.getElementById('editTaskId').value        = id
    document.getElementById('taskTitle').value         = title
    document.getElementById('taskSubject').value       = subject
    document.getElementById('taskDesc').value          = desc
    document.getElementById('taskDue').value           = due
    document.getElementById('formError').classList.remove('show')
    document.getElementById('addModal').classList.add('open')
}

function closeModal() {
    document.getElementById('addModal').classList.remove('open')
}
function closeModalOverlay(e) {
    if (e.target === document.getElementById('addModal')) closeModal()
}

// ── Save task (create or edit) ──
async function saveTask() {
    const title   = document.getElementById('taskTitle').value.trim()
    const subject = document.getElementById('taskSubject').value
    const desc    = document.getElementById('taskDesc').value.trim()
    const due     = document.getElementById('taskDue').value
    const errEl   = document.getElementById('formError')

    if (!title || !due) {
        errEl.textContent = 'Title and due date are required'
        errEl.classList.add('show')
        return
    }

    const isEdit = editingTaskId !== null
    const url    = isEdit ? `/api/teacher/tasks/${editingTaskId}` : '/api/teacher/tasks'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subject, description: desc, due_date: due })
    })

    if (res.ok) {
        closeModal()
        loadDashboard()
    } else {
        errEl.textContent = 'Something went wrong. Try again.'
        errEl.classList.add('show')
    }
}

// ── Delete task ──
async function deleteTask(taskId) {
    if (!confirm('Delete this task? Students will lose their completion records.')) return

    await fetch(`/api/teacher/tasks/${taskId}`, { method: 'DELETE' })
    loadDashboard()
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

loadDashboard()