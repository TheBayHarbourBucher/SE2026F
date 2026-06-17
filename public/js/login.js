// ── Show error from URL if login failed ──
const params = new URLSearchParams(window.location.search)
const error  = params.get('error')
if (error) {
    document.getElementById('errorBox').style.display = 'flex'
    document.getElementById('errorText').textContent  = error
}

// ── Role toggle ──
function setRole(role) {
    const studentBtn = document.getElementById('btnStudent')
    const teacherBtn = document.getElementById('btnTeacher')
    const loginBtn   = document.getElementById('loginBtn')

    document.getElementById('roleInput').value = role

    studentBtn.className = 'role-btn'
    teacherBtn.className = 'role-btn'

    if (role === 'student') {
        studentBtn.classList.add('active')
        loginBtn.style.background = '#7C3AED'
    } else {
        teacherBtn.classList.add('teacher-active')
        loginBtn.style.background = '#059669'
    }
}