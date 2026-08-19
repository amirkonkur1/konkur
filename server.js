require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-jalaali');

// تنظیمات Moment برای فارسی
moment.loadPersian({ dialect: 'persian-modern', usePersianDigits: true });

const app = express();
// دریافت پورت از متغیرهای محیطی Railway یا پیش‌فرض 3000
const PORT = process.env.PORT || 3000;

// ──────────────── Middleware ────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ایجاد پوشه آپلود اگر وجود ندارد
const uploadDir = path.join(__dirname, 'uploads', 'teachers');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// تنظیمات Multer برای آپلود عکس
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'teacher-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // محدودیت 2 مگابایت
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('فقط فایل تصویری مجاز است'));
    }
});

// ──────────────── Database Config ────────────────
const dbConfig = {
    host: process.env.MYSQLHOST || 'localhost',
    port: process.env.MYSQLPORT || 3306,
    database: process.env.MYSQLDATABASE || 'planner_db',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    charset: 'utf8mb4',
    connectTimeout: 60000, // افزایش زمان انتظار برای اتصال
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

let pool;

async function getPoolWithRetry(retries = 5) {
    if (pool) return pool;

    for (let i = 1; i <= retries; i++) {
        try {
            console.log(`تلاش برای اتصال به دیتابیس (${i}/${retries})...`);
            pool = mysql.createPool(dbConfig);
            await pool.query('SELECT 1'); // تست اتصال
            console.log('✅ اتصال به دیتابیس موفقیت‌آمیز بود.');
            return pool;
        } catch (err) {
            console.error(`❌ خطا در اتصال به دیتابیس: ${err.message}`);
            if (i === retries) throw err;
            await new Promise(res => setTimeout(res, 5000)); // 5 ثانیه صبر
        }
    }
}

// ──────────────── DB Initialization ────────────────
async function initDB() {
    try {
        const p = await getPoolWithRetry();

        // 1. Create Tables
        
        // جدول اساتید
        await p.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                subject_name VARCHAR(100) NOT NULL,
                photo_url VARCHAR(255) DEFAULT NULL,
                color VARCHAR(7) DEFAULT '#6C63FF',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
        `);

        // برنامه کلاسی ثابت (تکرار شونده)
        await p.query(`
            CREATE TABLE IF NOT EXISTS fixed_schedule (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_id INT NOT NULL,
                day_of_week ENUM('شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه') NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                location VARCHAR(100),
                FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
        `);

        // وظایف موردی (تکالیف، آزمون‌ها و...)
        await p.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                task_type ENUM('مرور','حل نمونه سوال','نوشتن جزوه','مطالعه کتاب','آزمون','سایر') DEFAULT 'مطالعه کتاب',
                priority ENUM('کم','متوسط','زیاد','بحرانی') DEFAULT 'متوسط',
                is_completed BOOLEAN DEFAULT FALSE,
                due_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
        `);

        console.log('✅ جداول دیتابیس بررسی و آماده شدند.');
    } catch (err) {
        console.error('❌ خطا در راه‌اندازی اولیه دیتابیس:', err.message);
        // برنامه را متوقف نمی‌کنیم تا شاید بعداً متصل شود
    }
}

// ──────────────── Helper: Jalali Week Logic ────────────────
function getJalaliWeekStart(gregorianDateStr) {
    const m = moment(gregorianDateStr);
    let currentDayOfWeek = m.isoWeekday(); 
    let iranDayIndex;
    if (currentDayOfWeek === 6) iranDayIndex = 0; // Sat
    else if (currentDayOfWeek === 7) iranDayIndex = 1; // Sun
    else iranDayIndex = currentDayOfWeek + 1; 
    
    const startOfWeek = m.clone().subtract(iranDayIndex, 'days');
    return startOfWeek.format('YYYY-MM-DD');
}

// ──────────────── API Routes ────────────────

// 1. Teachers
app.get('/api/teachers', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        const [rows] = await p.query('SELECT * FROM teachers ORDER BY name');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teachers', upload.single('photo'), async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        const { name, subject_name, color } = req.body;
        const photo_url = req.file ? `/uploads/teachers/${req.file.filename}` : null;
        
        const [result] = await p.query(
            'INSERT INTO teachers (name, subject_name, photo_url, color) VALUES (?, ?, ?, ?)',
            [name, subject_name, photo_url, color || '#6C63FF']
        );
        res.json({ id: result.insertId, ...req.body, photo_url });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/teachers/:id', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        const [teachers] = await p.query('SELECT photo_url FROM teachers WHERE id=?', [req.params.id]);
        if(teachers[0]?.photo_url) {
            const filePath = path.join(__dirname, 'public', teachers[0].photo_url);
            if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await p.query('DELETE FROM teachers WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Fixed Schedule
app.get('/api/schedule', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        const [rows] = await p.query(`
            SELECT s.*, t.name as teacher_name, t.subject_name, t.photo_url, t.color 
            FROM fixed_schedule s
            JOIN teachers t ON s.teacher_id = t.id
            ORDER BY FIELD(s.day_of_week, 'شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'), s.start_time
        `);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/schedule', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        const { teacher_id, day_of_week, start_time, end_time, location } = req.body;
        await p.query(
            'INSERT INTO fixed_schedule (teacher_id, day_of_week, start_time, end_time, location) VALUES (?, ?, ?, ?, ?)',
            [teacher_id, day_of_week, start_time, end_time, location || '']
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/schedule/:id', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        await p.query('DELETE FROM fixed_schedule WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        const { start, end } = req.query;
        let query = 'SELECT * FROM tasks';
        let params = [];
        
        if (start && end) {
            query += ' WHERE due_date BETWEEN ? AND ?';
            params = [start, end];
        }
        
        query += ' ORDER BY due_date, priority DESC';
        
        const [rows] = await p.query(query, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        const { title, description, task_type, priority, due_date } = req.body;
        await p.query(
            'INSERT INTO tasks (title, description, task_type, priority, due_date) VALUES (?, ?, ?, ?, ?)',
            [title, description || '', task_type, priority, due_date]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/tasks/:id/toggle', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        await p.query('UPDATE tasks SET is_completed = NOT is_completed WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const p = await getPoolWithRetry();
        await p.query('DELETE FROM tasks WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────── Start Server ────────────────
// ابتدا دیتابیس را مقداردهی کن، سپس سرور را بالا بیاور
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`);
    });
}).catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
