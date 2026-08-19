// تنظیمات اولیه
const DAYS_IR = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
let currentDate = new Date(); // تاریخ جاری میلادی برای ناوبری
let teachers = [];

// ─── توابع کمکی تاریخ ───
// تبدیل تاریخ میلادی به شمسی رشته‌ای
function toJalali(date) {
    return moment(date).format('jYYYY/jMM/jDD');
}

// گرفتن شنبه‌ی هفته‌ای که تاریخ داده شده در آن است
function getSaturdayOfWeek(date) {
    const m = moment(date);
    const day = m.isoWeekday(); // 1=Mon ... 7=Sun
    // اگر شنبه (6) باشد، diff=0. اگر یکشنبه (7) باشد diff=1. اگر دوشنبه (1) باشد diff=2
    let diff = day >= 6 ? day - 6 : day + 1;
    return m.subtract(diff, 'days').startOf('day');
}

// ─── بارگذاری داده‌ها ───
async function loadData() {
    renderHeader();
    await loadTeachers();
    await renderGrid();
}

async function loadTeachers() {
    const res = await fetch('/api/teachers');
    teachers = await res.json();
    
    // پر کردن سلکت باکس استادها در فرم کلاس
    const select = document.getElementById('teacherSelect');
    select.innerHTML = '<option value="">انتخاب کنید...</option>';
    teachers.forEach(t => {
        select.innerHTML += `<option value="${t.id}">${t.name} (${t.subject_name})</option>`;
    });
}

// ─── رندر کردن صفحه ───
function renderHeader() {
    const sat = getSaturdayOfWeek(currentDate);
    const fri = sat.clone().add(6, 'days');
    document.getElementById('currentWeekLabel').innerText = 
        `${toJalali(sat)} تا ${toJalali(fri)}`;
}

async function renderGrid() {
    const grid = document.getElementById('weeklyGrid');
    grid.innerHTML = '';

    const sat = getSaturdayOfWeek(currentDate);
    
    // دریافت برنامه ثابت (کلاس‌ها)
    const scheduleRes = await fetch('/api/schedule');
    const schedule = await scheduleRes.json();

    // دریافت تسک‌های این هفته (بازه میلادی)
    const startMiladi = sat.format('YYYY-MM-DD');
    const endMiladi = sat.clone().add(6, 'days').format('YYYY-MM-DD');
    const tasksRes = await fetch(`/api/tasks?start=${startMiladi}&end=${endMiladi}`);
    const allTasks = await tasksRes.json();

    for (let i = 0; i < 7; i++) {
        const dayMoment = sat.clone().add(i, 'days');
        const dayName = DAYS_IR[i];
        const jalaliDate = toJalali(dayMoment);
        const miladiDate = dayMoment.format('YYYY-MM-DD');
        const isToday = dayMoment.isSame(moment(), 'day');

        // فیلتر کلاس‌های این روز
        const dayClasses = schedule.filter(s => s.day_of_week === dayName);
        
        // فیلتر تسک‌های این روز (تطبیق رشته تاریخ شمسی)
        // نکته: در دیتابیس تاریخ را به صورت رشته شمسی ذخیره کردیم
        // پس باید تاریخ میلادی لوپ را به شمسی تبدیل و مقایسه کنیم
        const dayTasks = allTasks.filter(t => t.due_date === jalaliDate);

        const col = document.createElement('div');
        col.className = `day-column ${isToday ? 'today' : ''}`;
        
        let classesHtml = dayClasses.map(c => `
            <div class="class-card" style="border-color: ${c.color}">
                <div class="class-time"><i class="ri-time-line"></i> ${c.start_time.substring(0,5)} - ${c.end_time.substring(0,5)}</div>
                <div class="class-subject">${c.subject_name}</div>
                <div class="class-teacher">
                    ${c.photo_url ? `<img src="${c.photo_url}" class="teacher-avatar">` : '<div class="teacher-avatar"></div>'}
                    <span class="teacher-name">${c.teacher_name}</span>
                </div>
                <button class="action-btn delete-btn" style="position:absolute;top:5px;left:5px;font-size:0.8rem" onclick="deleteClass(${c.id})">×</button>
            </div>
        `).join('');

        let tasksHtml = dayTasks.map(t => `
            <div class="task-card ${t.is_completed ? 'completed' : ''} priority-${t.priority}" onclick="toggleTask(${t.id})">
                <span class="task-type">${getIconForType(t.task_type)} ${t.task_type}</span>
                <div class="task-title">${t.title}</div>
                <div class="task-actions">
                    <button class="action-btn check-btn" onclick="event.stopPropagation(); toggleTask(${t.id})"><i class="ri-check-line"></i></button>
                    <button class="action-btn delete-btn" onclick="event.stopPropagation(); deleteTask(${t.id})"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>
        `).join('');

        col.innerHTML = `
            <div class="day-header">
                <span class="day-name">${dayName}</span>
                <span class="day-date">${jalaliDate}</span>
            </div>
            <div class="day-content">
                ${classesHtml}
                ${tasksHtml}
                <button class="btn-outline" style="margin-top:auto;font-size:0.8rem" onclick="openTaskModalForDate('${jalaliDate}')">+ افزودن تسک</button>
            </div>
        `;
        grid.appendChild(col);
    }
}

function getIconForType(type) {
    const icons = {
        'مرور': '🔄',
        'حل نمونه سوال': '✍️',
        'نوشتن جزوه': '📝',
        'مطالعه کتاب': '📖',
        'آزمون': '📋',
        'سایر': '📌'
    };
    return icons[type] || '•';
}

// ─── رویدادها (Events) ───
document.getElementById('prevWeek').onclick = () => { currentDate = moment(currentDate).subtract(7, 'days').toDate(); loadData(); };
document.getElementById('nextWeek').onclick = () => { currentDate = moment(currentDate).add(7, 'days').toDate(); loadData(); };
document.getElementById('todayBtn').onclick = () => { currentDate = new Date(); loadData(); };

// Modal Logic
window.openModal = (id) => document.getElementById(id).classList.add('active');
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = function() { this.closest('.modal').classList.remove('active'); };
});

// Forms Submission
document.getElementById('teacherForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await fetch('/api/teachers', { method: 'POST', body: formData });
    e.target.reset();
    document.getElementById('teacherModal').classList.remove('active');
    loadData();
};

document.getElementById('scheduleForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await fetch('/api/schedule', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data) 
    });
    e.target.reset();
    document.getElementById('classModal').classList.remove('active');
    loadData();
};

document.getElementById('taskForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        title: document.getElementById('taskTitle').value,
        task_type: document.getElementById('taskType').value,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDate').value, // فرمت شمسی
        description: document.getElementById('taskDesc').value
    };
    
    // اعتبارسنجی ساده فرمت تاریخ
    if(!data.due_date.includes('/')) { alert('لطفا تاریخ را به صورت 1403/01/01 وارد کنید'); return; }

    await fetch('/api/tasks', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data) 
    });
    e.target.reset();
    document.getElementById('taskModal').classList.remove('active');
    loadData();
};

// Actions
window.toggleTask = async (id) => {
    await fetch(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
    loadData();
};

window.deleteTask = async (id) => {
    if(confirm('حذف شود؟')) {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        loadData();
    }
};

window.deleteClass = async (id) => {
    if(confirm('این کلاس از برنامه حذف شود؟')) {
        await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
        loadData();
    }
};

window.openTaskModalForDate = (jalaliDate) => {
    document.getElementById('taskDate').value = jalaliDate;
    openModal('taskModal');
};

// شروع برنامه
loadData();
