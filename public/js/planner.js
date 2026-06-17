let currentDate = new Date()
let allTasks    = []
let allSessions = []
let selectedDay = null
const SUBJECT_COLOURS = {
    'Mathematics': '#7C3AED',
    'English':     '#F43F5E',
    'Science':     '#06B6D4',
    'History':     '#F59E0B',
    'Geography':   '#10B981',
    'Art':         '#A855F7',
}
async function loadCalendar() {
    const userRes = await fetch('/api/me')
    if (!userRes.ok) { window.location.href = '/login'; return }
    const user = await userRes.json()

    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    document.getElementById('userAvatar').textContent = initials

    document.getElementById('subdate').textContent = new Date().toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    const res  = await fetch('/api/calendar')
    const data = await res.json()
    allTasks    = data.tasks
    allSessions = data.sessions

    renderCalendar()
}

function renderCalendar() {
    const year        = currentDate.getFullYear()
    const month       = currentDate.getMonth()
    const firstDay    = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevDays    = new Date(year, month, 0).getDate()
    const today       = new Date().toISOString().split('T')[0]

    document.getElementById('monthLabel').textContent =
        new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

    const grid = document.getElementById('calGrid')
    grid.innerHTML = ''

    for (let i = 0; i < 42; i++) {
        const cell = document.createElement('div')
        cell.className = 'cal-cell'

        let dayNum, dateStr, isOtherMonth = false

        if (i < firstDay) {
            dayNum = prevDays - firstDay + i + 1
            const prevMonth = month === 0 ? 11 : month - 1
            const prevYear  = month === 0 ? year - 1 : year
            dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
            isOtherMonth = true
        } else if (i >= firstDay + daysInMonth) {
            dayNum = i - firstDay - daysInMonth + 1
            const nextMonth = month === 11 ? 0 : month + 1
            const nextYear  = month === 11 ? year + 1 : year
            dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
            isOtherMonth = true
        } else {
            dayNum  = i - firstDay + 1
            dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
        }

        if (isOtherMonth) cell.classList.add('other-month')
        if (dateStr === today) cell.classList.add('today')

        const dayTasks    = allTasks.filter(t => t.due_date === dateStr)
        const daySessions = allSessions.filter(s => s.date === dateStr)

        if (dayTasks.length > 0 || daySessions.length > 0) cell.classList.add('has-events')

        const dateDiv = document.createElement('div')
        dateDiv.className = 'cal-date'
        dateDiv.textContent = dayNum
        cell.appendChild(dateDiv)

        dayTasks.slice(0, 2).forEach(task => {
            const ev = document.createElement('div')
            const isOverdue = task.completion_status !== 'complete' && task.due_date < today
            ev.className = `cal-event ${isOverdue ? 'overdue' : 'task'}`
            ev.textContent = task.title
            cell.appendChild(ev)
        })

        daySessions.slice(0, 2).forEach(session => {
            const ev = document.createElement('div')
            ev.className = 'cal-event session'
            ev.textContent = session.title
            cell.appendChild(ev)
        })

        const totalEvents = dayTasks.length + daySessions.length
        if (totalEvents > 4) {
            const more = document.createElement('div')
            more.className = 'cal-event session'
            more.textContent = `+${totalEvents - 4} more`
            cell.appendChild(more)
        }

        cell.addEventListener('click', () => openDayModal(dateStr, dayTasks, daySessions))
        grid.appendChild(cell)
    }
}

function changeMonth(direction) {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1)
    renderCalendar()
}

function openDayModal(dateStr, tasks, sessions) {
    selectedDay = dateStr
    const today = new Date().toISOString().split('T')[0]
    const date  = new Date(dateStr + 'T00:00:00')

    document.getElementById('modalDate').textContent = date.toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long'
    })

    const body = document.getElementById('modalBody')

    if (tasks.length === 0 && sessions.length === 0) {
        body.innerHTML = `
            <div class="modal-empty">No events on this day</div>
            <div class="modal-add-hint">Click "Add event" to add a study session</div>
        `
    } else {
        body.innerHTML = ''

        tasks.forEach(task => {
            const isOverdue = task.completion_status !== 'complete' && task.due_date < today
            const colour    = isOverdue ? '#F43F5E' : '#7C3AED'
            const div = document.createElement('div')
            div.className = 'modal-event'
            div.innerHTML = `
                <div class="modal-event-dot" style="background:${colour}"></div>
                <div style="flex:1">
                    <div class="modal-event-title">${task.title}</div>
                    <div class="modal-event-sub">${task.subject} · ${isOverdue ? 'Overdue' : 'Due today'}</div>
                </div>
            `
            body.appendChild(div)
        })

        sessions.forEach(session => {
            const div = document.createElement('div')
            div.className = 'modal-event'
            div.innerHTML = `
                <div class="modal-event-dot" style="background:#059669"></div>
                <div style="flex:1">
                    <div class="modal-event-title">${session.title}</div>
                    <div class="modal-event-sub">Study session</div>
                </div>
                <button class="modal-delete" onclick="deleteSession(${session.session_id})">
                    <i class="ti ti-trash"></i>
                </button>
            `
            body.appendChild(div)
        })
    }

    document.getElementById('dayModal').classList.add('open')
}

function closeDayModal(e) {
    if (e.target === document.getElementById('dayModal')) {
        document.getElementById('dayModal').classList.remove('open')
    }
}
function closeDayModalDirect() {
    document.getElementById('dayModal').classList.remove('open')
}

function openAddModal() {
    if (selectedDay) document.getElementById('newDate').value = selectedDay
    document.getElementById('newTitle').value = ''
    document.getElementById('addModal').classList.add('open')
}
function closeAddModal(e) {
    if (e.target === document.getElementById('addModal')) {
        document.getElementById('addModal').classList.remove('open')
    }
}
function closeAddModalDirect() {
    document.getElementById('addModal').classList.remove('open')
}

async function addSession() {
    const title = document.getElementById('newTitle').value.trim()
    const date  = document.getElementById('newDate').value
    if (!title || !date) {
        alert('Please fill in both fields')
        return
    }

    const res  = await fetch('/api/calendar/add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, date })
    })

    const data = await res.json()

    if (res.ok) {
        closeAddModalDirect()
        await loadCalendar()
    } else {
        alert('Error: ' + data.error)
    }
}
async function deleteSession(sessionId) {
    await fetch(`/api/calendar/${sessionId}`, { method: 'DELETE' })
    closeDayModalDirect()
    await loadCalendar()
}

loadCalendar()