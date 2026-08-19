// تنظیمات اولیه
const DAYS_IR = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
let currentDate = new Date(); // تاریخ جاری سیستم (میلادی) برای ناوبری
let teachers = [];

// ─── توابع کمکی تاریخ شمسی ───

// تبدیل هر تاریخی به فرمت رشته‌ای شمسی (مثال: 1403/08/12)
function toJalaliStr(dateInput) {
    if (!dateInput) return '';
    // اگر ورودی رشته بود (مثل 1403/01/01) آن را برمی‌گردانیم
    if (typeof dateInput === 'string' && dateInput.includes('/')) return dateInput;
    
    const m = moment(dateInput);
    if (!m.isValid()) return '';
    return m.format('jYYYY/jMM/jDD');
}

// پیدا کردن شنبه‌ی هفته‌ای که تاریخ داده شده در آن قرار دارد
function getStartOfWeek(dateInput) {
    const m = moment(dateInput);
    // دریافت روز هفته میلادی (0=Sun, 1=Mon, ..., 6=Sat)
    const day = m.day(); 
    
    // تبدیل به ایندکس ایرانی (0=Shanbe, 1=Yekshanbe, ..., 6=Jome)
    // Shanbe(6) -> 0, Yek(0)->1, Do(1)->2 ... Jom(5)->6
    let iranDayIndex = day === 6 ? 0 : day + 1;
    
    // کم کردن تعداد روزها برای رسیدن به شنبه
    return m.subtract(iranDayIndex, 'days').startOf('day');
}

// ─── بارگذاری داده‌ها ───
async function loadData() {
    console.log("🔄 بارگذاری اطلاعات...");
    renderHeader();
    
    try {
        await loadTeachers();
        await renderGrid();
    } catch (error) {
        console.error("❌ خطا:", error);
        document.getElementById('weeklyGrid').innerHTML = 
            '<div style="color:red; text-align:center; padding:20px;">خطا در ارتباط با سرور</div>';
    }
}

async function loadTeachers() {
    const res = await fetch('/api/teachers');
    teachers = await res.json();
    
    const select = document.getElementById('teacherSelect');
    if(select) {
        select.innerHTML = '<option value="">انتخاب استاد...</option>';
        teachers.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name} (${t.subject_name})</option>`;
        });
    }
}

// ─── رندر کردن صفحه ───
function renderHeader() {
    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = startOfWeek.clone().add(6, 'days');
    
    const label = document.getElementById('currentWeekLabel');
    if(label) {
        label.innerText = `${toJalaliStr(startOfWeek)} الی ${toJalaliStr(endOfWeek)}`;
    }
}

async function renderGrid() {
    const grid = document.getElementById('weeklyGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">در حال دریافت برنامه...</div>';

    const startOfWeek = getStartOfWeek(currentDate);
    
    // 1. دریافت کلاس‌های ثابت
    const scheduleRes = await fetch('/api/schedule');
    const schedule = await scheduleRes.json();

    // 2. دریافت تسک‌ها برای بازه زمانی این هفته
    // نکته مهم: ما بازه میلادی را به سرور می‌فرستیم، اما سرور تسک‌ها را بر اساس تاریخ شمسی ذخیره کرده است.
    // پس باید لیست تمام تسک‌ها را بگیریم و در کلاینت فیلتر کنیم (روش امن‌تر برای تاریخ شمسی)
    const tasksRes = await fetch('/api/tasks'); 
    const allTasks = await tasksRes.json();

    grid.innerHTML = ''; 

    for (let i = 0; i < 7; i++) {
        const currentDayMoment = startOfWeek.clone().add(i, 'days');
        const dayName = DAYS_IR[i];
        const jalaliDateStr = toJalaliStr(currentDayMoment); // مثلا 1403/08/12
        
        // آیا این روز، امروز است؟
        const isToday = moment().format('jYYYY/jMM/jDD') === jalaliDateStr;

        // فیلتر کلاس‌های این روز (بر اساس نام روز)
        const dayClasses = schedule.filter(s => s.day_of_week === dayName);
        
        // فیلتر تسک‌های این روز (بر اساس تاریخ شمسی)
        const dayTasks = allTasks.filter(t => t.due_date === jalaliDateStr);

        const col = document.createElement('div');
        col.className = `day-column ${isToday ? 'today' : ''}`;
        
        // HTML کلاس‌ها
        let classesHtml = dayClasses.map(c => `
            <div class="class-card" style="border-right-color: ${c.color || '#6366f1'}">
                <div class="class-time"><i class="ri-time-line"></i> ${c.start_time.substring(0,5)} - ${c.end_time.substring(0,5)}</div>
                <div class="class-subject">${c.subject_name}</div>
                <div class="class-teacher">
                    ${c.photo_url ? `<img src="${c.photo_url}" class="teacher-avatar">` : '<div class="teacher-avatar"></div>'}
                    <span class="teacher-name">${c.teacher_name}</span>
                </div>
                <button class="action-btn delete-btn" onclick="deleteClass(${c.id})">×</button>
            </div>
        `).join('');

        // HTML تسک‌ها
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
                <span class="day-date">${jalaliDateStr}</span>
            </div>
            <div class="day-content">
                ${classesHtml}
                ${tasksHtml}
                <button class="add-task-btn" onclick="openTaskModalForDate('${jalaliDateStr}')">+ افزودن فعالیت</button>
            </div>
        `;
        grid.appendChild(col);
    }
}

function getIconForType(type) {
    const icons = {
        'مرور': '🔄', 'حل نمونه سوال': '✍️', 'نوشتن جزوه': '📝',
        'مطالعه کتاب': '📖', 'آزمون': '📋', 'سایر': '📌'
    };
    return icons[type] || '•';
}

// ─── رویدادهای دکمه‌ها ───
document.addEventListener('DOMContentLoaded', () => {
    if (typeof moment === 'undefined') {
        alert("خطا: کتابخانه تاریخ لود نشد. اینترنت را چک کنید.");
        return;
    }
    loadData();

    document.getElementById('prevWeek').onclick = () => { 
        currentDate = moment(currentDate).subtract(7, 'days').toDate(); 
        loadData(); 
    };
    
    document.getElementById('nextWeek').onclick = () => { 
        currentDate = moment(currentDate).add(7, 'days').toDate(); 
        loadData(); 
    };
    
    document.getElementById('todayBtn').onclick = () => { 
        currentDate = new Date(); 
        loadData(); 
    };
});

// Modal Logic
window.openModal = (id) => document.getElementById(id).classList.add('active');
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = function() { this.closest('.modal-wrapper').classList.remove('active'); };
});
document.querySelectorAll('.modal-backdrop').forEach(b => {
    b.onclick = function() { this.closest('.modal-wrapper').classList.remove('active'); };
});

// Form Submissions
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
        task_type: document.querySelector('input[name="taskType"]:checked')?.value || 'سایر',
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDate').value, // تاریخ شمسی وارد شده توسط کاربر
        description: ''
    };
    
    // اعتبارسنجی ساده
    if(!data.due_date || !data.due_date.includes('/')) {
        alert('لطفا تاریخ را به صورت صحیح وارد کنید (مثال: 1403/08/12)');
        return;
    }

    await fetch('/api/tasks', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data) 
    });
    e.target.reset();
    document.getElementById('taskModal').classList.remove('active');
    loadData();
};

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
    if(confirm('حذف شود؟')) {
        await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
        loadData();
    }
};

window.openTaskModalForDate = (jalaliDate) => {
    document.getElementById('taskDate').value = jalaliDate;
    openModal('taskModal');
};
