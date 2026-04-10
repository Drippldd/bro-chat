const socket = io('https://bro-mesenger-drippldd.amvera.io');

let user = { name: "", phone: "", id: "" };
let currentTarget = "";
let allUsers = [];
let pendingUser = null; // для временного хранения при регистрации
let messages = {}; // { chatId: [{text, time, status}] }
let readReceipts = {};

// === БАЗА ПОЛЬЗОВАТЕЛЕЙ (хранится в localStorage) ===
let usersDB = JSON.parse(localStorage.getItem("bro_users_db")) || {};

// === ВАЛИДАЦИЯ НОМЕРА (РФ или РБ) ===
function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const isRu = /^(7|8|9)\d{10}$/.test(cleaned);
    const isBy = /^375\d{9}$/.test(cleaned);
    return isRu || isBy;
}

function formatPhone(phone) {
    return phone.replace(/\D/g, '');
}

// === ШАГ 1: ПРОВЕРКА НОМЕРА ===
function handlePhoneSubmit() {
    const ph = document.getElementById('reg-phone').value.trim();
    if (!validatePhone(ph)) {
        alert("Введите корректный номер РФ (+7) или РБ (+375)");
        return;
    }
    
    const formattedPhone = formatPhone(ph);
    pendingUser = { phone: formattedPhone };
    
    // Проверяем, есть ли пользователь в базе
    if (usersDB[formattedPhone]) {
        // Есть аккаунт — просим пароль
        document.getElementById('step-phone').classList.add('hidden');
        document.getElementById('step-pass').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "Вход в БРО";
    } else {
        // Новый пользователь — регистрация
        document.getElementById('step-phone').classList.add('hidden');
        document.getElementById('step-pass').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "Регистрация в БРО";
    }
}

// === ШАГ 2: ПАРОЛЬ / СОЗДАНИЕ АККАУНТА ===
function handlePassSubmit() {
    const pass = document.getElementById('reg-pass').value;
    if (pass.length < 4) {
        alert("Пароль должен быть минимум 4 символа");
        return;
    }
    
    pendingUser.password = pass;
    
    // Отправляем код (имитация)
    document.getElementById('step-pass').classList.add('hidden');
    document.getElementById('step-code').classList.remove('hidden');
    
    // Для демо кода всегда 1111
    console.log("🔐 Твой код подтверждения: 1111");
    alert("Код подтверждения: 1111 (для теста)");
}

// === ШАГ 3: ПОДТВЕРЖДЕНИЕ КОДА ===
function verifyCode() {
    const code = document.getElementById('reg-code').value;
    if (code !== "1111") {
        alert("Неверный код!");
        return;
    }
    
    const phone = pendingUser.phone;
    const password = pendingUser.password;
    
    // Если пользователь уже существует — вход
    if (usersDB[phone] && usersDB[phone].password === password) {
        user = { ...usersDB[phone], phone: phone };
    } 
    // Иначе регистрация нового
    else if (!usersDB[phone]) {
        user = {
            id: Date.now().toString(),
            name: "Бро_" + phone.slice(-4),
            phone: phone,
            password: password,
            avatar: null,
            status: "На связи"
        };
        usersDB[phone] = user;
        localStorage.setItem("bro_users_db", JSON.stringify(usersDB));
    } 
    else {
        alert("Неверный пароль!");
        return;
    }
    
    // Отправляем на сервер
    socket.emit('register_user', { name: user.name, phone: user.phone, id: user.id });
    
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('user-name-display').innerText = user.name;
    
    // Загружаем сообщения из localStorage
    loadMessages();
}

// === ЗАГРУЗКА СООБЩЕНИЙ ===
function loadMessages() {
    const saved = localStorage.getItem(`bro_messages_${user.phone}`);
    if (saved) messages = JSON.parse(saved);
}

function saveMessages() {
    localStorage.setItem(`bro_messages_${user.phone}`, JSON.stringify(messages));
}

// === ОБНОВЛЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ ===
socket.on('update_user_list', (users) => {
    allUsers = users;
    renderUsers(users);
});

