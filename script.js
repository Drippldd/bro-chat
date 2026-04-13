const socket = io('https://bro-mesenger-drippldd.amvera.io');

let user = { name: "", phone: "", status: "На связи", avatar: null };
let posts = [];
let currentChat = "";
let allUsers = [];
let usersDB = JSON.parse(localStorage.getItem("bro_users")) || {};
let messagesDB = JSON.parse(localStorage.getItem("bro_messages")) || {};
let friendsDB = JSON.parse(localStorage.getItem(`bro_friends_${user.phone}`)) || [];

function saveMessages() {
    localStorage.setItem("bro_messages", JSON.stringify(messagesDB));
}

function getChatKey(phone1, phone2) {
    return [phone1, phone2].sort().join('_');
}

function loadPosts() {
    const saved = localStorage.getItem(`bro_posts_${user.phone}`);
    posts = saved ? JSON.parse(saved) : [];
}

function savePosts() {
    localStorage.setItem(`bro_posts_${user.phone}`, JSON.stringify(posts));
}

function saveFriends() {
    localStorage.setItem(`bro_friends_${user.phone}`, JSON.stringify(friendsDB));
}

const ADMIN_PHONE = "79874047434";
const EKLER_PHONE = "79172845323";
const SANYA_PHONE = "79269302016";

function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const isRu = /^(7|8)\d{10}$/.test(cleaned);
    const isBy = /^375\d{9}$/.test(cleaned);
    return { valid: isRu || isBy, cleaned: cleaned };
}

function ensureAdminInDB() {
    if (!usersDB[ADMIN_PHONE]) {
        usersDB[ADMIN_PHONE] = {
            phone: ADMIN_PHONE,
            name: "Админ",
            password: "",
            avatar: null,
            status: "Властелин БРО 👑"
        };
        localStorage.setItem("bro_users", JSON.stringify(usersDB));
    }
}

function ensureSanyaInDB() {
    if (!usersDB[SANYA_PHONE]) {
        usersDB[SANYA_PHONE] = {
            phone: SANYA_PHONE,
            name: "саня2016",
            password: "",
            avatar: null,
            status: "На связи"
        };
        localStorage.setItem("bro_users", JSON.stringify(usersDB));
    }
}

