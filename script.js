/* =================================================================ia
   1. KONFIGURACE A INICIALIZACE SUPABASE
================================================================== */
const SUPABASE_URL = 'https://javdlvchwamtxjgxbtcx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Lm05BJdFdb77Y3HO_xKHSw_5-1b0OuY';

const mySupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage
    }
});


/* ===================================================================
   2. DOM ELEMENTY (CACHE)
================================================================== */
// Autentifikace a hlavní layout
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('mail');
const passwordInput = document.getElementById('password');
const loginContainer = document.getElementById('login');
const chatContainer = document.getElementById('chat');

// Chat a místnosti
const roomsList = document.getElementById('roomsList');
const messagesList = document.getElementById('messagesList');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const currentRoomTitle = document.getElementById('currentRoomTitle');
const backToRoomsBtn = document.getElementById('back-to-rooms-btn');

// Modální okno: Nastavení
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const logoutBtn = document.getElementById('logout-btn');
const settingsEmailDisplay = document.getElementById('settings-email');
const settingsUsernameInput = document.getElementById('settings-username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const colorButtons = document.querySelectorAll('.color-btn');

// Modální okno: Nový chat (➕)
const addRoomModal = document.getElementById('add-room-modal');
const addRoomBtn = document.getElementById('add-room-btn');
const closeAddRoomBtn = document.getElementById('close-add-room-btn');
const createDmBtn = document.getElementById('create-dm-btn');
const searchUsernameInput = document.getElementById('search-username-input');


/* ===================================================================
   3. APLIKAČNÍ STAV (STATE)
================================================================== */
let currentUser = null;
let currentRoomId = null;
let currentSubscription = null;
let roomsSubscription = null;


/* ===================================================================
   4. UI SPRÁVA (MODALY A VZHLED)
================================================================== */
// Otevírání a zavírání modalů
settingsBtn?.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsBtn?.addEventListener('click', () => settingsModal.classList.add('hidden'));

addRoomBtn?.addEventListener('click', () => {
    addRoomModal.classList.remove('hidden');
    searchUsernameInput?.focus();
});

closeAddRoomBtn?.addEventListener('click', () => {
    addRoomModal.classList.add('hidden');
    if (searchUsernameInput) searchUsernameInput.value = '';
});

// Zavření modalů kliknutím mimo okno
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
    if (e.target === addRoomModal) addRoomModal.classList.add('hidden');
});

// Mobilní tlačítko zpět na seznam místností
backToRoomsBtn?.addEventListener('click', () => {
    chatContainer.classList.remove('mobile-chat-open');
});


/* ===================================================================
   5. AUTENTIFIKACE A SESSION MANAGEMENT
================================================================== */
async function checkUserSession() {
    mySupabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event);
        
        if (session && session.user) {
            if (currentUser && currentUser.id === session.user.id) return; 

            currentUser = session.user;
            loginContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            
            loadRooms();
            setupRealtimeRooms();
        } else {
            currentUser = null;
            loginContainer.style.display = 'flex';
            chatContainer.style.display = 'none';
        }
    });
}

// Přihlášení / Registrace
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Vyplň email i heslo!");
        return;
    }

    loginBtn.disabled = true;
    const originalText = loginBtn.textContent;
    loginBtn.textContent = "Přihlašuji...";

    let { data, error } = await mySupabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.log("Přihlášení selhalo, zkouším registraci...");
        const username = document.getElementById('uname')?.value.trim() || email.split('@')[0];

        const signUpResult = await mySupabase.auth.signUp({ 
            email, 
            password,
            options: { data: { username: username } }
        });
        data = signUpResult.data;
        error = signUpResult.error;
    }

    loginBtn.disabled = false;
    loginBtn.textContent = originalText;

    if (error) {
        alert("Chyba: " + error.message);
    } else {
        currentUser = data.user;
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        loadRooms();
        setupRealtimeRooms();
    }
});

// Odhlášení
logoutBtn.addEventListener('click', async () => {
    const { error } = await mySupabase.auth.signOut();
    
    if (error) {
        console.error("Chyba při odhlašování:", error.message);
        return;
    }

    currentUser = null;
    currentRoomId = null;

    if (currentSubscription) {
        mySupabase.removeChannel(currentSubscription);
        currentSubscription = null;
    }

    if (roomsSubscription) {
        mySupabase.removeChannel(roomsSubscription);
        roomsSubscription = null;
    }

    settingsModal.classList.add('hidden');
    chatContainer.style.display = 'none';
    loginContainer.style.display = 'flex';
    
    emailInput.value = '';
    passwordInput.value = '';
});


