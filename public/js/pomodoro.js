// ── Timer settings (in minutes) ──
const settings = {
    focus: 25,
    short: 5,
    long:  15
}

// ── State ──
let currentMode    = 'focus'
let timeLeft       = settings.focus * 60
let totalTime      = settings.focus * 60
let isRunning      = false
let interval       = null
let sessionsToday  = 0
let minutesFocused = 0
let streak         = 0
const CIRCUMFERENCE = 2 * Math.PI * 88  // 553

// ── Load user info ──
async function loadUser() {
    const res  = await fetch('/api/me')
    if (!res.ok) { window.location.href = '/login'; return }
    const user = await res.json()
    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    document.getElementById('userAvatar').textContent = initials
    document.getElementById('subdate').textContent = new Date().toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
}

// ── Set timer mode ──
function setMode(mode) {
    if (isRunning) return  // don't switch while running

    currentMode = mode
    timeLeft    = settings[mode] * 60
    totalTime   = settings[mode] * 60

    // Update tabs
    document.querySelectorAll('.pom-tab').forEach(t => t.classList.remove('active'))
    document.getElementById(`tab${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active')

    // Update mode label
    const labels = { focus: 'Focus time', short: 'Short break', long: 'Long break' }
    document.getElementById('modeLabel').textContent = labels[mode]

    // Update colour for break modes
    const card = document.querySelector('.pom-card')
    if (mode === 'focus') {
        card.classList.remove('break-mode')
        document.querySelector('.ring-progress').style.stroke = '#7C3AED'
        document.getElementById('startBtn').style.background = '#7C3AED'
    } else {
        card.classList.add('break-mode')
        document.querySelector('.ring-progress').style.stroke = '#059669'
        document.getElementById('startBtn').style.background = '#059669'
    }

    updateDisplay()
    updateRing()
}

// ── Toggle start/pause ──
function toggleTimer() {
    if (isRunning) {
        pauseTimer()
    } else {
        startTimer()
    }
}

function startTimer() {
    isRunning = true
    document.getElementById('startIcon').className  = 'ti ti-player-pause'
    document.getElementById('startLabel').textContent = 'Pause'

    interval = setInterval(() => {
        timeLeft--
        updateDisplay()
        updateRing()

        if (timeLeft <= 0) {
            timerComplete()
        }
    }, 1000)
}
function pauseTimer() {
    isRunning = false
    clearInterval(interval)
    document.getElementById('startIcon').className  = 'ti ti-player-play'
    document.getElementById('startLabel').textContent = 'Resume'
}
function resetTimer() {
    isRunning = false
    clearInterval(interval)
    timeLeft  = settings[currentMode] * 60
    totalTime = settings[currentMode] * 60
    document.getElementById('startIcon').className  = 'ti ti-player-play'
    document.getElementById('startLabel').textContent = 'Start'
    updateDisplay()
    updateRing()
}

function skipTimer() {
    isRunning = false
    clearInterval(interval)
    timerComplete()
}

// ── Timer finishes ──
function timerComplete() {
    isRunning = false
    clearInterval(interval)

    // Notify the user
    if (Notification.permission === 'granted') {
        const messages = {
            focus: ' Focus session complete! Time for a break.',
            short: ' Break over! Ready to focus?',
            long:  ' Long break over! Ready to focus?'
        }
        new Notification('StudySync', { body: messages[currentMode] })
    }

    //if the focus session is complete update the status
    if (currentMode === 'focus') {
        sessionsToday++
        minutesFocused += settings.focus
        streak++
        updateStats()
        //switch to break
        if (sessionsToday % 4 === 0) {
            setMode('long')
        } else {
            setMode('short')
        }
        startTimer()  // auto start the break
    } else {
        //when the breaks finished auto go back to focus mode
        setMode('focus')
        document.getElementById('startIcon').className  = 'ti ti-player-play'
        document.getElementById('startLabel').textContent = 'Start'
    }
}

// ── Update the time display ──
function updateDisplay() {
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0')
    const secs = (timeLeft % 60).toString().padStart(2, '0')
    document.getElementById('timerDisplay').textContent = `${mins}:${secs}`
    document.title = `${mins}:${secs} — StudySync`
}

// ── Update the SVG ring ──
function updateRing() {
    const progress = timeLeft / totalTime
    const offset   = CIRCUMFERENCE * (1 - progress)
    document.getElementById('ringProgress').style.strokeDashoffset = offset
    document.getElementById('ringProgress').style.strokeDasharray  = CIRCUMFERENCE
}

//update the session stats
function updateStats() {
    document.getElementById('statSessions').textContent = sessionsToday
    document.getElementById('statMinutes').textContent  = minutesFocused
    document.getElementById('statStreak').textContent   = streak

    //the dots (must update)
    const dotsWrap = document.getElementById('sessionDots')
    dotsWrap.innerHTML = ''
    for (let i = 1; i <= 8; i++) {
        const dot = document.createElement('div')
        dot.className = `session-dot ${i <= sessionsToday ? 'done' : ''}`
        if (i > sessionsToday) dot.setAttribute('data-num', i)
        dotsWrap.appendChild(dot)
    }
}
//adjusting
function adjustTime(mode, amount) {
    const min = mode === 'short' ? 1 : 5
    const max = mode === 'short' ? 15 : 60
    settings[mode] = Math.min(max, Math.max(min, settings[mode] + amount))

    const labels = { focus: 'focusLabel', short: 'shortLabel', long: 'longLabel' }
    document.getElementById(labels[mode]).textContent = `${settings[mode]} min`

    // If changing current mode, reset the timer
    if (mode === currentMode && !isRunning) {
        timeLeft  = settings[mode] * 60
        totalTime = settings[mode] * 60
        updateDisplay()
        updateRing()
    }
}

// ── Request notification permission ──
function requestNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
    }
}

// ── Init ──
loadUser()
updateDisplay()
updateRing()
updateStats()
requestNotifications()