function login() {
    const ph = document.getElementById('reg-phone').value.trim();
    const validation = validatePhone(ph);
    
    if (!validation.valid) {
        alert("Введите номер РФ (+7) или РБ (+375)");
        return;
    }
    
    const phone = validation.cleaned;
    
    if (phone === ADMIN_PHONE) {
        if (usersDB[phone]) {
            user = usersDB[phone];
        } else {
            user = {
                phone: phone,
                name: "Админ",
                password: "",
                avatar: null,
                status: "Властелин БРО 👑"
            };
            usersDB[phone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
        }
        completeAuth();
        return;
    }
    
    if (phone === EKLER_PHONE) {
        if (usersDB[phone]) {
            user = usersDB[phone];
        } else {
            user = {
                phone: phone,
                name: "эклер",
                password: "",
                avatar: null,
                status: "Сладкая булочка 🥐"
            };
            usersDB[phone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
        }
        completeAuth();
        return;
    }
    
    if (phone === SANYA_PHONE) {
        if (usersDB[phone]) {
            user = usersDB[phone];
        } else {
            user = {
                phone: phone,
                name: "саня2016",
                password: "",
                avatar: null,
                status: "На связи"
            };
            usersDB[phone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
        }
        completeAuth();
        return;
    }
    
    if (usersDB[phone]) {
        const pass = prompt("Введите пароль:");
        if (usersDB[phone].password === pass) {
            user = usersDB[phone];
            completeAuth();
        } else {
            alert("Неверный пароль!");
        }
    } else {
        const pass = prompt("Придумайте пароль (мин 3 символа):");
        if (pass && pass.length >= 3) {
            user = {
                phone: phone,
                name: "Бро_" + phone.slice(-4),
                password: pass,
                avatar: null,
                status: "На связи"
            };
            usersDB[phone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
            completeAuth();
        } else {
            alert("Пароль минимум 3 символа!");
        }
    }
}

function completeAuth() {
    socket.emit('register_user', { name: user.name, phone: user.phone });
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    
    ensureAdminInDB();
    ensureSanyaInDB();
    
    friendsDB = JSON.parse(localStorage.getItem(`bro_friends_${user.phone}`)) || [];
    
    updateUI();
    loadPosts();
    renderAll();
    renderUsers();
    renderFriendsList();
    if (currentChat) loadChatHistory();
}

function renderFriendsList() {
    const container = document.getElementById('friends-list');
    if (!container) return;
    
    if (friendsDB.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">👋 Добавь друзей через поиск!</div>';
        return;
    }
    
    container.innerHTML = friendsDB.map(f => `
        <div class="user-item" onclick="openChatFromSearch('${f.name}')">
            <b>${f.name}</b>
            <small style="color:#00ff41; display:block;">${f.online ? 'В сети' : 'Был в сети'}</small>
        </div>
    `).join('');
}

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
        resultsContainer.innerHTML = found.map(u => {
            const isFriend = friendsDB.some(f => f.phone === u.phone);
            return `
                <div class="search-result-item">
                    <div class="search-result-name">${u.name}</div>
                    <div class="search-result-phone">📞 ${u.phone}</div>
                    <div style="margin-top: 8px;">
                        ${!isFriend ? 
                            `<button onclick="addFriend('${u.name}', '${u.phone}')" class="add-friend-btn" style="background:#00ff41; border:none; padding:5px 12px; border-radius:15px; cursor:pointer;">➕ Добавить в друзья</button>` : 
                            `<button onclick="openChatFromSearch('${u.name}')" class="chat-friend-btn" style="background:#00d4ff; border:none; padding:5px 12px; border-radius:15px; cursor:pointer;">💬 Написать</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }
    
    resultsContainer.classList.remove('hidden');
    usersList.classList.add('hidden');
}

function addFriend(name, phone) {
    if (!friendsDB.some(f => f.phone === phone)) {
        friendsDB.push({ name: name, phone: phone, online: false });
        saveFriends();
        renderFriendsList();
        alert(`✅ ${name} добавлен в друзья!`);
        searchUsers();
    } else {
        alert(`${name} уже в друзьях!`);
    }
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

function renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    if (friendsDB.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">👋 Добавь друзей через поиск!</div>';
        return;
    }
    
    container.innerHTML = friendsDB.map(f => `
        <div class="user-item" onclick="openChatFromSearch('${f.name}')">
            <b>${f.name}</b>
            <small style="color:#00ff41; display:block;">${f.online ? 'В сети' : 'Был в сети'}</small>
        </div>
    `).join('');
}

socket.on('update_user_list', (users) => {
    allUsers = users;
    friendsDB.forEach(f => {
        const onlineUser = users.find(u => u.phone === f.phone);
        f.online = !!onlineUser;
    });
    saveFriends();
    renderFriendsList();
    renderUsers();
});

function loadChatHistory() {
    if (!currentChat) return;
    const target = Object.values(usersDB).find(u => u.name === currentChat);
    if (!target) return;
    const chatKey = getChatKey(user.phone, target.phone);
    const messages = messagesDB[chatKey] || [];
    const container = document.getElementById('chat-messages');
    container.innerHTML = '<div class="message system">📱 Чат с ' + currentChat + '</div>';
    messages.forEach(msg => addMessageToUI(msg, msg.senderPhone === user.phone));
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

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !currentChat) return;
    
    const target = Object.values(usersDB).find(u => u.name === currentChat);
    if (!target) {
        console.log("❌ Получатель не найден:", currentChat);
        return;
    }
    
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
    
    socket.emit('send_msg', { 
        author: user.name, 
        target: currentChat, 
        text: text, 
        type: 'text' 
    });
    
    addMessageToUI(newMsg, true);
    input.value = "";
}

function sendChatMedia(event) {
    const file = event.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const target = Object.values(usersDB).find(u => u.name === currentChat);
    if (!target) return;
    const chatKey = getChatKey(user.phone, target.phone);
    if (!messagesDB[chatKey]) messagesDB[chatKey] = [];
    const newMsg = { senderPhone: user.phone, text: url, type: type, time: new Date().toLocaleTimeString() };
    messagesDB[chatKey].push(newMsg);
    saveMessages();
    socket.emit('send_msg', { author: user.name, target: currentChat, text: url, type: type });
    addMessageToUI(newMsg, true);
    event.target.value = "";
}

socket.on('receive_msg', (data) => {
    console.log("📩 Получено сообщение от", data.author, "для", data.target);
    const sender = Object.values(usersDB).find(u => u.name === data.author);
    if (!sender) return;
    const chatKey = getChatKey(user.phone, sender.phone);
    if (!messagesDB[chatKey]) messagesDB[chatKey] = [];
    const newMsg = { senderPhone: sender.phone, text: data.text, type: data.type, time: new Date().toLocaleTimeString() };
    messagesDB[chatKey].push(newMsg);
    saveMessages();
    if (currentChat === data.author) {
        addMessageToUI(newMsg, false);
    }
});

socket.on('user_offline', (data) => {
    console.log("⚠️ Пользователь", data.target, "не в сети");
});

function createPost() {
    const text = document.getElementById('post-text').value;
    const file = document.getElementById('post-media').files[0];
    if (!text && !file) return;
    const newPost = {
        id: Date.now(), author: user.name, text: text,
        media: file ? URL.createObjectURL(file) : null,
        mediaType: file ? (file.type.startsWith('video') ? 'video' : 'image') : null,
        likes: 0, likedBy: [], comments: [], repostedBy: [],
        time: new Date().toLocaleString()
    };
    posts.unshift(newPost);
    savePosts();
    renderAll();
    document.getElementById('post-text').value = "";
    document.getElementById('post-media').value = "";
}

function renderAll() { renderFeed(); renderWall(); renderReposts(); }

function renderFeed() {
    const container = document.getElementById('feed-posts');
    if (!container) return;
    if (posts.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🚀 Лента пуста</div>';
    else container.innerHTML = posts.map(p => postHTML(p)).join('');
}

function renderWall() {
    const container = document.getElementById('wall-posts');
    if (!container) return;
    const myPosts = posts.filter(p => p.author === user.name);
    if (myPosts.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">😎 Твоя стена пуста</div>';
    else container.innerHTML = myPosts.map(p => postHTML(p)).join('');
}

function renderReposts() {
    const container = document.getElementById('reposts-list');
    if (!container) return;
    const myReposts = posts.filter(p => p.repostedBy && p.repostedBy.includes(user.phone));
    if (myReposts.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🔄 Здесь будут твои репосты</div>';
    else container.innerHTML = myReposts.map(p => postHTML(p, true)).join('');
}

function postHTML(p, isRepost = false) {
    const isLiked = p.likedBy && p.likedBy.includes(user.phone);
    const isReposted = p.repostedBy && p.repostedBy.includes(user.phone);
    const mediaHTML = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" controls></video>` : `<img src="${p.media}">`) : '';
    return `
        <div class="post" id="post-${p.id}">
            <b style="color:#00ff41">@${p.author}</b> <small style="color:#666;"> ${p.time}</small>
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

function openDebt() {
    const amount = prompt("💸 Сколько этот Бро должен?");
    if (amount) {
        const target = Object.values(usersDB).find(u => u.name === currentChat);
        if (target) {
            const chatKey = getChatKey(user.phone, target.phone);
            if (!messagesDB[chatKey]) messagesDB[chatKey] = [];
            const newMsg = { senderPhone: user.phone, text: `💸 [КИДАЛОВО]: Долг ${amount} руб.`, type: 'text', time: new Date().toLocaleTimeString() };
            messagesDB[chatKey].push(newMsg);
            saveMessages();
            socket.emit('send_msg', { author: user.name, target: currentChat, text: `💸 [КИДАЛОВО]: Долг ${amount} руб.`, type: 'text' });
            addMessageToUI(newMsg, true);
        }
    }
}

let syncActive = false;
function toggleSync() {
    const btn = document.getElementById('joint-btn');
    syncActive = !syncActive;
    if (syncActive) {
        btn.classList.add('joint-active');
        addMessageToUI({ author: "СИСТЕМА", text: "🤝 Синхрон включён!", type: 'text' }, false);
    } else {
        btn.classList.remove('joint-active');
        addMessageToUI({ author: "СИСТЕМА", text: "⏹️ Синхрон выключен", type: 'text' }, false);
    }
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

function orderKFC() { window.open('https://apps.apple.com/app/id1074266177', '_blank'); }

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.side-menu li').forEach(li => li.classList.remove('active-li'));
    const map = { 'chats-window': 'li-chats', 'feed-window': 'li-feed', 'wall-window': 'li-wall', 'reposts-window': 'li-reposts', 'music-window': 'li-music' };
    if (map[tabId]) document.getElementById(map[tabId]).classList.add('active-li');
}

function previewMedia() { console.log('медиа выбрано'); }
