// === 1. ПОДКЛЮЧЕНИЕ К СЕРВЕРУ (ВАЖНО!) ===
// Теперь твое приложение связано с реальным сервером в облаке Amvera
const socket = io('https://bro-mesenger-drippldd.amvera.io'); 

// СОСТОЯНИЕ
let user = { name: "Бро", phone: "", status: "Кайфую", avatar: null };
let posts = [];
let groups = [];
let currentChatType = "private";
let currentTargetChat = "";
let debtsDB = JSON.parse(localStorage.getItem("bro_debts")) || {};

// СЛУШАЕМ СЕРВЕР: когда кто-то прислал сообщение
socket.on('receive_msg', (data) => {
    // Если мы сейчас в том самом чате, куда пришло сообщение
    if (currentTargetChat === data.target || data.target === 'all') {
        const isOwn = data.author === user.name;
        appendMsg(data.type, data.text, isOwn, data.author);
    }
});

const globalUsersBase = [
    { name: "Антоха", phone: "8999111", status: "На битах", isContact: true },
    { name: "Серый", phone: "8900555", status: "На связи", isContact: true },
    { name: "Диман", phone: "8911000", status: "Дела", isContact: true },
    { name: "Жека", phone: "8922333", status: "Бро здесь", isContact: false }
];

// === ВХОД ===
function finishAuth() {
    const ph = document.getElementById('reg-phone').value;
    const pass = document.getElementById('reg-pass').value;
    if(ph.length > 2 && pass.length > 2) {
        // Убрали принудительное "Бро_", чтобы ты мог сам ставить ник
        user.name = "Юзер_" + ph.slice(-3); 
        user.phone = ph;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        updateProfileUI();
        renderUserLists();
        renderAllFeeds();
    } else {
        alert("Введи телефон и пароль!");
    }
}

// === KFC КНОПКА ===
function orderKFC() {
    window.open('https://rostics.ru/menu', '_blank');
}

// === РЕНДЕР СПИСКОВ ===
function renderUserLists() {
    const contactsBox = document.getElementById('contacts-list');
    const othersBox = document.getElementById('users-list');

    const groupsHTML = groups.map(g => `
        <div class="chat-item" onclick="openGroupChat('${g.id}')">
            <b>👥 ${g.name}</b><br><small style="color:#00d4ff">Группа: ${g.members.length} Бро</small>
        </div>
    `).join('');

    const contacts = globalUsersBase.filter(u => u.isContact).map(u => `
        <div class="chat-item" onclick="openPrivateChat('${u.name}')">
            <b>${u.name}</b><br><small style="color:#666">${u.status}</small>
        </div>
    `).join('');

    if(contactsBox) contactsBox.innerHTML = groupsHTML + contacts;
    if(othersBox) othersBox.innerHTML = globalUsersBase.filter(u => !u.isContact).map(u => `
        <div class="chat-item" onclick="openPrivateChat('${u.name}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b>${u.name}</b>
                <button onclick="addFriend(event, '${u.name}')" style="background:#00ff41; border:none; border-radius:5px; padding:2px 8px; cursor:pointer;">➕</button>
            </div>
        </div>
    `).join('');
}

