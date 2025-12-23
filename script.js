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

// Form Submission
function handleSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Get form values
    const data = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        service: formData.get('service'),
        date: formData.get('date'),
        time: formData.get('time'),
        notes: formData.get('notes')
    };
    
    // Here you would normally send to a server
    // For now, just show success message
    console.log('Appointment request:', data);
    
    alert('✅ תודה! בקשת התור שלך נשלחה בהצלחה.\n\nנחזור אליך תוך 24 שעות לאישור התור.\n\nפרטי התור:\nשם: ' + data.firstName + ' ' + data.lastName + '\nתאריך: ' + data.date + '\nשעה: ' + data.time);
    
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