/* ===================================================================
   6. SPRÁVA MÍSTNOSTÍ (ROOMS)
================================================================== */
async function loadRooms() {
    const { data: roomsData, error: roomsError } = await mySupabase
        .from('rooms')
        .select('*');

    if (roomsError) {
        console.error("Chyba při načítání místností:", roomsError.message);
        return;
    }

    roomsList.innerHTML = '';
    
    if (!roomsData || roomsData.length === 0) {
        roomsList.innerHTML = '<p style="color: #888; font-size: 14px; padding: 10px;">Zatím nejsou vytvořené žádné místnosti.</p>';
        return;
    }

    for (const room of roomsData) {
        if (room.user1_id && room.user2_id) {
            if (currentUser && (room.user1_id === currentUser.id || room.user2_id === currentUser.id)) {
                await renderRoomItem(room);
            }
        } else {
            renderRoomItemLegacy(room);
        }
    }
}

async function renderRoomItem(room) {
    const otherUserId = room.user1_id === currentUser.id ? room.user2_id : room.user1_id;
    
    const { data: profileData } = await mySupabase
        .from('profiles')
        .select('username, email')
        .eq('id', otherUserId)
        .single();

    const otherUserName = profileData ? (profileData.username || profileData.email) : 'Neznámý uživatel';

    const roomDiv = document.createElement('div');
    roomDiv.textContent = `Chat s: ${otherUserName}`;
    roomDiv.className = 'room-item';

    roomDiv.addEventListener('click', () => {
        selectRoom(room.id, otherUserName);
    });

    roomsList.appendChild(roomDiv);
}

function renderRoomItemLegacy(room) {
    const roomDiv = document.createElement('div');
    roomDiv.textContent = room.name;
    roomDiv.className = 'room-item';

    roomDiv.addEventListener('click', () => {
        selectRoom(room.id, room.name);
    });

    roomsList.appendChild(roomDiv);
}