function addFriend(event, name) {
    event.stopPropagation();
    alert(`✅ Бро ${name} добавлен в контакты!`);
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

function openGroupChat(id) {
    const g = groups.find(x => x.id === id);
    if(g) {
        currentChatType = "group";
        currentTargetChat = id;
        document.getElementById('chat-with-name').innerText = "👥 " + g.name;
        document.getElementById('chat-messages').innerHTML = '<div class="msg-bubble" style="background:#1a1a2a; text-align:center;">👥 Групповой чат: ' + g.name + '</div>';
        showTab('private-chat');
    }
}

function createNewGroup() {
    const name = prompt("Название группы:");
    if(name && name.trim()) {
        groups.push({ id: "g_" + Date.now(), name: name.trim(), members: ["Антоха", "Серый", user.name] });
        renderUserLists();
        alert(`✅ Группа "${name}" создана!`);
    }
}

// === ОБНОВЛЕННАЯ ФУНКЦИЯ ОТПРАВКИ (СЕТЕВАЯ) ===
function sendPrivateMsg() {
    const input = document.getElementById('msg-input');
    const val = input.value.trim();
    if (!val) return;

    // Отправляем данные на сервер
    socket.emit('send_msg', {
        author: user.name,
        text: val,
        type: 'text',
        target: currentTargetChat 
    });

    input.value = "";
}

function sendChatMedia(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    
    socket.emit('send_msg', {
        author: user.name,
        text: url,
        type: type,
        target: currentTargetChat
    });
    
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

// === КИДАЛОВО С КОМАНДАМИ ===
function openDebt() {
    const chatFriend = currentTargetChat;
    const debtKey = `${user.phone}_${chatFriend}`;
    let currentDebt = debtsDB[debtKey] || 0;
    
    const action = prompt(
        `💸 КИДАЛОВО с ${chatFriend}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 ТЕКУЩИЙ ДОЛГ: ${currentDebt} руб.\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `1️⃣  Добавить долг\n` +
        `2️⃣  Вычесть (он заплатил)\n` +
        `3️⃣  Установить сумму\n` +
        `0️⃣  Показать долг\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Введи номер команды:`
    );
    
    if (action === "1") {
        const amount = parseFloat(prompt(`➕ СКОЛЬКО ДОБАВИТЬ?\nСейчас должен: ${currentDebt} руб.`));
        if (amount && !isNaN(amount) && amount > 0) {
            debtsDB[debtKey] = currentDebt + amount;
            saveDebts();
            appendMsg('text', `💸 [КИДАЛОВО]: ${chatFriend} теперь должен ${debtsDB[debtKey]} руб. (+${amount})`, true);
        }
    }
    else if (action === "2") {
        const amount = parseFloat(prompt(`➖ СКОЛЬКО ЗАПЛАТИЛ?\nСейчас должен: ${currentDebt} руб.`));
        if (amount && !isNaN(amount) && amount > 0) {
            const newDebt = Math.max(0, currentDebt - amount);
            debtsDB[debtKey] = newDebt;
            saveDebts();
            appendMsg('text', `💸 [КИДАЛОВО]: ${chatFriend} заплатил ${amount} руб. Остаток: ${newDebt} руб.`, true);
        }
    }
    else if (action === "3") {
        const amount = parseFloat(prompt(`⚙️ УСТАНОВИТЬ ТОЧНУЮ СУММУ ДОЛГА:\nСейчас: ${currentDebt} руб.`));
        if (amount !== null && !isNaN(amount) && amount >= 0) {
            debtsDB[debtKey] = amount;
            saveDebts();
            appendMsg('text', `💸 [КИДАЛОВО]: Долг ${chatFriend} установлен на ${amount} руб.`, true);
        }
    }
    else if (action === "0") {
        appendMsg('text', `📊 [КИДАЛОВО]: ${chatFriend} должен тебе ${currentDebt} руб.`, false);
    }
}

function saveDebts() {
    localStorage.setItem("bro_debts", JSON.stringify(debtsDB));
}

// === СИНХРОН (ОБЩИЙ ПЛЕЙЛИСТ) ===
function toggleJointPlaylist() {
    const btn = document.getElementById('joint-trigger');
    const active = btn.classList.toggle('joint-active');
    appendMsg('text', `🤝 [СИНХРОН]: Общий плейлист ${active ? 'ЗАПУЩЕН' : 'ОСТАНОВЛЕН'}!`, false);
}

// === ПОСТЫ И ПРОФИЛЬ ===
function postToWall() {
    const txt = document.getElementById('wall-text').value;
    const mediaInput = document.getElementById('wall-media-input');
    const file = mediaInput ? mediaInput.files[0] : null;

    if(!txt && !file) return;

    const newPost = { 
        id: Date.now(), 
        author: user.name, 
        authorId: user.phone,
        text: txt, 
        media: file ? URL.createObjectURL(file) : null,
        mediaType: file ? (file.type.startsWith('video') ? 'video' : 'image') : null,
        likes: 0, 
        likedBy: [],
        comments: [],
        repostedBy: [],
        time: new Date().toLocaleString()
    };
    
    posts.unshift(newPost);
    renderAllFeeds();
    document.getElementById('wall-text').value = "";
    if(mediaInput) mediaInput.value = "";
}

function renderAllFeeds() {
    renderFeedPosts();
    renderWallPosts();
    renderReposts();
}

function renderFeedPosts() {
    const feedBox = document.getElementById('global-feed-posts');
    if(!feedBox) return;
    if(posts.length === 0) {
        feedBox.innerHTML = "<div style='text-align:center; color:#555; padding:20px;'>🚀 Лента пуста</div>";
        return;
    }
    feedBox.innerHTML = posts.map(p => postHTML(p)).join('');
}

function renderWallPosts() {
    const wallBox = document.getElementById('my-wall-posts');
    if(!wallBox) return;
    const myPosts = posts.filter(p => p.author === user.name);
    if(myPosts.length === 0) {
        wallBox.innerHTML = "<div style='text-align:center; color:#555; padding:20px;'>😎 Твоя стена пуста</div>";
        return;
    }
    wallBox.innerHTML = myPosts.map(p => postHTML(p)).join('');
}

function renderReposts() {
    const repostsBox = document.getElementById('my-reposts-list');
    if(!repostsBox) return;
    const myReposts = posts.filter(p => p.repostedBy && p.repostedBy.includes(user.phone));
    if(myReposts.length === 0) {
        repostsBox.innerHTML = "<div style='text-align:center; color:#555; padding:20px;'>🔄 Здесь будут твои репосты</div>";
        return;
    }
    repostsBox.innerHTML = myReposts.map(p => postHTML(p, true)).join('');
}

function postHTML(p, isRepost = false) {
    const isLiked = p.likedBy && p.likedBy.includes(user.phone);
    const isReposted = p.repostedBy && p.repostedBy.includes(user.phone);
    const mediaHTML = p.media ? 
        (p.mediaType === 'video' ? `<video src="${p.media}" controls></video>` : `<img src="${p.media}">`) : '';
    
    return `
        <div class="post" id="post-${p.id}">
            <b style="color:#00ff41">@${p.author}</b>
            <small style="color:#666; margin-left:10px;">${p.time}</small>
            <p style="margin:10px 0;">${p.text}</p>
            ${mediaHTML}
            <div class="post-actions">
                <span class="${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})">❤️ ${p.likes}</span>
                <span onclick="toggleComments(${p.id})">💬 ${p.comments.length}</span>
                <span class="${isReposted ? 'liked' : ''}" onclick="repostPost(${p.id})">🔄 ${isRepost ? 'Репостнут' : 'Репост'}</span>
            </div>
            <div class="comments-section" id="comments-${p.id}" style="display:none;">
                <div id="comments-list-${p.id}">
                    ${p.comments.map(c => `<div class="comment"><strong>${c.author}:</strong> ${c.text}</div>`).join('')}
                </div>
                <div class="comment-input">
                    <input type="text" id="comment-input-${p.id}" placeholder="Написать комментарий...">
                    <button onclick="addComment(${p.id})">→</button>
                </div>
            </div>
        </div>
    `;
}

function likePost(id) {
    const post = posts.find(p => p.id === id);
    if(post) {
        if(post.likedBy.includes(user.phone)) {
            post.likes--;
            post.likedBy = post.likedBy.filter(uid => uid !== user.phone);
        } else {
            post.likes++;
            post.likedBy.push(user.phone);
        }
        renderAllFeeds();
    }
}

function repostPost(id) {
    const post = posts.find(p => p.id === id);
    if(post) {
        if(!post.repostedBy.includes(user.phone)) {
            post.repostedBy.push(user.phone);
            alert("✅ Пост добавлен в репосты!");
            renderAllFeeds();
        }
    }
}

function toggleComments(id) {
    const commentsDiv = document.getElementById(`comments-${id}`);
    if(commentsDiv) {
        commentsDiv.style.display = commentsDiv.style.display === 'none' ? 'block' : 'none';
    }
}

function addComment(id) {
    const input = document.getElementById(`comment-input-${id}`);
    const text = input.value.trim();
    if(text) {
        const post = posts.find(p => p.id === id);
        if(post) {
            post.comments.push({
                author: user.name,
                text: text,
                time: new Date().toLocaleTimeString()
            });
            input.value = "";
            renderAllFeeds();
        }
    }
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
        alert("❌ Вставь корректную ссылку на SoundCloud!");
    }
}

// === ПРОФИЛЬ ===
function updateProfileUI() {
    document.getElementById('user-name-display').innerText = user.name;
    document.getElementById('user-status-display').innerText = user.status;
}

function openEditProfile() {
    const n = prompt("Новый ник:", user.name);
    const s = prompt("Твой статус (сок):", user.status);
    if(n && n.trim()) {
        user.name = n.trim();
        // ВАЖНО: Если ты поменял ник, и он стал "Админ", мы сможем это использовать
        if(user.name === "Админ") {
            console.log("🔥 Режим Бога активирован!");
        }
    }
    if(s && s.trim()) user.status = s.trim();
    updateProfileUI();
    renderAllFeeds();
}

function changeAvatar(event) {
    const file = event.target.files[0];
    if(file) {
        user.avatar = URL.createObjectURL(file);
        document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}">`;
    }
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
    
    if(tab === 'reposts') renderReposts();
}