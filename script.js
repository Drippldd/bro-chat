const socket = io('https://bro-mesenger-drippldd.amvera.io');

let user = { name: "", phone: "" };
let currentTarget = "";
let allUsers = [];

// === ЛОГИКА ВХОДА ===
function handlePhoneSubmit() {
    const ph = document.getElementById('reg-phone').value.trim();
    // Проверка на РФ (+7/8) или РБ (+375)
    const isRu = /^(\+7|7|8)\d{10}$/.test(ph.replace(/\D/g, ''));
    const isBy = /^(\+375|375)\d{9}$/.test(ph.replace(/\D/g, ''));

    if (isRu || isBy) {
        user.phone = ph;
        document.getElementById('step-phone').classList.add('hidden');
        document.getElementById('step-pass').classList.remove('hidden');
    } else {
        alert("Введите номер РФ (+7) или РБ (+375)");
    }
}

function handlePassSubmit() {
    const pass = document.getElementById('reg-pass').value;
    if (pass.length < 4) return alert("Пароль слишком короткий");
    
    // Имитация отправки кода
    document.getElementById('step-pass').classList.add('hidden');
    document.getElementById('step-code').classList.remove('hidden');
    console.log("Твой код подтверждения: 1111"); // Для теста
}

function verifyCode() {
    const code = document.getElementById('reg-code').value;
    if (code === "1111") {
        user.name = "Бро_" + user.phone.slice(-4);
        socket.emit('register_user', { name: user.name, phone: user.phone });
        
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        document.getElementById('user-name-display').innerText = user.name;
    } else {
        alert("Неверный код!");
    }
}

// === РАБОТА С ПОЛЬЗОВАТЕЛЯМИ ===
socket.on('update_user_list', (users) => {
    allUsers = users;
    renderUsers(users);
});

function renderUsers(list) {
    const box = document.getElementById('users-list');
    box.innerHTML = list.filter(u => u.name !== user.name).map(u => `
        <div class="chat-item" onclick="openChat('${u.name}')">
            <b>${u.name}</b><br><small style="color:#00ff41">На связи</small>
        </div>
    `).join('');
}

function filterUsers() {
    const val = document.getElementById('user-search').value.toLowerCase();
    const filtered = allUsers.filter(u => u.name.toLowerCase().includes(val));
    renderUsers(filtered);
}

// === ЧАТ ===
function openChat(name) {
    currentTarget = name;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-messages').innerHTML = "";
    showTab('private-chat');
}

// Исправление для мобилок: слушаем и клик, и Enter
document.getElementById('send-btn').addEventListener('click', sendMsg);
document.getElementById('msg-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsg();
});

function sendMsg() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !currentTarget) return;

    const msg = {
        author: user.name,
        target: currentTarget,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit('send_msg', msg);
    appendMsg(msg, true);
    input.value = "";
}

socket.on('receive_msg', (data) => {
    if (currentTarget === data.author) {
        appendMsg(data, false);
    }
});

function appendMsg(data, isOwn) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg-bubble';
    div.style.alignSelf = isOwn ? 'flex-end' : 'flex-start';
    div.style.background = isOwn ? '#00ff41' : '#222';
    div.style.color = isOwn ? '#000' : '#fff';
    
    div.innerHTML = `
        ${data.text}
        <div class="msg-info">
            <span>${data.time}</span>
            ${isOwn ? '<span class="status">✓✓</span>' : ''}
        </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// === МУЗЫКА ВНУТРИ ===
function playMusic() {
    const link = document.getElementById('sc-link').value;
    if (!link.includes('soundcloud.com')) return alert("Нужна ссылка на SoundCloud");
    
    const embed = `
        <iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" 
        src="https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&color=%2300ff41&auto_play=true&visual=true"></iframe>
    `;
    document.getElementById('player-frame').innerHTML = embed;
}

// === НАВИГАЦИЯ ===
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tab + '-window').classList.remove('hidden');
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('active');
}
