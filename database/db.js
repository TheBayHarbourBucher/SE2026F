const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

const db = new Database("studysync.db");

// ─── CREATE TABLES ────────────────────────────────────────

db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
        class_id    INTEGER PRIMARY KEY AUTOINCREMENT,
        class_name  TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        user_id     INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        email       TEXT    NOT NULL UNIQUE,
        password    TEXT    NOT NULL,
        role        TEXT    NOT NULL CHECK(role IN ('student', 'teacher')),
        class_id    INTEGER,
        FOREIGN KEY (class_id) REFERENCES classes(class_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
        task_id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title           TEXT    NOT NULL,
        subject         TEXT    NOT NULL,
        description     TEXT,
        due_date        TEXT    NOT NULL,
        class_id        INTEGER NOT NULL,
        created_by      INTEGER NOT NULL,
        FOREIGN KEY (class_id)   REFERENCES classes(class_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS task_completion (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id        INTEGER NOT NULL,
        task_id           INTEGER NOT NULL,
        completion_status TEXT    NOT NULL DEFAULT 'incomplete'
                          CHECK(completion_status IN ('complete', 'incomplete')),
        completion_date   TEXT,
        FOREIGN KEY (student_id) REFERENCES users(user_id),
        FOREIGN KEY (task_id)    REFERENCES tasks(task_id),
        UNIQUE(student_id, task_id)
    );
`);

// ─── SEED TEST DATA ───────────────────────────────────────

const classCount = db.prepare("SELECT COUNT(*) as count FROM classes").get();
if (classCount.count === 0) {
    db.prepare("INSERT INTO classes (class_name) VALUES (?)").run("Year 11B");
    db.prepare("INSERT INTO classes (class_name) VALUES (?)").run("Year 12A");
    console.log("✅ Classes created");
}

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (userCount.count === 0) {
    const studentPw = bcrypt.hashSync("student123", 10);
    const teacherPw = bcrypt.hashSync("teacher123", 10);

    db.prepare(`
        INSERT INTO users (name, email, password, role, class_id)
        VALUES (?, ?, ?, ?, ?)
    `).run("Alex Smith", "student@school.com", studentPw, "student", 1);

    db.prepare(`
        INSERT INTO users (name, email, password, role, class_id)
        VALUES (?, ?, ?, ?, ?)
    `).run("Ms Johnson", "teacher@school.com", teacherPw, "teacher", 1);

    console.log("✅ Test users created");
    console.log("   Student → student@school.com / student123");
    console.log("   Teacher → teacher@school.com / teacher123");
}

const taskCount = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
if (taskCount.count === 0) {
    const tasks = [
        ["Algebra Practice Set 3",   "Mathematics", "Complete exercises 3.1 to 3.5.", "2026-06-15", 1, 2],
        ["Chapter 5 Review Essay",   "English",     "Write a 500 word review.",        "2026-06-01", 1, 2],
        ["Lab Report — Titration",   "Science",     "Write up the titration experiment.","2026-06-12", 1, 2],
        ["WWI Causes Essay Plan",    "History",     "Create a dot point essay plan.",   "2026-06-20", 1, 2],
        ["Quadratic Functions Quiz", "Mathematics", "Study for the in-class quiz.",     "2026-05-30", 1, 2],
    ];

    const insert = db.prepare(`
        INSERT INTO tasks (title, subject, description, due_date, class_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    tasks.forEach(t => insert.run(...t));
    console.log("✅ Sample tasks created");
}

console.log(" Database ready");

// ── STUDY SESSIONS TABLE ──────────────────────────────────
db.exec(`
    CREATE TABLE IF NOT EXISTS study_sessions (
        session_id  INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id  INTEGER NOT NULL,
        title       TEXT    NOT NULL,
        date        TEXT    NOT NULL,
        FOREIGN KEY (student_id) REFERENCES users(user_id)
    );
    `)
console.log(' Study sessions table is  ready')

module.exports = db;