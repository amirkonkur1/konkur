// ═══════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════
let currentWeekStart = getWeekStartDate(new Date());
let subjects = [];
let tasks = [];
let goals = [];

const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const TASK_TYPE_ICONS = {
  'مطالعه': '📖',
  'کلاس': '🏫',
  'تکلیف': '📝',
  'امتحان': '📋',
  'مرور': '🔄',
  'سایر': '📌'
};

// ═══════════════════════════════════════════
// Date Helpers
// ═══════════════════════════════════════════
function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day >= 6 ? day - 6 : day + 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return formatDate(d);
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function toPersianDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function toPersianShort(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fa-IR', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function isToday(dateStr) {
  return dateStr === formatDate(new Date());
}

// ═══════════════════════════════════════════
// API Helper
// ═══════════════════════════════════════════
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return await res.json();
  } catch (error) {
    console.error('API Error:', error);
    showToast('خطا در ارتباط با سرور', 'error');
    return null;
  }
}

// ═══════════════════════════════════════════
// Toast Notification
// ═══════════════════════════════════════════
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════════
// Modal Management
// ═══════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function showTaskModal(day = null, task = null) {
  const form = document.getElementById('taskForm');
  form.reset();
  document.getElementById('taskId').value = '';
  document.getElementById('taskModalTitle').textContent = '➕ افزودن برنامه جدید';

  // Populate subjects dropdown
  const select = document.getElementById('taskSubject');
  select.innerHTML = '<option value="">بدون درس</option>';
  subjects.forEach(s => {
    select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });

  if (day) {
    document.getElementById('taskDay').value = day;
  }

  if (task) {
    document.getElementById('taskModalTitle').textContent = '✏️ ویرایش برنامه';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskSubject').value = task.subject_id || '';
    document.getElementById('taskDay').value = task.day_of_week;
    document.getElementById('taskStartTime').value = task.start_time.substring(0, 5);
    document.getElementById('taskEndTime').value = task.end_time.substring(0, 5);
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskType').value = task.task_type;
    document.getElementById('taskDesc').value = task.description || '';
  }

  openModal('taskModal');
}

function showGoalModal() {
  document.getElementById('goalText').value = '';
  openModal('goalModal');
}

function showSubjectModal(subject = null) {
  document.getElementById('subjectForm').reset();
  document.getElementById('subjectId').value = '';
  document.getElementById('subjectModalTitle').textContent = '📖 درس جدید';
  document.getElementById('subjectColor').value = '#6C63FF';

  if (subject) {
    document.getElementById('subjectModalTitle').textContent = '✏️ ویرایش درس';
    document.getElementById('subjectId').value = subject.id;
    document.getElementById('subjectName').value = subject.name;
    document.getElementById('subjectTeacher').value = subject.teacher || '';
    document.getElementById('subjectColor').value = subject.color;
  }

  openModal('subjectModal');
}

// ═══════════════════════════════════════════
// CRUD Operations
// ═══════════════════════════════════════════
async function saveTask(e) {
  e.preventDefault();
  const id = document.getElementById('taskId').value;
  const data = {
    title: document.getElementById('taskTitle').value,
    subject_id: document.getElementById('taskSubject').value || null,
    day_of_week: document.getElementById('taskDay').value,
    start_time: document.getElementById('taskStartTime').value + ':00',
    end_time: document.getElementById('taskEndTime').value + ':00',
    priority: document.getElementById('taskPriority').value,
    task_type: document.getElementById('taskType').value,
    description: document.getElementById('taskDesc').value,
    week_start_date: currentWeekStart
  };

  if (id) {
    await api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    showToast('✅ برنامه ویرایش شد');
  } else {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
    showToast('✅ برنامه اضافه شد');
  }

  closeModal('taskModal');
  loadAll();
}