function renderUsers(list) {
    const box = document.getElementById('users-list');
    const currentUsers = list.filter(u => u.name !== user.name);
    
    if (currentUsers.length === 0) {
        box.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">🤷 Никого в сети</div>';
        return;
    }
    
    box.innerHTML = currentUsers.map(u => `
        <div class="chat-item" onclick="openChat('${u.name}')">
            <b>${u.name}</b>
            <small style="color:#00ff41; display:block;">В сети</small>
        </div>
    `).join('');
}

function filterUsers() {
    const val = document.getElementById('user-search').value.toLowerCase();
    const filtered = allUsers.filter(u => u.name.toLowerCase().includes(val));
    renderUsers(filtered);
}

// === ОТКРЫТИЕ ЧАТА ===
function openChat(name) {
    currentTarget = name;
    document.getElementById('chat-with-name').innerText = name;
    renderChatMessages(name);
    showTab('private-chat');
    
    // Отмечаем сообщения как прочитанные
    const chatId = getChatId(name);
    if (messages[chatId]) {
        let hasUnread = false;
        messages[chatId].forEach(msg => {
            if (!msg.isOwn && !msg.isRead) {
                msg.isRead = true;
                hasUnread = true;
            }
        });
        if (hasUnread) {
            saveMessages();
            renderChatMessages(name);
            // Уведомляем отправителя о прочтении
            socket.emit('read_receipt', { chatId, reader: user.name });
        }
    }
}

function getChatId(targetName) {
    return [user.name, targetName].sort().join('_');
}

function renderChatMessages(targetName) {
    const box = document.getElementById('chat-messages');
    const chatId = getChatId(targetName);
    const msgs = messages[chatId] || [];
    
    if (msgs.length === 0) {
        box.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">💬 Напишите первое сообщение</div>';
        return;
    }
    
    box.innerHTML = msgs.map(msg => `
        <div class="msg-bubble" style="
            align-self: ${msg.isOwn ? 'flex-end' : 'flex-start'};
            background: ${msg.isOwn ? '#00ff41' : '#222'};
            color: ${msg.isOwn ? '#000' : '#fff'};
        ">
            ${msg.text}
            <div class="msg-info">
                <span>${msg.time}</span>
                ${msg.isOwn ? `<span class="status">${msg.isRead ? '✓✓' : '✓'}</span>` : ''}
            </div>
        </div>
    `).join('');
    
    box.scrollTop = box.scrollHeight;
}

// === ОТПРАВКА СООБЩЕНИЯ ===
function sendMsg() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !currentTarget) return;
    
    const chatId = getChatId(currentTarget);
    if (!messages[chatId]) messages[chatId] = [];
    
    const newMsg = {
        id: Date.now(),
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOwn: true,
        isRead: false
    };
    
    messages[chatId].push(newMsg);
    saveMessages();
    renderChatMessages(currentTarget);
    input.value = "";
    
    // Отправляем на сервер
    socket.emit('send_msg', {
        author: user.name,
        target: currentTarget,
        text: text,
        time: newMsg.time,
        msgId: newMsg.id
    });
}

// === ПРИЁМ СООБЩЕНИЙ ===
socket.on('receive_msg', (data) => {
    const chatId = getChatId(data.author);
    if (!messages[chatId]) messages[chatId] = [];
    
    const newMsg = {
        id: data.msgId,
        text: data.text,
        time: data.time,
        isOwn: false,
        isRead: false
    };
    
    messages[chatId].push(newMsg);
    saveMessages();
    
    if (currentTarget === data.author) {
        renderChatMessages(currentTarget);
        // Автоматически отмечаем как прочитанное
        setTimeout(() => {
            const lastMsg = messages[chatId].find(m => m.id === data.msgId);
            if (lastMsg) lastMsg.isRead = true;
            saveMessages();
            renderChatMessages(currentTarget);
            socket.emit('read_receipt', { chatId, reader: user.name, msgId: data.msgId });
        }, 500);
    }
});

