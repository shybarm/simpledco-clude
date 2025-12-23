// Mobile Menu Toggle
function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
}

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            const navLinks = document.getElementById('navLinks');
            navLinks.classList.remove('active');
        }
    });
});

// Chatbot Toggle
function toggleChat() {
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.classList.toggle('active');
}

// Send Chat Message
function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (message) {
        addMessage(message, 'user');
        input.value = '';

        // Simulate bot response
        setTimeout(() => {
            const response = getBotResponse(message);
            addMessage(response, 'bot');
        }, 1000);
    }
}

function handleChatKey(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function addMessage(text, type) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'user' ? 'user-message' : 'bot-message';
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function getBotResponse(message) {
    const lowerMessage = message.toLowerCase();

    // Appointment triggers
    if (lowerMessage.includes('תור') || lowerMessage.includes('קביעה') || lowerMessage.includes('לקבוع')) {
        return 'אשמח לעזור לך לקבוע תור! לחץ על כפתור "קביעת תור" למעלה או התקשר ל-03-123-4567';
    }

    // Services
    if (lowerMessage.includes('שירות') || lowerMessage.includes('מחיר') || lowerMessage.includes('עלות')) {
        return 'אנו מציעים: ייעוץ רפואי כללי, ביקורי בית, ניהול מחלות כרוניות, רפואה מונעת, וטיפול ילדים. למידע נוסף התקשר ל-03-123-4567.';
    }

    // Hours
    if (lowerMessage.includes('שעות') || lowerMessage.includes('פתוח') || lowerMessage.includes('זמינות')) {
        return 'שעות הפעילות: א׳-ה׳ 9:00-18:00, ו׳ 9:00-13:00. שבת סגור.';
    }

    // Location
    if (lowerMessage.includes('כתובת') || lowerMessage.includes('איפה') || lowerMessage.includes('מיקום')) {
        return 'המרפאה נמצאת ברחוב רוטשילד 123, תל אביב. תוכל לנווט ב-Waze או Google Maps מהאתר.';
    }

    // Insurance
    if (lowerMessage.includes('קופת חולים') || lowerMessage.includes('ביטוח') || lowerMessage.includes('כללית') || lowerMessage.includes('מכבי')) {
        return 'אנו עובדים עם כל קופות החולים: כללית, מכבי, מאוחדת ולאומית.';
    }

    // Home visits
    if (lowerMessage.includes('בית') || lowerMessage.includes('ביקור בבית')) {
        return 'כן! אנו מציעים ביקורי בית רפואיים באזור תל אביב. למידע נוסף התקשר ל-03-123-4567.';
    }

    // Emergency
    if (lowerMessage.includes('חירום') || lowerMessage.includes('דחוף')) {
        return 'במקרה חירום, נא להתקשר למוקד 101 או לפנות לחדר מיון. למצבים לא דחופים, התקשר ל-03-123-4567.';
    }

    // Default responses
    const defaultResponses = [
        'תודה על פנייתך! איך אוכל לעזור לך? תוכל לשאול אותי על שעות פעילות, שירותים, מחירים או לקבוע תור.',
        'אשמח לעזור! תוכל לקבוע תור בטלפון 03-123-4567 או דרך הטופס באתר.',
        'יש לך שאלה נוספת? אני כאן לעזור בנושאים כמו שירותים, מחירים, קופות חולים ועוד.'
    ];

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// ---- Appointment storage (simple back-office) ----
const APPOINTMENTS_STORAGE_KEY = 'appointments_v1';

function loadAppointments() {
    try {
        const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('Failed to load appointments from localStorage', e);
        return [];
    }
}

function saveAppointments(list) {
    try {
        localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        console.warn('Failed to save appointments to localStorage', e);
        return false;
    }
}

function addAppointment(appointment) {
    const list = loadAppointments();
    list.unshift(appointment); // newest first
    saveAppointments(list);
}

// Form Submission
function handleSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Get form values
    const data = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('apt_' + Date.now() + '_' + Math.random().toString(16).slice(2)),
        createdAt: new Date().toISOString(),
        status: 'new', // new | confirmed | cancelled
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        service: formData.get('service'),
        date: formData.get('date'),
        time: formData.get('time'),
        notes: formData.get('notes')
    };

    // Store locally for admin back office (same browser/device)
    addAppointment(data);

    // Operational telemetry (optional)
    console.log('Appointment request:', data);

    alert(
        '✅ תודה! בקשת התור שלך נשלחה בהצלחה.\n\n' +
        'נחזור אליך תוך 24 שעות לאישור התור.\n\n' +
        'פרטי התור:\n' +
        'שם: ' + data.firstName + ' ' + data.lastName + '\n' +
        'תאריך: ' + data.date + '\n' +
        'שעה: ' + data.time + '\n\n' +
        '🛠 לניהול בקשות (Back Office): /admin.html'
    );

    // Reset form
    form.reset();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Set minimum date for appointment (tomorrow)
document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.querySelector('input[name="date"]');
    if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const minDate = tomorrow.toISOString().split('T')[0];
        dateInput.setAttribute('min', minDate);
    }
});

// Add scroll effect to header
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
        header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    } else {
        header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    }
});
