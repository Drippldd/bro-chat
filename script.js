const socket = io('https://bro-mesenger-drippldd.amvera.io');

// === ДАННЫЕ ===
let user = { name: "", phone: "", status: "На связи", avatar: null };
let posts = [];
let currentChat = "";
let allUsers = [];
let usersDB = JSON.parse(localStorage.getItem("bro_users")) || {};

// === ЗАГРУЗКА ПОСТОВ ===
function loadPosts() {
    const saved = localStorage.getItem(`bro_posts_${user.phone}`);
    if (saved) posts = JSON.parse(saved);
    else posts = [];
}

function savePosts() {
    localStorage.setItem(`bro_posts_user.phone}`, JSON.stringify(posts));
}

// === РЕГИСТРАЦИЯ С ТЕЛЕФОНОМ И ПАРОЛЕМ ===
let tempPhone = "";
const ADMIN_PHONE = "79874047434";

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
            name: "Бро_" + tempPhone.slice(-4),
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
}

// === ОБНОВЛЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ ===
socket.on('update_user_list', (users) => {
    allUsers = users;
    renderUsers();
});

function renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;
    const online = allUsers.filter(u => u.name !== user.name);
    if (online.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🤷 Никого в сети</div>';
        return;
    }
    container.innerHTML = online.map(u => `
        <div class="user-item" onclick="openChat('${u.name}')">
            <b>${u.name}</b>
            <small style="color:#00ff41; display:block;">В сети</small>
        </div>
    `).join('');
}

// === ПОИСК ПОЛЬЗОВАТЕЛЕЙ ===
function searchUsers() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    const usersList = document.getElementById('users-list');
    
    if (query === "") {
        resultsContainer.classList.add('hidden');
        usersList.classList.remove('hidden');
        return;
    }
    
    const allRegisteredUsers = Object.values(usersDB);
    const found = allRegisteredUsers.filter(u => 
        u.phone.includes(query) || 
        u.name.toLowerCase().includes(query)
    ).filter(u => u.phone !== user.phone);
    
    if (found.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result-item" style="color:#555;">❌ Никого не найдено</div>';
        resultsContainer.classList.remove('hidden');
        usersList.classList.add('hidden');
        return;
    }
    
    resultsContainer.innerHTML = found.map(u => `
        <div class="search-result-item" onclick="openChatFromSearch('${u.name}')">
            <div class="search-result-name">${u.name}</div>
            <div class="search-result-phone">📞 ${u.phone}</div>
        </div>
    `).join('');
    
    resultsContainer.classList.remove('hidden');
    usersList.classList.add('hidden');
}

function openChatFromSearch(name) {
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('users-list').classList.remove('hidden');
    openChat(name);
}

// === ЧАТ ===
function openChat(name) {
    currentChat = name;
    document.getElementById('chat-name').innerText = name;
    document.getElementById('chat-messages').innerHTML = '<div class="message system">📱 Чат с ' + name + '</div>';
    showTab('chat-window');
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !currentChat) return;
    
    const msg = { author: user.name, target: currentChat, text: text, type: 'text' };
    socket.emit('send_msg', msg);
    addMessage(msg, true);
    input.value = "";
}

function sendChatMedia(event) {
    const file = event.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const msg = { author: user.name, target: currentChat, text: url, type: type };
    socket.emit('send_msg', msg);
    addMessage(msg, true);
}

function addMessage(data, isOwn) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'my' : 'other'}`;
    if (data.type === 'text') div.innerHTML = data.text;
    else if (data.type === 'image') div.innerHTML = `<img src="${data.text}" style="max-width:200px; border-radius:10px;">`;
    else if (data.type === 'video') div.innerHTML = `<video src="${data.text}" controls style="max-width:200px; border-radius:10px;"></video>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

socket.on('receive_msg', (data) => {
    if (currentChat === data.author) {
        addMessage(data, false);
    }
});

// === ПОСТЫ ===
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
    document.getElementById('post-media').value = "";
    
    socket.emit('wall_post', { author: user.name, postId: newPost.id });
}

function renderAll() {
    renderFeed();
    renderWall();
    renderReposts();
}

function renderFeed() {
    const container = document.getElementById('feed-posts');
    if (!container) return;
    if (posts.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🚀 Лента пуста</div>';
        return;
    }
    container.innerHTML = posts.map(p => postHTML(p)).join('');
}

function renderWall() {
    const container = document.getElementById('wall-posts');
    if (!container) return;
    const myPosts = posts.filter(p => p.author === user.name);
    if (myPosts.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">😎 Твоя стена пуста</div>';
        return;
    }
    container.innerHTML = myPosts.map(p => postHTML(p)).join('');
}

function renderReposts() {
    const container = document.getElementById('reposts-list');
    if (!container) return;
    const myReposts = posts.filter(p => p.repostedBy && p.repostedBy.includes(user.phone));
    if (myReposts.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🔄 Здесь будут твои репосты</div>';
        return;
    }
    container.innerHTML = myReposts.map(p => postHTML(p, true)).join('');
}

