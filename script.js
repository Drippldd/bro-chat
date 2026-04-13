const socket = io('https://bro-mesenger-drippldd.amvera.io');

// === ДАННЫЕ ===
let user = { name: "", phone: "", status: "На связи", avatar: null };
let posts = [];
let currentChat = "";
let allUsers = [];
let usersDB = JSON.parse(localStorage.getItem("bro_users")) || {};
let messagesDB = JSON.parse(localStorage.getItem("bro_messages")) || {};

// === СОХРАНЕНИЕ СООБЩЕНИЙ ===
function saveMessages() {
    localStorage.setItem("bro_messages", JSON.stringify(messagesDB));
}

function getChatKey(user1, user2) {
    return [user1, user2].sort().join('_');
}

// === ЗАГРУЗКА ПОСТОВ ===
function loadPosts() {
    const saved = localStorage.getItem(`bro_posts_${user.phone}`);
    if (saved) posts = JSON.parse(saved);
    else posts = [];
}

function savePosts() {
    localStorage.setItem(`bro_posts_${user.phone}`, JSON.stringify(posts));
}

// === РЕГИСТРАЦИЯ С ТЕЛЕФОНОМ И ПАРОЛЕМ ===
let tempPhone = "";
const ADMIN_PHONE = "79874047434";
const EKLER_PHONE = "79172845323"; 

function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const isRu = /^(7|8)\d{10}$/.test(cleaned);
    const isBy = /^375\d{9}$/.test(cleaned);
    return { valid: isRu || isBy, cleaned: cleaned };
}

function handlePhoneSubmit() {
    const ph = document.getElementById('reg-phone').value.trim();
    const validation = validatePhone(ph);
    
    if (!validation.valid) {
        alert("Введите номер РФ (+7) или РБ (+375)");
        return;
    }
    
    tempPhone = validation.cleaned;
    
    // === АДМИН — сразу пропускаем без пароля ===
    if (tempPhone === ADMIN_PHONE) {
        if (usersDB[tempPhone]) {
            user = usersDB[tempPhone];
        } else {
            user = {
                phone: tempPhone,
                name: "Админ",
                password: "",
                avatar: null,
                status: "Властелин БРО 👑"
            };
            usersDB[tempPhone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
        }
        completeAuth();
        return;
    }
    
    if (usersDB[tempPhone]) {
        document.getElementById('step-phone').classList.add('hidden');
        document.getElementById('step-pass').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "Вход в БРО";
    } else {
        document.getElementById('step-phone').classList.add('hidden');
        document.getElementById('step-pass').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "Регистрация в БРО";
    }
}

function handlePassSubmit() {
    // === АДМИН — если вдруг попал сюда, пропускаем ===
    if (tempPhone === ADMIN_PHONE) {
        completeAuth();
        return;
    }
    
    const pass = document.getElementById('reg-pass').value;
    if (pass.length < 3) {
        alert("Пароль минимум 3 символа");
        return;
    }
    
    if (usersDB[tempPhone]) {
        if (usersDB[tempPhone].password === pass) {
            user = usersDB[tempPhone];
            completeAuth();
        } else {
            alert("Неверный пароль!");
        }
    } else {
        user = {
            phone: tempPhone,
            name: (tempPhone === EKLER_PHONE ? "эклер" : "Бро_" + tempPhone.slice(-4)),
            password: pass,
            avatar: null,
            status: "На связи"
        };
        usersDB[tempPhone] = user;
        localStorage.setItem("bro_users", JSON.stringify(usersDB));
        completeAuth();
    }
}

function completeAuth() {
    socket.emit('register_user', { name: user.name, phone: user.phone });
    
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    
    updateUI();
    loadPosts();
    renderAll();
    renderUsers();
    loadChatHistory();
}

// === ЗАГРУЗКА ИСТОРИИ ЧАТОВ ===
function loadChatHistory() {
    if (!currentChat) return;
    const target = Object.values(usersDB).find(u => u.name === currentChat);
    if (!target) return;

    const chatKey = getChatKey(user.phone, target.phone);
    const messages = messagesDB[chatKey] || [];
    const container = document.getElementById('chat-messages');
    
    container.innerHTML = '<div class="message system">📱 Чат с ' + currentChat + '</div>';
    messages.forEach(msg => {
        addMessageToUI(msg, msg.senderPhone === user.phone);
    });
}

function addMessageToUI(data, isOwn) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'my' : 'other'}`;
    if (data.type === 'text') div.innerText = data.text;
    else if (data.type === 'image') div.innerHTML = `<img src="${data.text}" style="max-width:200px; border-radius:10px;">`;
    else if (data.type === 'video') div.innerHTML = `<video src="${data.text}" controls style="max-width:200px; border-radius:10px;"></video>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// === ОБНОВЛЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ ===
socket.on('update_user_list', (users) => {
    allUsers = users;
    renderUsers();
});

function renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;
    const online = allUsers.filter(u => u.phone !== user.phone);
    if (online.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🤷 Никого в сети. Используй поиск!</div>';
        return;
    }
    container.innerHTML = online.map(u => `
        <div class="user-item" onclick="openChatFromSearch('${u.name}')">
            <b>${u.name}</b>
            <small style="color:#00ff41; display:block;">В сети</small>
        </div>
    `).join('');
}

