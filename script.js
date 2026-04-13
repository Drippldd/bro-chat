const socket = io('https://bro-mesenger-drippldd.amvera.io');

let user = { name: "", phone: "", status: "На связи", avatar: null };
let posts = [];
let currentChat = "";
let allUsers = [];
let usersDB = JSON.parse(localStorage.getItem("bro_users")) || {};
let messagesDB = JSON.parse(localStorage.getItem("bro_messages")) || {};
let friendsDB = JSON.parse(localStorage.getItem(`bro_friends_${user.phone}`)) || [];
let friendRequestsDB = JSON.parse(localStorage.getItem(`bro_requests_${user.phone}`)) || [];

function saveMessages() { localStorage.setItem("bro_messages", JSON.stringify(messagesDB)); }
function getChatKey(phone1, phone2) { return [phone1, phone2].sort().join('_'); }
function loadPosts() { posts = JSON.parse(localStorage.getItem(`bro_posts_${user.phone}`)) || []; }
function savePosts() { localStorage.setItem(`bro_posts_${user.phone}`, JSON.stringify(posts)); }
function saveFriends() { localStorage.setItem(`bro_friends_${user.phone}`, JSON.stringify(friendsDB)); }
function saveRequests() { localStorage.setItem(`bro_requests_${user.phone}`, JSON.stringify(friendRequestsDB)); }

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
        usersDB[ADMIN_PHONE] = { phone: ADMIN_PHONE, name: "Админ", password: "", avatar: null, status: "Властелин БРО 👑" };
        localStorage.setItem("bro_users", JSON.stringify(usersDB));
    }
}
function ensureSanyaInDB() {
    if (!usersDB[SANYA_PHONE]) {
        usersDB[SANYA_PHONE] = { phone: SANYA_PHONE, name: "саня2016", password: "", avatar: null, status: "На связи" };
        localStorage.setItem("bro_users", JSON.stringify(usersDB));
    }
}

