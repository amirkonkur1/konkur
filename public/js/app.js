// تنظیمات اولیه
const DAYS_IR = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
let currentDate = new Date(); 
let teachers = [];

// ─── توابع کمکی تاریخ ───
function toJalali(date) {
    // اطمینان از اینکه moment وجود دارد
    if (typeof moment === 'undefined') return date;
    return moment(date).format('jYYYY/jMM/jDD');
}

function getSaturdayOfWeek(date) {
    if (typeof moment === 'undefined') return date;
    const m = moment(date);
    const day = m.isoWeekday(); 
    let diff = day >= 6 ? day - 6 : day + 1;
    return m.subtract(diff, 'days').startOf('day');
}

// ─── بارگذاری داده‌ها ───
async function loadData() {
    console.log("🔄 شروع بارگذاری اطلاعات...");
    renderHeader();
    
    try {
        await loadTeachers();
        await renderGrid();
        console.log("✅ بارگذاری کامل شد.");
    } catch (error) {
        console.error("❌ خطا در بارگذاری:", error);
        alert("خطا در ارتباط با سرور. لطفا کنسول مرورگر (F12) را چک کنید.");
    }
}

async function loadTeachers() {
    try {
        const res = await fetch('/api/teachers');
        if (!res.ok) throw new Error('خطا در دریافت اساتید');
        teachers = await res.json();
        
        const select = document.getElementById('teacherSelect');
        if(select) {
            select.innerHTML = '<option value="">انتخاب کنید...</option>';
            teachers.forEach(t => {
                select.innerHTML += `<option value="${t.id}">${t.name} (${t.subject_name})</option>`;
            });
        }
    } catch (e) {
        console.error("خطا در لود اساتید:", e);
        teachers = [];
    }
}

// ─── رندر کردن صفحه ───
function renderHeader() {
    const sat = getSaturdayOfWeek(currentDate);
    const fri = sat.clone().add(6, 'days');
    const label = document.getElementById('currentWeekLabel');
    if(label) {
        label.innerText = `${toJalali(sat)} تا ${toJalali(fri)}`;
    }
}

async function renderGrid() {
    const grid = document.getElementById('weeklyGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div style="text-align:center; padding:20px;">در حال بارگذاری...</div>';

    const sat = getSaturdayOfWeek(currentDate);
    
    try {
        // دریافت برنامه ثابت
        const scheduleRes = await fetch('/api/schedule');
        const schedule = await scheduleRes.json();

        // دریافت تسک‌ها
        const startMiladi = sat.format('YYYY-MM-DD');
        const endMiladi = sat.clone().add(6, 'days').format('YYYY-MM-DD');
        const tasksRes = await fetch(`/api/tasks?start=${startMiladi}&end=${endMiladi}`);
        const allTasks = await tasksRes.json();

        grid.innerHTML = ''; // پاک کردن پیام لودینگ

        for (let i = 0; i < 7; i++) {
            const dayMoment = sat.clone().add(i, 'days');
            const dayName = DAYS_IR[i];
            const jalaliDate = toJalali(dayMoment);
            const miladiDate = dayMoment.format('YYYY-MM-DD');
            const isToday = dayMoment.isSame(moment(), 'day');

            const dayClasses = schedule.filter(s => s.day_of_week === dayName);
            const dayTasks = allTasks.filter(t => t.due_date === jalaliDate);

            const col = document.createElement('div');
            col.className = `day-column ${isToday ? 'today' : ''}`;
            
            // ساخت HTML کلاس‌ها
            let classesHtml = dayClasses.map(c => `
                <div class="class-card" style="border-color: ${c.color || '#6366f1'}">
                    <div class="class-time"><i class="ri-time-line"></i> ${c.start_time.substring(0,5)} - ${c.end_time.substring(0,5)}</div>
                    <div class="class-subject">${c.subject_name}</div>
                    <div class="class-teacher">
                        ${c.photo_url ? `<img src="${c.photo_url}" class="teacher-avatar" onerror="this.style.display='none'">` : '<div class="teacher-avatar" style="background:#444"></div>'}
                        <span class="teacher-name">${c.teacher_name}</span>
                    </div>
                    <button class="action-btn delete-btn" onclick="deleteClass(${c.id})">×</button>
                </div>
            `).join('');

            // ساخت HTML تسک‌ها
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
                    <button class="add-task-btn" onclick="openTaskModalForDate('${jalaliDate}')">+ افزودن فعالیت</button>
                </div>
            `;
            grid.appendChild(col);
        }
    } catch (err) {
        grid.innerHTML = '<div style="color:red; text-align:center;">خطا در دریافت اطلاعات. لطفا صفحه را رفرش کنید.</div>';
        console.error(err);
    }
}

function getIconForType(type) {
    const icons = {
        'مرور': '🔄', 'حل نمونه سوال': '✍️', 'نوشتن جزوه': '📝',
        'مطالعه کتاب': '📖', 'آزمون': '📋', 'سایر': '📌'
    };
    return icons[type] || '•';
}

// ─── رویدادها ───
document.addEventListener('DOMContentLoaded', () => {
    // بررسی اینکه آیا moment لود شده است
    if (typeof moment === 'undefined') {
        alert("کتابخانه تاریخ لود نشده است. اتصال اینترنت را چک کنید.");
        return;
    }
    
    loadData();

    document.getElementById('prevWeek').onclick = () => { currentDate = moment(currentDate).subtract(7, 'days').toDate(); loadData(); };
    document.getElementById('nextWeek').onclick = () => { currentDate = moment(currentDate).add(7, 'days').toDate(); loadData(); };
    document.getElementById('todayBtn').onclick = () => { currentDate = new Date(); loadData(); };
});

// Modal Logic
window.openModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('active');
};

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = function() { this.closest('.modal-wrapper').classList.remove('active'); };
});

// بستن مودال با کلیک بیرون
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.onclick = function() { this.closest('.modal-wrapper').classList.remove('active'); };
});

// Forms
const teacherForm = document.getElementById('teacherForm');
if(teacherForm) {
    teacherForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            await fetch('/api/teachers', { method: 'POST', body: formData });
            e.target.reset();
            document.getElementById('teacherModal').classList.remove('active');
            loadData();
        } catch(err) { alert("خطا در ذخیره استاد"); }
    };
}

const scheduleForm = document.getElementById('scheduleForm');
if(scheduleForm) {
    scheduleForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await fetch('/api/schedule', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data) 
            });
            e.target.reset();
            document.getElementById('classModal').classList.remove('active');
            loadData();
        } catch(err) { alert("خطا در ذخیره کلاس"); }
    };
}

const taskForm = document.getElementById('taskForm');
if(taskForm) {
    taskForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            title: document.getElementById('taskTitle').value,
            task_type: document.querySelector('input[name="taskType"]:checked')?.value || 'سایر',
            priority: document.getElementById('taskPriority').value,
            due_date: document.getElementById('taskDate').value,
            description: ''
        };
        
        if(!data.due_date.includes('/')) { alert('فرمت تاریخ باید 1403/01/01 باشد'); return; }

        try {
            await fetch('/api/tasks', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data) 
            });
            e.target.reset();
            document.getElementById('taskModal').classList.remove('active');
            loadData();
        } catch(err) { alert("خطا در ذخیره تسک"); }
    };
}

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
    if(confirm('این کلاس حذف شود؟')) {
        await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
        loadData();
    }
};

window.openTaskModalForDate = (jalaliDate) => {
    const dateInput = document.getElementById('taskDate');
    if(dateInput) dateInput.value = jalaliDate;
    openModal('taskModal');
};
