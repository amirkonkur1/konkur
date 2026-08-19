require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ──────────────── Middleware ────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ──────────────── Database Connection ────────────────
const dbConfig = {
  host: process.env.MYSQLHOST || 'localhost',
  port: process.env.MYSQLPORT || 3306,
  database: process.env.MYSQLDATABASE || 'planner_db',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// ──────────────── Initialize Database ────────────────
async function initializeDatabase() {
  try {
    // First connect without database to create it if needed
    const initPool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: 'utf8mb4'
    });

    await initPool.query(
      `CREATE DATABASE IF NOT EXISTS ${dbConfig.database} 
       CHARACTER SET utf8mb4 COLLATE utf8mb4_persian_ci`
    );
    await initPool.end();

    // Now connect with database and create tables
    const p = getPool();

    await p.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        grade VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#6C63FF',
        teacher VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS weekly_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        subject_id INT DEFAULT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        day_of_week ENUM('شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه') NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        priority ENUM('کم','متوسط','زیاد','بحرانی') DEFAULT 'متوسط',
        task_type ENUM('کلاس','مطالعه','تکلیف','امتحان','مرور','سایر') DEFAULT 'مطالعه',
        week_start_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS weekly_goals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        goal TEXT NOT NULL,
        is_achieved BOOLEAN DEFAULT FALSE,
        week_start_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
    `);

    // Create indexes
    try {
      await p.query(`CREATE INDEX idx_weekly_tasks_student_week ON weekly_tasks(student_id, week_start_date)`);
    } catch(e) {}
    try {
      await p.query(`CREATE INDEX idx_weekly_tasks_day ON weekly_tasks(day_of_week)`);
    } catch(e) {}
    try {
      await p.query(`CREATE INDEX idx_subjects_student ON subjects(student_id)`);
    } catch(e) {}
    try {
      await p.query(`CREATE INDEX idx_weekly_goals_student_week ON weekly_goals(student_id, week_start_date)`);
    } catch(e) {}

    // Check if we have a default student
    const [students] = await p.query('SELECT COUNT(*) as count FROM students');
    if (students[0].count === 0) {
      const [result] = await p.query(
        "INSERT INTO students (name, grade) VALUES (?, ?)",
        ['دانش‌آموز نمونه', 'یازدهم ریاضی']
      );
      const studentId = result.insertId;

      await p.query(`
        INSERT INTO subjects (student_id, name, color, teacher) VALUES
        (?, 'ریاضی', '#FF6B6B', 'آقای محمدی'),
        (?, 'فیزیک', '#4ECDC4', 'آقای رضایی'),
        (?, 'شیمی', '#45B7D1', 'خانم کریمی'),
        (?, 'ادبیات', '#96CEB4', 'خانم حسینی'),
        (?, 'زبان انگلیسی', '#FFEAA7', 'آقای نوری'),
        (?, 'عربی', '#DDA0DD', 'آقای عباسی')
      `, [studentId, studentId, studentId, studentId, studentId, studentId]);
    }

    console.log('✅ دیتابیس با موفقیت مقداردهی شد');
  } catch (error) {
    console.error('❌ خطا در مقداردهی دیتابیس:', error.message);
  }
}

// ──────────────── Helper Functions ────────────────
function getWeekStartDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  // In Iran, week starts on Saturday (day 6 in JS getDay())
  const diff = day >= 6 ? day - 6 : day + 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

const DAYS_OF_WEEK = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function getDayName(date) {
  const day = new Date(date).getDay();
  const mapping = [1, 2, 3, 4, 5, 6, 0]; // Sat=0, Sun=1, ..., Fri=6
  return DAYS_OF_WEEK[mapping[day]];
}

// ──────────────── API Routes ────────────────

// ── Student ──
app.get('/api/student', async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM students WHERE id = 1');
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/student', async (req, res) => {
  try {
    const { name, grade } = req.body;
    await getPool().query(
      'UPDATE students SET name = ?, grade = ? WHERE id = 1',
      [name, grade]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Subjects ──
app.get('/api/subjects', async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM subjects WHERE student_id = 1 ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const { name, color, teacher } = req.body;
    const [result] = await getPool().query(
      'INSERT INTO subjects (student_id, name, color, teacher) VALUES (1, ?, ?, ?)',
      [name, color || '#6C63FF', teacher || '']
    );
    res.json({ id: result.insertId, name, color: color || '#6C63FF', teacher: teacher || '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/subjects/:id', async (req, res) => {
  try {
    const { name, color, teacher } = req.body;
    await getPool().query(
      'UPDATE subjects SET name = ?, color = ?, teacher = ? WHERE id = ? AND student_id = 1',
      [name, color, teacher, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/subjects/:id', async (req, res) => {
  try {
    await getPool().query(
      'DELETE FROM subjects WHERE id = ? AND student_id = 1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Weekly Tasks ──
app.get('/api/tasks', async (req, res) => {
  try {
    const weekStart = req.query.week || getWeekStartDate();
    const [rows] = await getPool().query(
      `SELECT t.*, s.name as subject_name, s.color as subject_color 
       FROM weekly_tasks t 
       LEFT JOIN subjects s ON t.subject_id = s.id 
       WHERE t.student_id = 1 AND t.week_start_date = ? 
       ORDER BY 
         FIELD(t.day_of_week, 'شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'),
         t.start_time`,
      [weekStart]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, day_of_week, start_time, end_time, subject_id, priority, task_type, week_start_date } = req.body;
    const [result] = await getPool().query(
      `INSERT INTO weekly_tasks 
       (student_id, subject_id, title, description, day_of_week, start_time, end_time, priority, task_type, week_start_date) 
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subject_id || null, title, description || '', day_of_week, start_time, end_time, priority || 'متوسط', task_type || 'مطالعه', week_start_date || getWeekStartDate()]
    );
    res.json({ id: result.insertId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { title, description, day_of_week, start_time, end_time, subject_id, priority, task_type, is_completed } = req.body;
    await getPool().query(
      `UPDATE weekly_tasks SET 
       title=?, description=?, day_of_week=?, start_time=?, end_time=?, 
       subject_id=?, priority=?, task_type=?, is_completed=? 
       WHERE id=? AND student_id=1`,
      [title, description || '', day_of_week, start_time, end_time, subject_id || null, priority || 'متوسط', task_type || 'مطالعه', is_completed || false, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/tasks/:id/toggle', async (req, res) => {
  try {
    await getPool().query(
      'UPDATE weekly_tasks SET is_completed = NOT is_completed WHERE id = ? AND student_id = 1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await getPool().query('DELETE FROM weekly_tasks WHERE id = ? AND student_id = 1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Weekly Goals ──
app.get('/api/goals', async (req, res) => {
  try {
    const weekStart = req.query.week || getWeekStartDate();
    const [rows] = await getPool().query(
      'SELECT * FROM weekly_goals WHERE student_id = 1 AND week_start_date = ? ORDER BY created_at',
      [weekStart]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/goals', async (req, res) => {
  try {
    const { goal, week_start_date } = req.body;
    const [result] = await getPool().query(
      'INSERT INTO weekly_goals (student_id, goal, week_start_date) VALUES (1, ?, ?)',
      [goal, week_start_date || getWeekStartDate()]
    );
    res.json({ id: result.insertId, goal, is_achieved: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/goals/:id/toggle', async (req, res) => {
  try {
    await getPool().query(
      'UPDATE weekly_goals SET is_achieved = NOT is_achieved WHERE id = ? AND student_id = 1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  try {
    await getPool().query('DELETE FROM weekly_goals WHERE id = ? AND student_id = 1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Stats ──
app.get('/api/stats', async (req, res) => {
  try {
    const weekStart = req.query.week || getWeekStartDate();
    const [total] = await getPool().query(
      'SELECT COUNT(*) as count FROM weekly_tasks WHERE student_id = 1 AND week_start_date = ?',
      [weekStart]
    );
    const [completed] = await getPool().query(
      'SELECT COUNT(*) as count FROM weekly_tasks WHERE student_id = 1 AND week_start_date = ? AND is_completed = TRUE',
      [weekStart]
    );
    const [goals] = await getPool().query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_achieved THEN 1 ELSE 0 END) as achieved FROM weekly_goals WHERE student_id = 1 AND week_start_date = ?',
      [weekStart]
    );
    const [studyHours] = await getPool().query(
      `SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) / 60, 0) as hours 
       FROM weekly_tasks WHERE student_id = 1 AND week_start_date = ?`,
      [weekStart]
    );

    res.json({
      totalTasks: total[0].count,
      completedTasks: completed[0].count,
      totalGoals: goals[0].total,
      achievedGoals: goals[0].achieved || 0,
      studyHours: Math.round(studyHours[0].hours * 10) / 10,
      completionRate: total[0].count > 0 ? Math.round((completed[0].count / total[0].count) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ──────────────── Serve Frontend ────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ──────────────── Start Server ────────────────
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`);
    console.log(`📚 پلنر هفتگی دانش‌آموز آماده استفاده است`);
  });
});
