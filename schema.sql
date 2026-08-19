-- ایجاد دیتابیس
CREATE DATABASE IF NOT EXISTS planner_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_persian_ci;

USE planner_db;

-- جدول دانش‌آموز
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- جدول درس‌ها
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6C63FF',
  teacher VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- جدول برنامه هفتگی
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- جدول اهداف هفتگی
CREATE TABLE IF NOT EXISTS weekly_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  goal TEXT NOT NULL,
  is_achieved BOOLEAN DEFAULT FALSE,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;

-- ایندکس‌ها برای بهبود عملکرد
CREATE INDEX idx_weekly_tasks_student_week ON weekly_tasks(student_id, week_start_date);
CREATE INDEX idx_weekly_tasks_day ON weekly_tasks(day_of_week);
CREATE INDEX idx_subjects_student ON subjects(student_id);
CREATE INDEX idx_weekly_goals_student_week ON weekly_goals(student_id, week_start_date);

-- داده‌های نمونه
INSERT INTO students (name, grade) VALUES ('علی احمدی', 'یازدهم ریاضی');

INSERT INTO subjects (student_id, name, color, teacher) VALUES
(1, 'ریاضی', '#FF6B6B', 'آقای محمدی'),
(1, 'فیزیک', '#4ECDC4', 'آقای رضایی'),
(1, 'شیمی', '#45B7D1', 'خانم کریمی'),
(1, 'ادبیات', '#96CEB4', 'خانم حسینی'),
(1, 'زبان انگلیسی', '#FFEAA7', 'آقای نوری'),
(1, 'عربی', '#DDA0DD', 'آقای عباسی');
