const SUPABASE_URL = 'https://javdlvchwamtxjgxbtcx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Lm05BJdFdb77Y3HO_xKHSw_5-1b0OuY';

// Přidali jsme třetí parametr s nastavením "auth", který vynutí uložení session
const mySupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage
    }
});

// --- ELEMENTY ---
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('mail');
const passwordInput = document.getElementById('password');
const loginContainer = document.getElementById('login');
const chatContainer = document.getElementById('chat');

const roomsList = document.getElementById('roomsList');
const messagesList = document.getElementById('messagesList');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const currentRoomTitle = document.getElementById('currentRoomTitle');

// Modální okno - Nastavení
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const logoutBtn = document.getElementById('logout-btn');

// Modální okno - Nový chat (➕)
const addRoomModal = document.getElementById('add-room-modal');
const addRoomBtn = document.getElementById('add-room-btn');
const closeAddRoomBtn = document.getElementById('close-add-room-btn');
const createDmBtn = document.getElementById('create-dm-btn');
const searchUsernameInput = document.getElementById('search-username-input');

let currentUser = null;
let currentRoomId = null;
let currentSubscription = null;
let roomsSubscription = null;


// --- OTEVÍRÁNÍ A ZAVÍRÁNÍ MODALŮ ---
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

addRoomBtn.addEventListener('click', () => {
    addRoomModal.classList.remove('hidden');
    searchUsernameInput.focus();
});

closeAddRoomBtn.addEventListener('click', () => {
    addRoomModal.classList.add('hidden');
    searchUsernameInput.value = '';
});

// Zavření modalů kliknutím mimo okno
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.add('hidden');
    }
    if (e.target === addRoomModal) {
        addRoomModal.classList.add('hidden');
    }
});


// --- KONTROLA PŘI STARTU ---
async function checkUserSession() {
    // Supabase v2 automaticky pošle událost 'INITIAL_SESSION' jakmile prohledá localStorage
    mySupabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event); // Tohle nám pomůže při hledání chyb (uvidíš v konzoli F12)
        
        if (session && session.user) {
            // Pokud už jsme to načetli, nebudeme to dělat znovu
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

// Pomocná funkce, která se postará o zobrazení správné obrazovky
function handleSessionState(session) {
    if (session && session.user) {
        // Pokud už jsme to načetli, nebudeme to načítat znovu
        if (currentUser && currentUser.id === session.user.id) return; 

        currentUser = session.user;
        console.log("Uživatel je přihlášený:", currentUser.email);
        
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        
        loadRooms();
        setupRealtimeRooms();
    } else {
        console.log("Nikdo není přihlášený, zobrazuji login.");
        currentUser = null;
        loginContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
    }
}


// --- PŘIHLÁŠENÍ / REGISTRACE ---
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
        const username = document.getElementById('uname').value.trim() || email.split('@')[0];

        const signUpResult = await mySupabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: { username: username }
            }
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


// --- ODHLÁŠENÍ ---
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


// --- NAČTENÍ MÍSTNOSTÍ Z DATABÁZE ---
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

// Příklad funkce, která vytvoří HTML bublinu zprávy
function renderMessage(msg) {
    // 1. Zpracování času z databáze (převod z ISO formátu na hezký čas HH:MM)
    let timeString = "";
    if (msg.created_at) {
        const date = new Date(msg.created_at);
        // Formátuje čas na české poměry (např. 14:35)
        timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // 2. Vytvoření HTML struktury zprávy
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message-bubble');
    
    // Pokud chceš rozlišit vlastní zprávy a cizí, můžeš přidat třídu (podle toho, jak to máš pojmenované)
    // if (msg.username === currentUser) { messageDiv.classList.add('my-message'); }

    messageDiv.innerHTML = `
        <span class="message-author">${msg.username}</span>
        <div class="message-text">${msg.text}</div>
        <span class="message-time">${timeString}</span>
    `;

    document.getElementById('messagesList').appendChild(messageDiv);
}

// Pomocná funkce pro vykreslení místnosti s chytrým názvem
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

// Pro staré místnosti, které nemají user1/user2 ID
function renderRoomItemLegacy(room) {
    const roomDiv = document.createElement('div');
    roomDiv.textContent = room.name;
    roomDiv.className = 'room-item';

    roomDiv.addEventListener('click', () => {
        selectRoom(room.id, room.name);
    });

    roomsList.appendChild(roomDiv);
}

// --- VYTVOŘENÍ NOVÉ MÍSTNOSTI (Tlačítko ➕) ---
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

    const { data: existingRooms, error: checkError } = await mySupabase
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
        console.log("Místnost úspěšně vytvořena:", newRoom);
        searchUsernameInput.value = '';
        addRoomModal.classList.add('hidden');
    }
});


