// ── Apply dark mode instantly before page renders ──
// This runs before anything else so there is no white flash
;(function() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark')
    }
})()

// ── Toggle dark mode ──
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('darkMode', isDark)
    updateToggleButton()
}

// ── Update toggle button icon ──
function updateToggleButton() {
    const isDark = document.documentElement.classList.contains('dark')
    const btn = document.getElementById('darkModeToggle')
    if (btn) {
        btn.innerHTML = isDark
            ? '<i class="ti ti-sun"></i>'
            : '<i class="ti ti-moon"></i>'
        btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode'
    }
}

// ── Run on page load ──
document.addEventListener('DOMContentLoaded', updateToggleButton)