function login() {
    const ph = document.getElementById('reg-phone').value.trim();
    const validation = validatePhone(ph);
    if (!validation.valid) { alert("Введите номер РФ (+7) или РБ (+375)"); return; }
    const phone = validation.cleaned;
    
    if (phone === ADMIN_PHONE || phone === EKLER_PHONE || phone === SANYA_PHONE) {
        let name = phone === ADMIN_PHONE ? "Админ" : (phone === EKLER_PHONE ? "эклер" : "саня2016");
        let status = phone === ADMIN_PHONE ? "Властелин БРО 👑" : "На связи";
        if (usersDB[phone]) user = usersDB[phone];
        else {
            user = { phone, name, password: "", avatar: null, status };
            usersDB[phone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
        }
        completeAuth();
        return;
    }
    
    if (usersDB[phone]) {
        const pass = prompt("Введите пароль:");
        if (usersDB[phone].password === pass) { user = usersDB[phone]; completeAuth(); }
        else alert("Неверный пароль!");
    } else {
        const pass = prompt("Придумайте пароль (мин 3 символа):");
        if (pass && pass.length >= 3) {
            user = { phone, name: "Бро_" + phone.slice(-4), password: pass, avatar: null, status: "На связи" };
            usersDB[phone] = user;
            localStorage.setItem("bro_users", JSON.stringify(usersDB));
            completeAuth();
        } else alert("Пароль минимум 3 символа!");
    }
}

function completeAuth() {
    socket.emit('register_user', { name: user.name, phone: user.phone });
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    ensureAdminInDB(); ensureSanyaInDB();
    friendsDB = JSON.parse(localStorage.getItem(`bro_friends_${user.phone}`)) || [];
    friendRequestsDB = JSON.parse(localStorage.getItem(`bro_requests_${user.phone}`)) || [];
    updateUI();
    loadPosts();
    renderAll();
    renderUsers();
    renderFriendsList();
    renderFriendRequests();
    updateProfileStats();
    if (currentChat) loadChatHistory();
}

function updateProfileStats() {
    document.getElementById('stat-posts').innerText = posts.filter(p => p.author === user.name).length;
    document.getElementById('stat-friends').innerText = friendsDB.length;
    document.getElementById('stat-reposts').innerText = posts.filter(p => p.repostedBy && p.repostedBy.includes(user.phone)).length;
}

function renderFriendRequests() {
    const container = document.getElementById('friend-requests-list');
    if (!container) return;
    if (friendRequestsDB.length === 0) {
        container.innerHTML = '<div style="color:#555; padding:10px;">😴 Нет входящих заявок</div>';
        return;
    }
    container.innerHTML = friendRequestsDB.map(req => `
        <div class="request-item">
            <span><b>${req.from}</b> хочет добавить в друзья</span>
            <div>
                <button class="accept-btn" onclick="acceptFriend('${req.from}')">✅ Принять</button>
                <button class="decline-btn" onclick="declineFriend('${req.from}')">❌ Отклонить</button>
            </div>
        </div>
    `).join('');
}

function sendFriendRequest(name) {
    const target = Object.values(usersDB).find(u => u.name === name);
    if (!target) { alert("Пользователь не найден"); return; }
    if (friendsDB.some(f => f.name === name)) { alert("Уже в друзьях!"); return; }
    if (friendRequestsDB.some(r => r.from === user.name && r.to === name)) { alert("Заявка уже отправлена!"); return; }
    
    const request = { from: user.name, to: name };
    friendRequestsDB.push(request);
    saveRequests();
    renderFriendRequests();
    socket.emit('friend_request', request);
    alert(`Заявка отправлена ${name}`);
}

socket.on('friend_request_received', (data) => {
    if (data.to === user.name) {
        if (!friendRequestsDB.some(r => r.from === data.from)) {
            friendRequestsDB.push({ from: data.from, to: data.to });
            saveRequests();
            renderFriendRequests();
        }
    }
});

function acceptFriend(name) {
    const fromUser = Object.values(usersDB).find(u => u.name === name);
    if (fromUser && !friendsDB.some(f => f.name === name)) {
        friendsDB.push({ name: name, phone: fromUser.phone, online: false });
        saveFriends();
        friendRequestsDB = friendRequestsDB.filter(r => !(r.from === name && r.to === user.name));
        saveRequests();
        renderFriendsList();
        renderFriendRequests();
        renderUsers();
        updateProfileStats();
        alert(`✅ ${name} теперь твой друг!`);
    }
}

function declineFriend(name) {
    friendRequestsDB = friendRequestsDB.filter(r => !(r.from === name && r.to === user.name));
    saveRequests();
    renderFriendRequests();
}

function removeFriend(name) {
    friendsDB = friendsDB.filter(f => f.name !== name);
    saveFriends();
    renderFriendsList();
    renderUsers();
    updateProfileStats();
}

function renderFriendsList() {
    const container = document.getElementById('friends-list');
    if (!container) return;
    if (friendsDB.length === 0) {
        container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">👋 Добавь друзей через поиск!</div>';
        return;
    }
    container.innerHTML = friendsDB.map(f => `
        <div class="friend-item" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="friend-avatar" style="width:45px;height:45px;background:#222;border-radius:50%;display:flex;align-items:center;justify-content:center;">${f.name[0]}</div>
                <div><div class="friend-name">${f.name}</div><div class="friend-status">${f.online ? '🟢 В сети' : '⚫ Оффлайн'}</div></div>
            </div>
            <button onclick="removeFriend('${f.name}')" style="background:#ff0055; color:#fff; border:none; padding:5px 12px; border-radius:15px;">❌</button>
        </div>
    `).join('');
}

function searchFriends() {
    const query = document.getElementById('friends-search').value.toLowerCase();
    const filtered = friendsDB.filter(f => f.name.toLowerCase().includes(query));
    const container = document.getElementById('friends-list');
    if (filtered.length === 0) container.innerHTML = '<div style="color:#555; padding:20px;">👋 Ничего не найдено</div>';
    else container.innerHTML = filtered.map(f => `...`).join('');
}

function renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;
    const online = allUsers.filter(u => u.phone !== user.phone);
    if (online.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">🤷 Никого в сети</div>';
    else container.innerHTML = online.map(u => `
        <div class="user-item" onclick="openChatFromSearch('${u.name}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><b>${u.name}</b><small style="color:#00ff41; display:block;">В сети</small></div>
                ${!friendsDB.some(f => f.name === u.name) ? 
                    `<button onclick="event.stopPropagation(); sendFriendRequest('${u.name}')" style="background:#00ff41; border:none; padding:5px 12px; border-radius:15px;">➕</button>` : 
                    '<span style="color:#00ff41;">✓</span>'}
            </div>
        </div>
    `).join('');
}

function searchUsers() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    const allRegistered = Object.values(usersDB);
    const found = allRegistered.filter(u => (u.phone.includes(query) || u.name.toLowerCase().includes(query)) && u.phone !== user.phone);
    if (query === "") { resultsContainer.classList.add('hidden'); return; }
    if (found.length === 0) resultsContainer.innerHTML = '<div class="search-result-item" style="color:#555;">❌ Никто не найден</div>';
    else resultsContainer.innerHTML = found.map(u => `
        <div class="search-result-item" onclick="openChatFromSearch('${u.name}')">
            <div class="search-result-name">${u.name}</div>
            <div class="search-result-phone">📞 ${u.phone}</div>
            ${!friendsDB.some(f => f.name === u.name) ? 
                `<button onclick="event.stopPropagation(); sendFriendRequest('${u.name}')" style="margin-top:5px; background:#00ff41; border:none; padding:3px 10px; border-radius:10px;">➕ Добавить</button>` : 
                '<span style="color:#00ff41;">✓ В друзьях</span>'}
        </div>
    `).join('');
    resultsContainer.classList.remove('hidden');
}

