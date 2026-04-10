const socket = io('https://bro-mesenger-drippldd.amvera.io');

let user = { name: "Бро", phone: "", status: "Кайфую", avatar: null };
let posts = [];
let groups = [];
let currentChatType = "private";
let currentTargetChat = "";
let debtsDB = JSON.parse(localStorage.getItem("bro_debts")) || {};
let pendingUser = null;
let usersDB = JSON.parse(localStorage.getItem("bro_users_db")) || {};

// === ВАЛИДАЦИЯ НОМЕРА ===
function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const isRu = /^(7|8|9)\d{10}$/.test(cleaned);
    const isBy = /^375\d{9}$/.test(cleaned);
    return isRu || isBy;
}

function handlePhoneSubmit() {
    const ph = document.getElementById('reg-phone').value.trim();
    if (!validatePhone(ph)) {
        alert("Введите номер РФ (+7) или РБ (+375)");
        return;
    }
    pendingUser = { phone: ph.replace(/\D/g, '') };
    document.getElementById('step-phone').classList.add('hidden');
    document.getElementById('step-pass').classList.remove('hidden');
}

function handlePassSubmit() {
    const pass = document.getElementById('reg-pass').value;
    if (pass.length < 4) {
        alert("Пароль минимум 4 символа");
        return;
    }
    pendingUser.password = pass;
    document.getElementById('step-pass').classList.add('hidden');
    document.getElementById('step-code').classList.remove('hidden');
}

function verifyCode() {
    const code = document.getElementById('reg-code').value;
    if (code !== "1111") {
        alert("Неверный код!");
        return;
    }
    
    const phone = pendingUser.phone;
    const password = pendingUser.password;
    
    if (usersDB[phone] && usersDB[phone].password === password) {
        user = { ...usersDB[phone], phone: phone };
    } else if (!usersDB[phone]) {
        user = {
            id: Date.now().toString(),
            name: "Бро_" + phone.slice(-4),
            phone: phone,
            password: password,
            avatar: null,
            status: "Кайфую"
        };
        usersDB[phone] = user;
        localStorage.setItem("bro_users_db", JSON.stringify(usersDB));
    } else {
        alert("Неверный пароль!");
        return;
    }
    
    socket.emit('register_user', { name: user.name, phone: user.phone, id: user.id });
    
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    updateProfileUI();
    renderUserLists();
    renderAllFeeds();
}

// === ОБНОВЛЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ ===
socket.on('update_user_list', (users) => {
    renderUserListsFromServer(users);
});

function renderUserListsFromServer(usersList) {
    const othersBox = document.getElementById('users-list');
    if (!othersBox) return;
    
    const currentUsers = usersList.filter(u => u.name !== user.name);
    if (currentUsers.length === 0) {
        othersBox.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">🤷 Никого в сети</div>';
        return;
    }
    
    othersBox.innerHTML = currentUsers.map(u => `
        <div class="chat-item" onclick="openPrivateChat('${u.name}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <b>${u.name}</b>
                    <small style="color:#00ff41; display:block;">В сети</small>
                </div>
            </div>
        </div>
    `).join('');
}

function renderUserLists() {
    const othersBox = document.getElementById('users-list');
    if (othersBox) {
        othersBox.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">⏳ Загрузка...</div>';
    }
}

// === ЧАТЫ ===
function openPrivateChat(name) {
    currentChatType = "private";
    currentTargetChat = name;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-messages').innerHTML = '<div class="msg-bubble" style="background:#1a1a2a; text-align:center;">📱 Начало чата с ' + name + '</div>';
    showTab('private-chat');
    
    setTimeout(() => {
        const debtKey = `${user.phone}_${name}`;
        const debt = debtsDB[debtKey] || 0;
        if (debt > 0) {
            appendMsg('text', `📊 [КИДАЛОВО]: ${name} должен тебе ${debt} руб.`, false);
        }
    }, 300);
}

function sendPrivateMsg() {
    const input = document.getElementById('msg-input');
    const val = input.value.trim();
    if (!val) return;
    
    socket.emit('send_msg', {
        author: user.name,
        text: val,
        type: 'text',
        target: currentTargetChat
    });
    
    appendMsg('text', val, true);
    input.value = "";
}

function sendChatMedia(event) {
    const file = event.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    appendMsg(type, url, true);
    event.target.value = "";
}