function postHTML(p, isRepost = false) {
    const isLiked = p.likedBy && p.likedBy.includes(user.phone);
    const isReposted = p.repostedBy && p.repostedBy.includes(user.phone);
    const mediaHTML = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" controls></video>` : `<img src="${p.media}">`) : '';
    
    return `
        <div class="post" id="post-${p.id}">
            <b style="color:#00ff41">@${p.author}</b>
            <small style="color:#666;"> ${p.time}</small>
            <p style="margin:10px 0;">${p.text}</p>
            ${mediaHTML}
            <div class="post-actions">
                <span class="${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})">❤️ ${p.likes}</span>
                <span onclick="toggleComments(${p.id})">💬 ${p.comments.length}</span>
                <span class="${isReposted ? 'liked' : ''}" onclick="repostPost(${p.id})">🔄 ${isRepost ? 'Репостнут' : 'Репост'}</span>
            </div>
            <div class="comments-section" id="comments-${p.id}" style="display:none;">
                ${p.comments.map(c => `<div class="comment"><strong>${c.author}:</strong> ${c.text}</div>`).join('')}
                <div class="comment-input">
                    <input type="text" id="comment-${p.id}" placeholder="Написать комментарий...">
                    <button onclick="addComment(${p.id})">→</button>
                </div>
            </div>
        </div>
    `;
}

function likePost(id) {
    const post = posts.find(p => p.id === id);
    if (post) {
        if (post.likedBy.includes(user.phone)) {
            post.likes--;
            post.likedBy = post.likedBy.filter(uid => uid !== user.phone);
        } else {
            post.likes++;
            post.likedBy.push(user.phone);
        }
        savePosts();
        renderAll();
    }
}

function repostPost(id) {
    const post = posts.find(p => p.id === id);
    if (post && !post.repostedBy.includes(user.phone)) {
        post.repostedBy.push(user.phone);
        savePosts();
        renderAll();
        alert("✅ Пост добавлен в репосты!");
    }
}

function toggleComments(id) {
    const div = document.getElementById(`comments-${id}`);
    if (div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

function addComment(id) {
    const input = document.getElementById(`comment-${id}`);
    const text = input.value.trim();
    if (text) {
        const post = posts.find(p => p.id === id);
        if (post) {
            post.comments.push({ author: user.name, text: text });
            savePosts();
            renderAll();
            input.value = "";
        }
    }
}

// === КИДАЛОВО ===
function openDebt() {
    const amount = prompt("💸 Сколько этот Бро должен?");
    if (amount) {
        const msg = { author: user.name, target: currentChat, text: `💸 [КИДАЛОВО]: Долг ${amount} руб.`, type: 'text' };
        socket.emit('send_msg', msg);
        addMessage(msg, true);
    }
}

// === СИНХРОН ===
let syncActive = false;
function toggleSync() {
    const btn = document.getElementById('joint-btn');
    syncActive = !syncActive;
    if (syncActive) {
        btn.classList.add('joint-active');
        addMessage({ author: "СИСТЕМА", text: "🤝 Синхрон включён!", type: 'text' }, false);
    } else {
        btn.classList.remove('joint-active');
        addMessage({ author: "СИСТЕМА", text: "⏹️ Синхрон выключен", type: 'text' }, false);
    }
}

// === МУЗЫКА ===
function playMusic() {
    const link = document.getElementById('music-link').value;
    if (link.includes('soundcloud.com')) {
        document.getElementById('music-player').innerHTML = `
            <iframe width="100%" height="200" frameborder="no" 
            src="https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&color=%23ff5500&auto_play=true"></iframe>
        `;
    } else {
        alert("Вставь ссылку на SoundCloud");
    }
}

// === ПРОФИЛЬ ===
function updateUI() {
    document.getElementById('user-name-display').innerText = user.name;
    document.getElementById('user-status-display').innerText = user.status;
    if (user.avatar) document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}">`;
}

function openEditProfile() {
    const n = prompt("Новый ник:", user.name);
    const s = prompt("Статус:", user.status);
    if (n) user.name = n;
    if (s) user.status = s;
    updateUI();
    usersDB[user.phone] = user;
    localStorage.setItem("bro_users", JSON.stringify(usersDB));
    socket.emit('update_user', { phone: user.phone, name: user.name });
}

function changeAvatar(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            user.avatar = ev.target.result;
            document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}">`;
            usersDB[user.phone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
        };
        reader.readAsDataURL(file);
    }
}

function orderKFC() { 
    window.open('https://rostics.ru/menu', '_blank'); 
}

// === НАВИГАЦИЯ ===
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.side-menu li').forEach(li => li.classList.remove('active-li'));
    const map = { 
        'chats-window': 'li-chats', 
        'feed-window': 'li-feed', 
        'wall-window': 'li-wall', 
        'reposts-window': 'li-reposts', 
        'music-window': 'li-music' 
    };
    const liId = map[tabId];
    if (liId) document.getElementById(liId).classList.add('active-li');
    
    const titles = { 
        'chats-window': 'Чаты', 
        'feed-window': 'Лента', 
        'wall-window': 'Моя Стена', 
        'reposts-window': 'Репосты', 
        'music-window': 'Музыка' 
    };
    document.getElementById('page-title').innerText = titles[tabId] || 'БРО';
}

function previewMedia() { 
    console.log('медиа выбрано'); 
}