function openChatFromSearch(name) {
    currentChat = name;
    document.getElementById('chat-name').innerText = name;
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').classList.add('hidden');
    loadChatHistory();
    showTab('chat-window');
}

socket.on('update_user_list', (users) => {
    allUsers = users;
    friendsDB.forEach(f => { const onlineUser = users.find(u => u.phone === f.phone); f.online = !!onlineUser; });
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
    if (!target) return;
    const chatKey = getChatKey(user.phone, target.phone);
    if (!messagesDB[chatKey]) messagesDB[chatKey] = [];
    const newMsg = { senderPhone: user.phone, text, type: 'text', time: new Date().toLocaleTimeString() };
    messagesDB[chatKey].push(newMsg);
    saveMessages();
    socket.emit('send_msg', { author: user.name, target: currentChat, text, type: 'text' });
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
    const newMsg = { senderPhone: user.phone, text: url, type, time: new Date().toLocaleTimeString() };
    messagesDB[chatKey].push(newMsg);
    saveMessages();
    socket.emit('send_msg', { author: user.name, target: currentChat, text: url, type });
    addMessageToUI(newMsg, true);
    event.target.value = "";
}

socket.on('receive_msg', (data) => {
    const sender = Object.values(usersDB).find(u => u.name === data.author);
    if (!sender) return;
    const chatKey = getChatKey(user.phone, sender.phone);
    if (!messagesDB[chatKey]) messagesDB[chatKey] = [];
    const newMsg = { senderPhone: sender.phone, text: data.text, type: data.type, time: new Date().toLocaleTimeString() };
    messagesDB[chatKey].push(newMsg);
    saveMessages();
    if (currentChat === data.author) addMessageToUI(newMsg, false);
});

function createPost() {
    const text = document.getElementById('post-text').value;
    const file = document.getElementById('post-media').files[0];
    if (!text && !file) return;
    const newPost = {
        id: Date.now(), author: user.name, text,
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
    updateProfileStats();
}

function renderAll() { renderFeed(); renderWall(); renderReposts(); updateProfileStats(); }

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
    return `<div class="post"><b style="color:#00ff41">@${p.author}</b> <small style="color:#666;">${p.time}</small><p>${p.text}</p>${mediaHTML}<div class="post-actions"><span class="${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})">❤️ ${p.likes}</span><span onclick="toggleComments(${p.id})">💬 ${p.comments.length}</span><span onclick="repostPost(${p.id})">🔄 ${isRepost ? 'Репостнут' : 'Репост'}</span></div><div class="comments-section" id="comments-${p.id}" style="display:none;">${p.comments.map(c => `<div class="comment"><strong>${c.author}:</strong> ${c.text}</div>`).join('')}<div class="comment-input"><input type="text" id="comment-${p.id}" placeholder="Коммент..."><button onclick="addComment(${p.id})">→</button></div></div></div>`;
}

function likePost(id) { const post = posts.find(p => p.id === id); if (post) { if (post.likedBy.includes(user.phone)) { post.likes--; post.likedBy = post.likedBy.filter(uid => uid !== user.phone); } else { post.likes++; post.likedBy.push(user.phone); } savePosts(); renderAll(); } }
function repostPost(id) { const post = posts.find(p => p.id === id); if (post && !post.repostedBy.includes(user.phone)) { post.repostedBy.push(user.phone); savePosts(); renderAll(); alert("✅ Пост добавлен в репосты!"); } }
function toggleComments(id) { const div = document.getElementById(`comments-${id}`); if (div) div.style.display = div.style.display === 'none' ? 'block' : 'none'; }
function addComment(id) { const input = document.getElementById(`comment-${id}`); const text = input.value.trim(); if (text) { const post = posts.find(p => p.id === id); if (post) { post.comments.push({ author: user.name, text }); savePosts(); renderAll(); input.value = ""; } } }

function openDebt() { const amount = prompt("💸 Сколько этот Бро должен?"); if (amount) { const target = Object.values(usersDB).find(u => u.name === currentChat); if (target) { const chatKey = getChatKey(user.phone, target.phone); if (!messagesDB[chatKey]) messagesDB[chatKey] = []; const newMsg = { senderPhone: user.phone, text: `💸 [КИДАЛОВО]: Долг ${amount} руб.`, type: 'text', time: new Date().toLocaleTimeString() }; messagesDB[chatKey].push(newMsg); saveMessages(); socket.emit('send_msg', { author: user.name, target: currentChat, text: `💸 [КИДАЛОВО]: Долг ${amount} руб.`, type: 'text' }); addMessageToUI(newMsg, true); } } }

let syncActive = false;
function toggleSync() { const btn = document.getElementById('joint-btn'); syncActive = !syncActive; if (syncActive) { btn.classList.add('joint-active'); addMessageToUI({ author: "СИСТЕМА", text: "🤝 Синхрон включён!", type: 'text' }, false); } else { btn.classList.remove('joint-active'); addMessageToUI({ author: "СИСТЕМА", text: "⏹️ Синхрон выключен", type: 'text' }, false); } }

function playMusic() { const link = document.getElementById('music-link').value; if (link.includes('soundcloud.com')) { document.getElementById('music-player').innerHTML = `<iframe width="100%" height="200" frameborder="no" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&color=%23ff5500&auto_play=true"></iframe>`; } else alert("Вставь ссылку на SoundCloud"); }

function updateUI() {
    document.getElementById('user-name-display').innerText = user.name;
    document.getElementById('user-status-display').innerText = user.status;
    document.getElementById('profile-name').innerText = user.name;
    document.getElementById('profile-status').innerText = user.status;
    const avatarHtml = user.avatar ? `<img src="${user.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : "👤";
    document.getElementById('profile-avatar').innerHTML = avatarHtml;
    document.getElementById('user-avatar').innerHTML = avatarHtml;
}

function openEditProfile() { const n = prompt("Новый ник:", user.name); const s = prompt("Статус:", user.status); if (n) user.name = n; if (s) user.status = s; updateUI(); usersDB[user.phone] = user; localStorage.setItem("bro_users", JSON.stringify(usersDB)); socket.emit('update_user', { phone: user.phone, name: user.name }); renderAll(); }

function changeAvatar(e) { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { user.avatar = ev.target.result; updateUI(); usersDB[user.phone] = user; localStorage.setItem("bro_users", JSON.stringify(usersDB)); }; reader.readAsDataURL(file); } }

function orderKFC() { window.open('https://apps.apple.com/app/id1074266177', '_blank'); }

function logout() { if (confirm("Точно выйти, Бро?")) { localStorage.clear(); location.reload(); } }

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.side-menu li').forEach(li => li.classList.remove('active-li'));
    const map = { 'chats-window': 'li-chats', 'friends-window': 'li-friends', 'feed-window': 'li-feed', 'music-window': 'li-music' };
    if (map[tabId]) document.getElementById(map[tabId]).classList.add('active-li');
    
    if (tabId === 'profile-window') {
        const myPosts = posts.filter(p => p.author === user.name);
        const container = document.getElementById('profile-wall-posts');
        if (myPosts.length === 0) container.innerHTML = '<div style="color:#555; text-align:center; padding:20px;">😎 Твоя стена пуста</div>';
        else container.innerHTML = myPosts.map(p => `<div class="post"><p>${p.text}</p><small style="color:#666;">${p.time}</small></div>`).join('');
        updateProfileStats();
    }
}

function previewMedia() { console.log('медиа выбрано'); }
