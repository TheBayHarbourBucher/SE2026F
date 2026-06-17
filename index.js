



const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./database/db.js");

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true })); // read form data
app.use(express.json()); // read JSON (for API calls)
app.use(session({
    secret: "studysync_2026_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// ─── SERVE HTML PAGES ─────────────────────────────────────
// Instead of a template engine we just serve plain HTML files

function sendPage(res, filePath) {
    res.sendFile(path.join(__dirname, filePath));
}

// ─── ROUTES ───────────────────────────────────────────────

// Home → redirect to login
app.get("/", (req, res) => {
    res.redirect("/login");
});

// Login page
app.get("/login", (req, res) => {
    sendPage(res, "templates/login.html");
});

// Handle login form submission
app.post("/login", async (req, res) => {
    const { email, password, role } = req.body;

    // Basic validation
    if (!email || !password || !role) {
        return res.redirect("/login?error=Please fill in all fields");
    }

    // Find user in database
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user) {
        return res.redirect("/login?error=No account found with that email");
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.redirect("/login?error=Incorrect password");
    }

    // Check role matches
    if (user.role !== role) {
        return res.redirect(`/login?error=This account is not a ${role} account`);
    }

    // Save user to session
    req.session.user = {
        id:       user.user_id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        class_id: user.class_id
    };

    // Redirect based on role
    if (user.role === "student") {
        res.redirect("/student/dashboard");
    } else if (user.role === "teacher") {
        res.redirect("/teacher/dashboard");
    }
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// ─── STUDENT ROUTES ───────────────────────────────────────

app.get("/student/dashboard", (req, res) => {
    // Guard — must be logged in as student
    if (!req.session.user || req.session.user.role !== "student") {
        return res.redirect("/login");
    }
    sendPage(res, "templates/student/dashboard.html");
});

// ─── TEACHER ROUTES ───────────────────────────────────────



// ─── API — get current logged in user ─────────────────────
// Pages call this to get user info (name, role etc)
app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in" });
    }
    res.json(req.session.user);
});

// ─── API — get student dashboard data ─────────────────────
app.get("/api/student/dashboard", (req, res) => {
    if (!req.session.user || req.session.user.role !== "student") {
        return res.status(401).json({ error: "Not logged in" });
    }

    const userId   = req.session.user.id;
    const classId  = req.session.user.class_id;
    const today    = new Date().toISOString().split("T")[0];

    // Get all tasks for this student's class with completion status
    const tasks = db.prepare(`
        SELECT t.*,
               COALESCE(tc.completion_status, 'incomplete') AS completion_status
        FROM   tasks t
        LEFT JOIN task_completion tc
               ON t.task_id    = tc.task_id
              AND tc.student_id = ?
        WHERE  t.class_id = ?
        ORDER  BY t.due_date ASC
    `).all(userId, classId);

    // Calculate stats
    const total     = tasks.length;
    const completed = tasks.filter(t => t.completion_status === "complete").length;
    const overdue   = tasks.filter(t => t.completion_status !== "complete" && t.due_date < today).length;
    const due_soon  = total - completed - overdue;

    res.json({ tasks, total, completed, overdue, due_soon });
});

// ─── API — toggle task complete/incomplete ─────────────────
app.post("/api/task/toggle", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in" });
    }

    const { task_id, status } = req.body;
    const studentId = req.session.user.id;
    const today = new Date().toISOString().split("T")[0];
    const completionDate = status === "complete" ? today : null;

    db.prepare(`
        INSERT INTO task_completion (student_id, task_id, completion_status, completion_date)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(student_id, task_id)
        DO UPDATE SET completion_status = excluded.completion_status,
                      completion_date   = excluded.completion_date
    `).run(studentId, task_id, status, completionDate);

    res.json({ success: true, status });
});

// ─── CALENDAR PAGE ────────────────────────────────────────
app.get('/student/planner', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login')
    sendPage(res, 'templates/student/planner.html')
})

