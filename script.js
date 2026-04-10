// === ДРУЗЬЯ (сохраняем в localStorage) ===
let friendsDB = JSON.parse(localStorage.getItem(`bro_friends_${user.phone}`)) || { list: [], requests: [] };

function renderFriends() {
    const friendsBox = document.getElementById('friends-list');
    const requestsBox = document.getElementById('friend-requests');
    
    if (!friendsBox) return;
    
    if (friendsDB.list.length === 0) {
        friendsBox.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">👋 Добавь друзей, чтобы общаться!</div>';
    } else {
        friendsBox.innerHTML = friendsDB.list.map(friend => `
            <div class="friend-item">
                <div class="friend-info">
                    <div class="friend-avatar">${friend.name[0]}</div>
                    <div>
                        <div class="friend-name">${friend.name}</div>
                        <div class="friend-status">${friend.online ? '🟢 В сети' : '⚫ Оффлайн'}</div>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="friend-btn" onclick="openChatWithFriend('${friend.name}')">💬 Чат</button>
                    <button class="friend-btn remove" onclick="removeFriend('${friend.name}')">❌ Удалить</button>
                </div>
            </div>
        `).join('');
    }
    
    if (requestsBox) {
        const incoming = friendsDB.requests.filter(r => r.to === user.name && r.status === 'pending');
        if (incoming.length === 0) {
            requestsBox.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">📭 Нет заявок в друзья</div>';
        } else {
            requestsBox.innerHTML = incoming.map(req => `
                <div class="request-item">
                    <span><b>${req.from}</b> хочет добавить тебя в друзья</span>
                    <div style="display:flex; gap:8px;">
                        <button class="friend-btn accept" onclick="acceptFriend('${req.from}')">✅ Принять</button>
                        <button class="friend-btn decline" onclick="declineFriend('${req.from}')">❌ Отклонить</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function addFriend(name) {
    if (friendsDB.list.some(f => f.name === name)) {
        alert(`${name} уже в друзьях!`);
        return;
    }
    
    // Отправляем заявку
    const request = { from: user.name, to: name, status: 'pending' };
    friendsDB.requests.push(request);
    localStorage.setItem(`bro_friends_${user.phone}`, JSON.stringify(friendsDB));
    
    // Для другого пользователя нужно отправить через сервер
    socket.emit('friend_request', { from: user.name, to: name });
    alert(`Заявка отправлена ${name}`);
}

function acceptFriend(name) {
    friendsDB.list.push({ name: name, online: false });
    friendsDB.requests = friendsDB.requests.filter(r => !(r.from === name && r.to === user.name));
    localStorage.setItem(`bro_friends_${user.phone}`, JSON.stringify(friendsDB));
    renderFriends();
    alert(`${name} теперь твой друг!`);
}

function declineFriend(name) {
    friendsDB.requests = friendsDB.requests.filter(r => !(r.from === name && r.to === user.name));
    localStorage.setItem(`bro_friends_${user.phone}`, JSON.stringify(friendsDB));
    renderFriends();
}

function removeFriend(name) {
    friendsDB.list = friendsDB.list.filter(f => f.name !== name);
    localStorage.setItem(`bro_friends_${user.phone}`, JSON.stringify(friendsDB));
    renderFriends();
    alert(`${name} удалён из друзей`);
}

function openChatWithFriend(name) {
    openChat(name);
}

function filterFriends() {
    const val = document.getElementById('friends-search')?.value.toLowerCase() || '';
    const filtered = friendsDB.list.filter(f => f.name.toLowerCase().includes(val));
    const friendsBox = document.getElementById('friends-list');
    if (!friendsBox) return;
    
    if (filtered.length === 0) {
        friendsBox.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">👋 Друзья не найдены</div>';
    } else {
        friendsBox.innerHTML = filtered.map(friend => `
            <div class="friend-item">
                <div class="friend-info">
                    <div class="friend-avatar">${friend.name[0]}</div>
                    <div>
                        <div class="friend-name">${friend.name}</div>
                        <div class="friend-status">${friend.online ? '🟢 В сети' : '⚫ Оффлайн'}</div>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="friend-btn" onclick="openChatWithFriend('${friend.name}')">💬 Чат</button>
                    <button class="friend-btn remove" onclick="removeFriend('${friend.name}')">❌ Удалить</button>
                </div>
            </div>
        `).join('');
    }
}

// === СТЕНА С ПОСТАМИ ===
let wallPosts = JSON.parse(localStorage.getItem(`bro_wall_${user.phone}`)) || [];

function postToWall() {
    const text = document.getElementById('wall-text').value;
    const mediaInput = document.getElementById('wall-media-input');
    const file = mediaInput?.files[0];
    
    if (!text && !file) return;
    
    const newPost = {
        id: Date.now(),
        text: text,
        media: file ? URL.createObjectURL(file) : null,
        mediaType: file ? (file.type.startsWith('video') ? 'video' : 'image') : null,
        likes: 0,
        likedBy: [],
        comments: [],
        reposted: false,
        time: new Date().toLocaleString()
    };
    
    wallPosts.unshift(newPost);
    localStorage.setItem(`bro_wall_${user.phone}`, JSON.stringify(wallPosts));
    
    document.getElementById('wall-text').value = '';
    if (mediaInput) mediaInput.value = '';
    
    renderWall();
}

function renderWall() {
    const wallBox = document.getElementById('my-wall-posts');
    if (!wallBox) return;
    
    if (wallPosts.length === 0) {
        wallBox.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">😎 Твоя стена пуста. Опубликуй что-нибудь!</div>';
        return;
    }
    
    wallBox.innerHTML = wallPosts.map(post => `
        <div class="post" id="post-${post.id}">
            <b style="color:#00ff41">@${user.name}</b>
            <small style="color:#666; margin-left:10px;">${post.time}</small>
            <p style="margin:10px 0;">${post.text}</p>
            ${post.media ? (post.mediaType === 'video' ? `<video src="${post.media}" controls></video>` : `<img src="${post.media}">`) : ''}
            <div class="post-actions">
                <span class="${post.likedBy.includes(user.phone) ? 'liked' : ''}" onclick="likeWallPost(${post.id})">❤️ ${post.likes}</span>
                <span onclick="toggleWallComments(${post.id})">💬 ${post.comments.length}</span>
                <span onclick="repostWallPost(${post.id})">🔄 Репост</span>
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display:none;">
                ${post.comments.map(c => `<div class="comment"><strong>${c.author}:</strong> ${c.text}</div>`).join('')}
                <div class="comment-input">
                    <input type="text" id="comment-input-${post.id}" placeholder="Написать комментарий...">
                    <button onclick="addWallComment(${post.id})">→</button>
                </div>
            </div>
        </div>
    `).join('');
}

function likeWallPost(id) {
    const post = wallPosts.find(p => p.id === id);
    if (post) {
        if (post.likedBy.includes(user.phone)) {
            post.likes--;
            post.likedBy = post.likedBy.filter(uid => uid !== user.phone);
        } else {
            post.likes++;
            post.likedBy.push(user.phone);
        }
        localStorage.setItem(`bro_wall_${user.phone}`, JSON.stringify(wallPosts));
        renderWall();
    }
}

function toggleWallComments(id) {
    const commentsDiv = document.getElementById(`comments-${id}`);
    if (commentsDiv) {
        commentsDiv.style.display = commentsDiv.style.display === 'none' ? 'block' : 'none';
    }
}

function addWallComment(id) {
    const input = document.getElementById(`comment-input-${id}`);
    const text = input?.value.trim();
    if (text) {
        const post = wallPosts.find(p => p.id === id);
        if (post) {
            post.comments.push({ author: user.name, text: text });
            localStorage.setItem(`bro_wall_${user.phone}`, JSON.stringify(wallPosts));
            input.value = '';
            renderWall();
        }
    }
}

function repostWallPost(id) {
    const post = wallPosts.find(p => p.id === id);
    if (post && !post.reposted) {
        post.reposted = true;
        localStorage.setItem(`bro_wall_${user.phone}`, JSON.stringify(wallPosts));
        
        // Добавляем в репосты
        let reposts = JSON.parse(localStorage.getItem(`bro_reposts_${user.phone}`)) || [];
        reposts.unshift({ ...post, repostedAt: new Date().toLocaleString() });
        localStorage.setItem(`bro_reposts_${user.phone}`, JSON.stringify(reposts));
        
        renderReposts();
        alert("✅ Пост добавлен в репосты!");
    }
}

function renderReposts() {
    const repostsBox = document.getElementById('my-reposts-list');
    if (!repostsBox) return;
    
    let reposts = JSON.parse(localStorage.getItem(`bro_reposts_${user.phone}`)) || [];
    
    if (reposts.length === 0) {
        repostsBox.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">🔄 Здесь будут твои репосты</div>';
        return;
    }
    
    repostsBox.innerHTML = reposts.map(post => `
        <div class="post">
            <b style="color:#00ff41">@${post.author}</b>
            <small style="color:#666; margin-left:10px;">${post.time}</small>
            <p style="margin:10px 0;">${post.text}</p>
            ${post.media ? (post.mediaType === 'video' ? `<video src="${post.media}" controls></video>` : `<img src="${post.media}">`) : ''}
            <div class="post-actions">
                <span>❤️ ${post.likes}</span>
                <span>💬 ${post.comments.length}</span>
            </div>
            <small style="color:#888;">Репостнуто: ${post.repostedAt || 'недавно'}</small>
        </div>
    `).join('');
}

// === ОБНОВЛЯЕМ showTab ДЛЯ НОВЫХ РАЗДЕЛОВ ===
const originalShowTab = showTab;
window.showTab = function(tab) {
    originalShowTab(tab);
    if (tab === 'friends') renderFriends();
    if (tab === 'wall') renderWall();
    if (tab === 'reposts') renderReposts();
};

// === ДОБАВЛЯЕМ КНОПКУ ДОБАВЛЕНИЯ В ДРУЗЬЯ В СПИСОК ПОЛЬЗОВАТЕЛЕЙ ===
const originalRenderUsers = renderUsers;
window.renderUsers = function(list) {
    const box = document.getElementById('users-list');
    if (!box) return;
    
    const currentUsers = list.filter(u => u.name !== user.name);
    
    if (currentUsers.length === 0) {
        box.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">🤷 Никого в сети</div>';
        return;
    }
    
    box.innerHTML = currentUsers.map(u => `
        <div class="chat-item" onclick="openChat('${u.name}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <b>${u.name}</b>
                    <small style="color:#00ff41; display:block;">В сети</small>
                </div>
                ${!friendsDB.list.some(f => f.name === u.name) ? 
                    `<button class="friend-btn add" onclick="event.stopPropagation(); addFriend('${u.name}')">➕ В друзья</button>` : 
                    '<small style="color:#00ff41;">✓ Друг</small>'}
            </div>
        </div>
    `).join('');
};