function appendMsg(type, content, isOwn, senderName = "Бро") {
    const box = document.getElementById('chat-messages');
    let html = '';
    const isSystem = content.includes('[СИНХРОН]') || content.includes('[КИДАЛОВО]');
    
    if(type === 'text') html = `<p>${content}</p>`;
    else if(type === 'image') html = `<img src="${content}">`;
    else if(type === 'video') html = `<video src="${content}" controls></video>`;
    
    const bubble = `
        <div class="msg-bubble" style="
            align-self: ${isSystem ? 'center' : (isOwn ? 'flex-end' : 'flex-start')};
            background: ${isSystem ? 'rgba(0,212,255,0.1)' : (isOwn ? '#00ff41' : '#222')};
            color: ${isSystem ? '#00d4ff' : (isOwn ? '#000' : '#fff')};
            ${isSystem ? 'border: 1px solid #00d4ff; font-size: 11px; text-align: center;' : ''}
        ">
            ${!isOwn && !isSystem ? `<small style="display:block;color:#00ff41">${senderName}</small>` : ''}
            ${html}
        </div>
    `;
    box.innerHTML += bubble;
    box.scrollTop = box.scrollHeight;
}

socket.on('receive_msg', (data) => {
    if (currentTargetChat === data.target || currentTargetChat === data.author) {
        const isOwn = data.author === user.name;
        appendMsg(data.type, data.text, isOwn, data.author);
    }
});

// === КИДАЛОВО ===
function openDebt() {
    const amount = prompt("Сколько этот Бро задолжал?");
    if(amount) {
        appendMsg('text', `💸 [КИДАЛОВО]: Бро торчит мне ${amount} руб.`, true);
    }
}

function toggleJointPlaylist() {
    const btn = document.getElementById('joint-trigger');
    const active = btn.classList.toggle('joint-active');
    appendMsg('text', `🤝 [СИНХРОН]: Общий плейлист ${active ? 'ЗАПУЩЕН' : 'ОСТАНОВЛЕН'}!`, false);
}

// === ПОСТЫ ===
function postToWall() {
    const txt = document.getElementById('wall-text').value;
    if(!txt) return;
    const p = { id: Date.now(), author: user.name, text: txt, likes: 0, liked: false };
    posts.unshift(p);
    renderAllFeeds();
    document.getElementById('wall-text').value = "";
}

function renderAllFeeds() {
    const feedBox = document.getElementById('global-feed-posts');
    const wallBox = document.getElementById('my-wall-posts');
    const repostsBox = document.getElementById('my-reposts-list');
    
    if(feedBox) {
        feedBox.innerHTML = posts.map(p => `
            <div class="post">
                <b style="color:#00ff41">@${p.author}</b>
                <p style="margin:10px 0;">${p.text}</p>
                <div class="post-actions">
                    <span onclick="likePost(${p.id})" style="${p.liked ? 'color:#ff0055' : ''}">❤️ ${p.likes}</span>
                    <span onclick="repostPost(${p.id})">🔄 Репост</span>
                </div>
            </div>
        `).join('');
    }
    
    if(wallBox) {
        wallBox.innerHTML = posts.filter(p => p.author === user.name).map(p => `
            <div class="post">
                <p>${p.text}</p>
            </div>
        `).join('');
    }
}

function likePost(id) {
    const p = posts.find(x => x.id === id);
    if(p) {
        p.liked ? (p.likes--, p.liked=false) : (p.likes++, p.liked=true);
        renderAllFeeds();
    }
}

function repostPost(id) {
    alert("✅ Репост добавлен!");
}

// === МУЗЫКА ===
function saveMusicLink() {
    let link = document.getElementById('sc-link-input').value;
    if(link.includes("soundcloud.com")) {
        let clean = link.split('?')[0];
        document.getElementById('sc-player-container').innerHTML = `
            <iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" 
            src="https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&color=%23ff5500&auto_play=false&visual=true"></iframe>
        `;
    } else {
        alert("❌ Вставь ссылку на SoundCloud!");
    }
}

// === ПРОФИЛЬ ===
function updateProfileUI() {
    document.getElementById('user-name-display').innerText = user.name;
    document.getElementById('user-status-display').innerText = user.status;
}

function openEditProfile() {
    const n = prompt("Новый ник:", user.name);
    const s = prompt("Твой статус:", user.status);
    if(n && n.trim()) user.name = n.trim();
    if(s && s.trim()) user.status = s.trim();
    updateProfileUI();
}

function changeAvatar(event) {
    const file = event.target.files[0];
    if(file) {
        user.avatar = URL.createObjectURL(file);
        document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}">`;
    }
}

function orderKFC() {
    window.open('https://rostics.ru/menu', '_blank');
}

// === НАВИГАЦИЯ ===
function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.side-menu li').forEach(li => li.classList.remove('active-li'));
    
    const target = document.getElementById(tab + '-window');
    if(target) target.classList.remove('hidden');
    
    const li = document.getElementById('li-' + tab);
    if(li) li.classList.add('active-li');
    
    const titles = { 'chats': 'Чаты', 'feed': 'Рекомендации', 'wall': 'Моя Стена', 'reposts': 'Репосты', 'music-tab': 'Музыка' };
    document.getElementById('current-page-title').innerText = titles[tab] || 'БРО';
}