async function toggleTask(id) {
  await api(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
  loadAll();
}

async function deleteTask(id) {
  if (confirm('آیا از حذف این برنامه مطمئنید؟')) {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    showToast('🗑️ برنامه حذف شد');
    loadAll();
  }
}

async function saveGoal(e) {
  e.preventDefault();
  const goal = document.getElementById('goalText').value;
  await api('/api/goals', {
    method: 'POST',
    body: JSON.stringify({ goal, week_start_date: currentWeekStart })
  });
  showToast('✅ هدف اضافه شد');
  closeModal('goalModal');
  loadAll();
}

async function toggleGoal(id) {
  await api(`/api/goals/${id}/toggle`, { method: 'PATCH' });
  loadAll();
}

async function deleteGoal(id) {
  if (confirm('آیا از حذف این هدف مطمئنید؟')) {
    await api(`/api/goals/${id}`, { method: 'DELETE' });
    showToast('🗑️ هدف حذف شد');
    loadAll();
  }
}

async function saveSubject(e) {
  e.preventDefault();
  const id = document.getElementById('subjectId').value;
  const data = {
    name: document.getElementById('subjectName').value,
    teacher: document.getElementById('subjectTeacher').value,
    color: document.getElementById('subjectColor').value
  };

  if (id) {
    await api(`/api/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    showToast('✅ درس ویرایش شد');
  } else {
    await api('/api/subjects', { method: 'POST', body: JSON.stringify(data) });
    showToast('✅ درس اضافه شد');
  }

  closeModal('subjectModal');
  loadAll();
}

async function deleteSubject(id) {
  if (confirm('آیا از حذف این درس مطمئنید؟')) {
    await api(`/api/subjects/${id}`, { method: 'DELETE' });
    showToast('🗑️ درس حذف شد');
    loadAll();
  }
}

// ═══════════════════════════════════════════
// Render Functions
// ═══════════════════════════════════════════
function renderWeekLabel() {
  const end = addDays(currentWeekStart, 6);
  document.getElementById('weekLabel').textContent =
    `${toPersianShort(currentWeekStart)} - ${toPersianShort(end)}`;
}

function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.totalTasks;
  document.getElementById('statCompleted').textContent = stats.completedTasks;
  document.getElementById('statRate').textContent = stats.completionRate + '%';
  document.getElementById('statHours').textContent = stats.studyHours;
  document.getElementById('statGoals').textContent = `${stats.achievedGoals}/${stats.totalGoals}`;
}

function renderSubjects() {
  const container = document.getElementById('subjectsList');
  if (subjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📖</span>
        <span class="empty-text">درسی اضافه نشده</span>
      </div>`;
    return;
  }

  container.innerHTML = subjects.map(s => `
    <div class="subject-item">
      <div class="subject-color" style="background: ${s.color}"></div>
      <span class="subject-name">${s.name}</span>
      <div class="subject-actions">
        <button class="subject-edit" onclick='showSubjectModal(${JSON.stringify(s)})' title="ویرایش">✏️</button>
        <button class="subject-delete" onclick="deleteSubject(${s.id})" title="حذف">🗑️</button>
      </div>
    </div>
  `).join('');
}

function renderGoals() {
  const container = document.getElementById('goalsList');
  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎯</span>
        <span class="empty-text">هدفی تعیین نشده</span>
      </div>`;
    return;
  }

  container.innerHTML = goals.map(g => `
    <div class="goal-item ${g.is_achieved ? 'achieved' : ''}" onclick="toggleGoal(${g.id})">
      <div class="goal-checkbox">${g.is_achieved ? '✓' : ''}</div>
      <span class="goal-text">${g.goal}</span>
      <button class="goal-delete" onclick="event.stopPropagation(); deleteGoal(${g.id})">✕</button>
    </div>
  `).join('');
}

function renderWeeklyGrid() {
  const grid = document.getElementById('weeklyGrid');
  grid.innerHTML = '';

  DAYS.forEach((day, index) => {
    const dateStr = addDays(currentWeekStart, index);
    const todayClass = isToday(dateStr) ? 'today' : '';
    const dayTasks = tasks.filter(t => t.day_of_week === day);

    const col = document.createElement('div');
    col.className = `day-column ${todayClass}`;

    col.innerHTML = `
      <div class="day-header">
        <span class="day-name">${day}</span>
        <span class="day-date">${toPersianDate(dateStr)}</span>
      </div>
      <div class="day-tasks">
        ${dayTasks.length === 0 ? `
          <div class="empty-state">
            <span class="empty-icon">📭</span>
            <span class="empty-text">برنامه‌ای نیست</span>
          </div>
        ` : dayTasks.map(t => renderTaskCard(t)).join('')}
      </div>
      <button class="day-add-btn" onclick="showTaskModal('${day}')">+ افزودن</button>
    `;

    grid.appendChild(col);
  });
}

function renderTaskCard(task) {
  const subject = subjects.find(s => s.id === task.subject_id);
  const color = subject ? subject.color : '#6C63FF';
  const subjectName = subject ? subject.name : '';
  const icon = TASK_TYPE_ICONS[task.task_type] || '📌';

  return `
    <div class="task-card ${task.is_completed ? 'completed' : ''}" 
         style="border-right-color: ${color}">
      <div class="task-actions">
        <button class="task-check" onclick="toggleTask(${task.id})" title="${task.is_completed ? 'لغو انجام' : 'انجام شده'}">
          ${task.is_completed ? '↩️' : '✅'}
        </button>
        <button class="task-edit-btn" onclick='showTaskModal(null, ${JSON.stringify(task).replace(/'/g, "\\'")})' title="ویرایش">✏️</button>
        <button class="task-delete-btn" onclick="deleteTask(${task.id})" title="حذف">🗑️</button>
      </div>
      <div class="task-time">⏰ ${task.start_time.substring(0, 5)} - ${task.end_time.substring(0, 5)}</div>
      <div class="task-title">${task.title}</div>
      ${subjectName ? `<span class="task-subject-tag" style="background: ${color}22; color: ${color}">${subjectName}</span>` : ''}
      <div class="task-type-badge">
        <span class="task-priority-dot priority-${task.priority}"></span>
        ${icon} ${task.task_type}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════
// Load All Data
// ═══════════════════════════════════════════
async function loadAll() {
  const weekParam = `?week=${currentWeekStart}`;

  const [subjectsData, tasksData, goalsData, statsData] = await Promise.all([
    api('/api/subjects'),
    api(`/api/tasks${weekParam}`),
    api(`/api/goals${weekParam}`),
    api(`/api/stats${weekParam}`)
  ]);

  if (subjectsData) subjects = subjectsData;
  if (tasksData) tasks = tasksData;
  if (goalsData) goals = goalsData;

  renderWeekLabel();
  if (statsData) renderStats(statsData);
  renderSubjects();
  renderGoals();
  renderWeeklyGrid();
}

// ═══════════════════════════════════════════
// Week Navigation
// ═══════════════════════════════════════════
document.getElementById('prevWeek').addEventListener('click', () => {
  currentWeekStart = addDays(currentWeekStart, -7);
  loadAll();
});

document.getElementById('nextWeek').addEventListener('click', () => {
  currentWeekStart = addDays(currentWeekStart, 7);
  loadAll();
});

document.getElementById('todayBtn').addEventListener('click', () => {
  currentWeekStart = getWeekStartDate(new Date());
  loadAll();
});

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  }
  if (e.key === 'n' && e.ctrlKey) {
    e.preventDefault();
    showTaskModal();
  }
});

// ═══════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', loadAll);