// --- VÝBĚR MÍSTNOSTI ---
function selectRoom(roomId, roomName) {
    currentRoomId = roomId;
    currentRoomTitle.textContent = `Chat: ${roomName}`;
    loadMessagesForRoom(roomId);
    setupRealtimeChat(roomId);

    // Na mobilech po kliknutí na místnost schováme seznam a ukážeme chat
    const chatWrapper = document.getElementById('chat'); // Nebo ID tvého hlavního chat containeru
    if (window.innerWidth <= 768) {
        chatWrapper.classList.add('mobile-chat-open');
    }
}

// --- TLAČÍTKO ZPĚT NA MOBILU ---
const backToRoomsBtn = document.getElementById('back-to-rooms-btn');
if (backToRoomsBtn) {
    backToRoomsBtn.addEventListener('click', () => {
        const chatWrapper = document.getElementById('chat');
        chatWrapper.classList.remove('mobile-chat-open');
    });
}


// --- NAČTENÍ ZPRÁV PRO DANOU MÍSTNOST ---
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

    data.forEach(msg => {
        // Získání a zformátování času
        let timeString = "";
        if (msg.created_at) {
            const date = new Date(msg.created_at);
            timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-bubble';

        // Přidání času do HTML bubliny
        msgDiv.innerHTML = `
            <span class="message-author">${msg.user_email}</span>
            <div class="message-text">${msg.content}</div>
            <span class="message-time">${timeString}</span>
        `;
        
        messagesList.appendChild(msgDiv);
    });

    // Po načtení zpráv odscrollujeme úplně dolů
    messagesList.scrollTop = messagesList.scrollHeight;
}


// --- ODESÍLÁNÍ ZPRÁV ---
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


// --- POSLUCHAČ NA REALTIME ZPRÁVY ---
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
                const msg = payload.new;
                
                // Získání a zformátování času pro novou zprávu
                let timeString = "";
                if (msg.created_at) {
                    const date = new Date(msg.created_at);
                    timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                    // Záloha: kdyby databáze nestihla čas poslat, vezmeme aktuální z prohlížeče
                    timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                const msgDiv = document.createElement('div');
                msgDiv.className = 'message-bubble';

                // Vykreslení bubliny i s časem
                msgDiv.innerHTML = `
                    <span class="message-author">${msg.user_email}</span>
                    <div class="message-text">${msg.content}</div>
                    <span class="message-time">${timeString}</span>
                `;
                
                messagesList.appendChild(msgDiv);
                
                // Když přijde nová zpráva, odscrollujeme automaticky dolů
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        )
        .subscribe();
}


// --- POSLUCHAČ NA REALTIME MÍSTNOSTI ---
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
                    console.log("Nová místnost pro mě v reálném čase:", room);
                    await renderRoomItem(room);
                }
            }
        )
        .subscribe();
}

// --- ROZŠÍŘENÉ FUNKCE NASTAVENÍ ---
const settingsEmailDisplay = document.getElementById('settings-email');
const settingsUsernameInput = document.getElementById('settings-username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const colorButtons = document.querySelectorAll('.color-btn');

// 1. Změna hlavní barvy (tohle může být venku, funguje nezávisle)
const savedColor = localStorage.getItem('chatAccentColor');
if (savedColor) {
    document.documentElement.style.setProperty('--primary', savedColor);
    if (colorButtons) {
        colorButtons.forEach(b => {
            if(b.getAttribute('data-color') === savedColor) b.classList.add('active');
        });
    }
}

if (colorButtons) {
    colorButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.target.getAttribute('data-color');
            document.documentElement.style.setProperty('--primary', color);
            localStorage.setItem('chatAccentColor', color);
            
            colorButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

// 2. Ošetření chybějícího HTML (spustí se jen, když jsi úspěšně vložil nové HTML)
if (settingsBtn && settingsEmailDisplay && settingsUsernameInput) {
    settingsBtn.addEventListener('click', async () => {
        if (currentUser) {
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
}

if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', async () => {
        const newUsername = settingsUsernameInput.value.trim();
        if (!newUsername) return;

        saveUsernameBtn.textContent = "Ukládám...";
        
        const { error } = await mySupabase
            .from('profiles')
            .update({ username: newUsername })
            .eq('id', currentUser.id);

        if (error) {
            alert("Chyba při ukládání jména: " + error.message);
        } else {
            saveUsernameBtn.textContent = "Uloženo ✔";
            setTimeout(() => saveUsernameBtn.textContent = "Uložit", 2000);
        }
    });
}

// Úplně na konci zavoláme kontrolu (vráceno do původní verze)
checkUserSession();