// Vytvoření nového přímého chatu (DM)
createDmBtn.addEventListener('click', async () => {
    const searchTarget = searchUsernameInput.value.trim();
    
    if (!searchTarget) {
        alert('Zadej email nebo uživatelské jméno!');
        return;
    }

    const { data: foundUsers, error: searchError } = await mySupabase
        .from('profiles')
        .select('*')
        .or(`email.eq.${searchTarget},username.eq.${searchTarget}`);

    if (searchError || !foundUsers || foundUsers.length === 0) {
        alert('Takový uživatel neexistuje!');
        return;
    }

    const targetUser = foundUsers[0];

    if (targetUser.id === currentUser.id) {
        alert('Nemůžeš vytvořit chat sám se sebou!');
        return;
    }

    const { data: existingRooms } = await mySupabase
        .from('rooms')
        .select('*')
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${targetUser.id}),and(user1_id.eq.${targetUser.id},user2_id.eq.${currentUser.id})`);

    if (existingRooms && existingRooms.length > 0) {
        alert('Chat s tímto uživatelem už existuje!');
        searchUsernameInput.value = '';
        addRoomModal.classList.add('hidden');
        selectRoom(existingRooms[0].id, targetUser.username || targetUser.email);
        return;
    }

    const roomName = `Chat s: ${targetUser.username || targetUser.email}`;

    const { data: newRoom, error: roomError } = await mySupabase
        .from('rooms')
        .insert([{ 
            name: roomName,
            user1_id: currentUser.id,
            user2_id: targetUser.id
        }])
        .select();

    if (roomError) {
        alert("Chyba při vytváření místnosti: " + roomError.message);
    } else {
        searchUsernameInput.value = '';
        addRoomModal.classList.add('hidden');
    }
});

function selectRoom(roomId, roomName) {
    currentRoomId = roomId;
    currentRoomTitle.textContent = `Chat: ${roomName}`;
    loadMessagesForRoom(roomId);
    setupRealtimeChat(roomId);

    if (window.innerWidth <= 768) {
        chatContainer.classList.add('mobile-chat-open');
    }
}


/* ===================================================================
   7. SPRÁVA ZPRÁV A CHATU (MESSAGES)
================================================================== */
async function loadMessagesForRoom(roomId) {
    const { data, error } = await mySupabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Chyba při načítání zpráv:", error.message);
        return;
    }

    messagesList.innerHTML = '';
    
    if (data.length === 0) {
        messagesList.innerHTML = '<p style="color: #666; font-size: 14px; text-align: center; margin-top: 20px;">Zatím tu nejsou žádné zprávy. Buď první! 🚀</p>';
        return;
    }

    data.forEach(msg => appendMessageBubble(msg));
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Odeslání nové zprávy
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = messageInput.value.trim();
    if (!text) return;
    
    if (!currentRoomId) {
        alert("Nejprve vyber nějaký chat vlevo!");
        return;
    }

    const displayName = currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0] || "Anonym";

    const { error } = await mySupabase
        .from('messages')
        .insert([{ 
            content: text, 
            user_email: displayName, 
            room_id: currentRoomId 
        }]);

    if (error) {
        alert("Chyba při odesílání: " + error.message);
    } else {
        messageInput.value = '';
    }
});

// Vykreslení jedné zprávové bubliny
function appendMessageBubble(msg) {
    let timeString = "";
    if (msg.created_at) {
        const date = new Date(msg.created_at);
        timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message-bubble';

    msgDiv.innerHTML = `
        <span class="message-author">${msg.user_email}</span>
        <div class="message-text">${msg.content}</div>
        <span class="message-time">${timeString}</span>
    `;
    
    messagesList.appendChild(msgDiv);
}


/* ===================================================================
   8. REALTIME (WEBSOCKETS)
================================================================== */
function setupRealtimeChat(roomId) {
    if (currentSubscription) {
        mySupabase.removeChannel(currentSubscription);
    }

    currentSubscription = mySupabase
        .channel(`room-${roomId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`
            },
            (payload) => {
                appendMessageBubble(payload.new);
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        )
        .subscribe();
}

function setupRealtimeRooms() {
    if (roomsSubscription) {
        mySupabase.removeChannel(roomsSubscription);
    }

    roomsSubscription = mySupabase
        .channel('public:rooms')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'rooms'
            },
            async (payload) => {
                if (!currentUser) return;
                const room = payload.new;
                
                if (room.user1_id === currentUser.id || room.user2_id === currentUser.id) {
                    await renderRoomItem(room);
                }
            }
        )
        .subscribe();
}


/* ===================================================================
   9. NASTAVENÍ A PERSONALIZACE
================================================================== */
// Načtení uložené barvy z LocalStorage při startu
const savedColor = localStorage.getItem('chatAccentColor');
if (savedColor) {
    document.documentElement.style.setProperty('--primary', savedColor);
    colorButtons.forEach(b => {
        if (b.getAttribute('data-color') === savedColor) b.classList.add('active');
    });
}

// Přepínání barevných schémat
colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const color = e.target.getAttribute('data-color');
        document.documentElement.style.setProperty('--primary', color);
        localStorage.setItem('chatAccentColor', color);
        
        colorButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
    });
});

// Načtení údajů do modálního okna nastavení
settingsBtn?.addEventListener('click', async () => {
    if (currentUser && settingsEmailDisplay && settingsUsernameInput) {
        settingsEmailDisplay.textContent = currentUser.email;
        
        const { data: profile } = await mySupabase
            .from('profiles')
            .select('username')
            .eq('id', currentUser.id)
            .single();
            
        if (profile && profile.username) {
            settingsUsernameInput.value = profile.username;
        } else {
            settingsUsernameInput.value = currentUser.email.split('@')[0];
        }
    }
});

// Uložení nového uživatelského jména
saveUsernameBtn?.addEventListener('click', async () => {
    const newUsername = settingsUsernameInput.value.trim();
    if (!newUsername) return;

    saveUsernameBtn.textContent = "Ukládám...";
    
    const { error } = await mySupabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', currentUser.id);

    if (error) {
        alert("Chyba při ukládání jména: " + error.message);
        saveUsernameBtn.textContent = "Uložit";
    } else {
        saveUsernameBtn.textContent = "Uloženo ✔";
        setTimeout(() => saveUsernameBtn.textContent = "Uložit", 2000);
    }
});


/* ===================================================================
   10. SPUŠTĚNÍ APLIKACE
================================================================== */
checkUserSession();