// === ПОИСК ПО ВСЕМ (И ОНЛАЙН И ОФЛАЙН) ===
function searchUsers() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    const usersList = document.getElementById('users-list');
    
    if (query === "") {
        resultsContainer.classList.add('hidden');
        usersList.classList.remove('hidden');
        return;
    }
    
    const allRegistered = Object.values(usersDB);
    const found = allRegistered.filter(u => 
        (u.phone.includes(query) || u.name.toLowerCase().includes(query)) && u.phone !== user.phone
    );
    
    if (found.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result-item" style="color:#555;">❌ Никто не найден</div>';
    } else {
        resultsContainer.innerHTML = found.map(u => `
            <div class="search-result-item" onclick="openChatFromSearch('${u.name}')">
                <div class="search-result-name">${u.name}</div>
                <div class="search-result-phone">📞 ${u.phone}</div>
            </div>
        `).join('');
    }
    
    resultsContainer.classList.remove('hidden');
    usersList.classList.add('hidden');
}

function openChatFromSearch(name) {
    currentChat = name;
    document.getElementById('chat-name').innerText = name;
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('users-list').classList.remove('hidden');
    
    loadChatHistory();
    showTab('chat-window');
}

// === ОТПРАВКА СООБЩЕНИЙ ===
function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !currentChat) return;
    
    const target = Object.values(usersDB).find(u => u.name === currentChat);
    if (!target) return;

    const chatKey = getChatKey(user.phone, target.phone);
    if (!messagesDB[chatKey]) messagesDB[chatKey] = [];
    
    const newMsg = {
        senderPhone: user.phone,
        text: text,
        type: 'text',
        time: new Date().toLocaleTimeString()
    };
    
    messagesDB[chatKey].push(newMsg);
    saveMessages();
    
    socket.emit('send_msg', { author: user.name, target: currentChat, text: text, type: 'text' });
    addMessageToUI(newMsg, true);
    input.value = "";
}

socket.on('receive_msg', (data) => {
    const sender = Object.values(usersDB).find(u => u.name === data.author);
    if (!sender) return;

    const chatKey = getChatKey(user.phone, sender.phone);
    if (!messagesDB[chatKey]) messagesDB[chatKey] = [];
    
    const newMsg = {
        senderPhone: sender.phone,
        text: data.text,
        type: data.type,
        time: new Date().toLocaleTimeString()
    };
    
    messagesDB[chatKey].push(newMsg);
    saveMessages();
    
    if (currentChat === data.author) {
        addMessageToUI(newMsg, false);
    }
});

// === ВСЁ ОСТАЛЬНОЕ ===
function createPost() {
    const text = document.getElementById('post-text').value;
    const file = document.getElementById('post-media').files[0];
    if (!text && !file) return;
    const newPost = {
        id: Date.now(),
        author: user.name,
        text: text,
        media: file ? URL.createObjectURL(file) : null,
        mediaType: file ? (file.type.startsWith('video') ? 'video' : 'image') : null,
        likes: 0,
        likedBy: [],
        comments: [],
        repostedBy: [],
        time: new Date().toLocaleString()
    };
    posts.unshift(newPost);
    savePosts();
    renderAll();
    document.getElementById('post-text').value = "";
}

function renderAll() { renderFeed(); renderWall(); renderReposts(); }
function renderFeed() {
    const container = document.getElementById('feed-posts');
    if (posts.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🚀 Лента пуста</div>';
    else container.innerHTML = posts.map(p => postHTML(p)).join('');
}
function renderWall() {
    const container = document.getElementById('wall-posts');
    const myPosts = posts.filter(p => p.author === user.name);
    if (myPosts.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">😎 Твоя стена пуста</div>';
    else container.innerHTML = myPosts.map(p => postHTML(p)).join('');
}
function renderReposts() {
    const container = document.getElementById('reposts-list');
    const myReposts = posts.filter(p => p.repostedBy && p.repostedBy.includes(user.phone));
    if (myReposts.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🔄 Здесь будут репосты</div>';
    else container.innerHTML = myReposts.map(p => postHTML(p, true)).join('');
}

function postHTML(p, isRepost = false) {
    const mediaHTML = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" controls></video>` : `<img src="${p.media}">`) : '';
    return `
        <div class="post">
            <b style="color:#00ff41">@${p.author}</b> <small style="color:#666;"> ${p.time}</small>
            <p style="margin:10px 0;">${p.text}</p>
            ${mediaHTML}
        </div>
    `;
}

function playMusic() {
    const link = document.getElementById('music-link').value;
    if (link.includes('soundcloud.com')) {
        document.getElementById('music-player').innerHTML = `<iframe width="100%" height="200" frameborder="no" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&color=%23ff5500&auto_play=true"></iframe>`;
    } else { alert("Вставь ссылку на SoundCloud"); }
}

function updateUI() {
    document.getElementById('user-name-display').innerText = user.name;
    document.getElementById('user-status-display').innerText = user.status;
    if (user.avatar) document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}">`;
}

function orderKFC() { window.open('https://apps.apple.com/app/id1074266177', '_blank'); }

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.side-menu li').forEach(li => li.classList.remove('active-li'));
    const map = { 'chats-window': 'li-chats', 'feed-window': 'li-feed', 'wall-window': 'li-wall', 'reposts-window': 'li-reposts', 'music-window': 'li-music' };
    if (map[tabId]) document.getElementById(map[tabId]).classList.add('active-li');
}