//the calander events 
app.get('/api/calendar', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' })

    try {
        const studentId = req.session.user.id
        const classId   = req.session.user.class_id

        const tasks = db.prepare(`
            SELECT t.task_id, t.title, t.subject, t.due_date,
                   COALESCE(tc.completion_status, 'incomplete') AS completion_status
            FROM tasks t
            LEFT JOIN task_completion tc
                   ON t.task_id = tc.task_id AND tc.student_id = ?
            WHERE t.class_id = ?
        `).all(studentId, classId)

        const sessions = db.prepare(`
            SELECT * FROM study_sessions WHERE student_id = ?
        `).all(studentId)

        res.json({ tasks, sessions })

    } catch(err) {
        console.log('Calendar error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// ─── API — add a personal study session ──────────────────
app.post('/api/calendar/add', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' })

    const { title, date } = req.body
    if (!title || !date) return res.status(400).json({ error: 'Title and date required' })

    const result = db.prepare(`
        INSERT INTO study_sessions (student_id, title, date)
        VALUES (?, ?, ?)
    `).run(req.session.user.id, title, date)

    res.json({ success: true, session_id: result.lastInsertRowid })
})

// ─── API — delete a personal study session ───────────────
app.delete('/api/calendar/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' })

    db.prepare(`
        DELETE FROM study_sessions
        WHERE session_id = ? AND student_id = ?
    `).run(req.params.id, req.session.user.id)

    res.json({ success: true })
})

app.get('/student/pomodoro', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login')
    sendPage(res, 'templates/student/pomodoro.html')
})

app.get('/student/tasks', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login')
    sendPage(res, 'templates/student/tasks.html')
})
// ─── TEACHER DASHBOARD PAGE ───────────────────────────────
app.get('/teacher/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') return res.redirect('/login')
    sendPage(res, 'templates/teacher/dashboard.html')
})

// ─── API — teacher dashboard data ────────────────────────
app.get('/api/teacher/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') return res.status(401).json({ error: 'Not logged in' })

    try {
        const classId = req.session.user.class_id

        // Get all tasks for this class
        const tasks = db.prepare(`
            SELECT * FROM tasks WHERE class_id = ? ORDER BY due_date ASC
        `).all(classId)

        // Get all students in this class
        const students = db.prepare(`
            SELECT user_id, name, email FROM users
            WHERE class_id = ? AND role = 'student'
        `).all(classId)

        // Get all completion records for this class
        const completion = db.prepare(`
            SELECT tc.* FROM task_completion tc
            JOIN tasks t ON tc.task_id = t.task_id
            WHERE t.class_id = ?
        `).all(classId)

        // Calculate completion rate per student
        const studentsWithRate = students.map(student => {
            const done = completion.filter(c =>
                c.student_id === student.user_id && c.completion_status === 'complete'
            ).length
            const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0
            return { ...student, completion_rate: rate }
        })

        res.json({ tasks, students: studentsWithRate, completion })

    } catch (err) {
        console.log('Teacher dashboard error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// ─── API — create a task ──────────────────────────────────
app.post('/api/teacher/tasks', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') return res.status(401).json({ error: 'Not logged in' })

    const { title, subject, description, due_date } = req.body
    if (!title || !due_date) return res.status(400).json({ error: 'Title and due date required' })

    db.prepare(`
        INSERT INTO tasks (title, subject, description, due_date, class_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, subject, description, due_date, req.session.user.class_id, req.session.user.id)

    res.json({ success: true })
})

// ─── API — edit a task ────────────────────────────────────
app.put('/api/teacher/tasks/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') return res.status(401).json({ error: 'Not logged in' })

    const { title, subject, description, due_date } = req.body

    db.prepare(`
        UPDATE tasks SET title = ?, subject = ?, description = ?, due_date = ?
        WHERE task_id = ? AND class_id = ?
    `).run(title, subject, description, due_date, req.params.id, req.session.user.class_id)

    res.json({ success: true })
})

// ─── API — delete a task ──────────────────────────────────
app.delete('/api/teacher/tasks/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') return res.status(401).json({ error: 'Not logged in' })

    // Delete completion records first
    db.prepare(`DELETE FROM task_completion WHERE task_id = ?`).run(req.params.id)
    // Then delete the task
    db.prepare(`DELETE FROM tasks WHERE task_id = ? AND class_id = ?`).run(req.params.id, req.session.user.class_id)

    res.json({ success: true })
})

app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'manifest.json'))
})

app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'service-worker.js'))
})



// ─── START SERVER ─────────────────────────────────────────
app.listen(3000, () => {
    console.log("✅ StudySync running on http://localhost:3000");
});