// === ОТМЕТКА О ПРОЧТЕНИИ ===
socket.on('read_receipt_ack', (data) => {
    const chatId = getChatId(data.reader);
    if (messages[chatId]) {
        const msg = messages[chatId].find(m => m.id === data.msgId);
        if (msg && msg.isOwn) {
            msg.isRead = true;
            saveMessages();
            if (currentTarget === data.reader) {
                renderChatMessages(currentTarget);
            }
        }
    }
});

// === МУЗЫКА (ВСТРОЕННЫЙ ПЛЕЕР) ===
function playMusic() {
    const link = document.getElementById('sc-link').value;
    if (!link) {
        alert("Вставь ссылку на трек!");
        return;
    }
    
    // Создаём встроенный плеер БРО
    const player = document.getElementById('player-frame');
    player.innerHTML = `
        <div style="background: #111; padding: 15px; border-radius: 15px; border: 1px solid #00ff41;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="font-size: 40px;">🎵</div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; margin-bottom: 5px;">Сейчас играет:</div>
                    <div id="track-name" style="color: #00ff41; font-size: 14px;">${link.split('/').pop() || 'Трек'}</div>
                </div>
                <button onclick="stopMusic()" style="background: #ff0055; border: none; padding: 8px 15px; border-radius: 20px; color: #fff; cursor: pointer;">⏹️ Стоп</button>
            </div>
            <audio id="bro-audio" controls style="width: 100%; margin-top: 15px;">
                <source src="${getAudioUrl(link)}" type="audio/mpeg">
                Ваш браузер не поддерживает аудио
            </audio>
        </div>
    `;
    
    // Автоматически запускаем
    const audio = document.getElementById('bro-audio');
    if (audio) audio.play();
}

function getAudioUrl(link) {
    // Конвертируем SoundCloud ссылку в прямой поток (упрощённо)
    if (link.includes('soundcloud.com')) {
        return link;
    }
    return link;
}

function stopMusic() {
    const audio = document.getElementById('bro-audio');
    if (audio) audio.pause();
    document.getElementById('player-frame').innerHTML = '';
}

// === KFC ===
function orderKFC() {
    window.open('https://rostics.ru/menu', '_blank');
}

// === ПРОФИЛЬ ===
function updateProfileUI() {
    document.getElementById('user-name-display').innerText = user.name;
    document.getElementById('user-status-display').innerText = user.status || "На связи";
    if (user.avatar) {
        document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}">`;
    } else {
        document.getElementById('user-avatar').innerHTML = "👤";
    }
}

function openEditProfile() {
    const n = prompt("Новый ник:", user.name);
    const s = prompt("Твой статус:", user.status || "На связи");
    if (n && n.trim()) user.name = n.trim();
    if (s && s.trim()) user.status = s.trim();
    updateProfileUI();
    // Обновляем в базе
    usersDB[user.phone] = user;
    localStorage.setItem("bro_users_db", JSON.stringify(usersDB));
    socket.emit('update_user', { name: user.name, phone: user.phone });
}

function changeAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            user.avatar = e.target.result;
            document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}">`;
            usersDB[user.phone] = user;
            localStorage.setItem("bro_users_db", JSON.stringify(usersDB));
        };
        reader.readAsDataURL(file);
    }
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

// === ИНИЦИАЛИЗАЦИЯ КНОПОК ===
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const msgInput = document.getElementById('msg-input');
    
    if (sendBtn) sendBtn.addEventListener('click', sendMsg);
    if (msgInput) msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMsg();
    });
});

function finishAuth() {} // заглушка
function renderUserLists() {}
function renderAllFeeds() {}
function postToWall() {}
function likePost() {}
function repostPost() {}
function addComment() {}
function toggleComments() {}
function saveMusicLink() {}
function createNewGroup() {}
function openGroupChat() {}
function sendPrivateMsg() {}
function sendChatMedia() {}
function appendMsg() {}
function openDebt() {}
function toggleJointPlaylist() {}
