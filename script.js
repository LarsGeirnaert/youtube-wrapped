let currentViewDate = new Date();
let musicData = [];
let statsData = [];
let activeFilter = null;

// --- 1. TAB NAVIGATIE ---
function switchTab(tabName) {
    document.getElementById('view-calendar').classList.toggle('hidden', tabName !== 'calendar');
    document.getElementById('view-stats').classList.toggle('hidden', tabName !== 'stats');
    document.getElementById('btn-calendar').classList.toggle('active', tabName === 'calendar');
    document.getElementById('btn-stats').classList.toggle('active', tabName === 'stats');
    
    if (tabName === 'calendar') renderCalendar();
    else renderStatsDashboard();
}

// --- 2. DATA LADEN ---
async function loadMusic() {
    try {
        const [dataRes, statsRes] = await Promise.all([
            fetch('data.json'),
            fetch('stats.json')
        ]);
        musicData = await dataRes.json();
        statsData = await statsRes.json();
        
        document.getElementById('unique-songs-count').innerText = statsData.length;
        document.getElementById('total-days-count').innerText = new Set(musicData.map(s => s.datum)).size;
        
        calculateStreak();
        renderCalendar();
    } catch (error) { console.error("Fout bij laden:", error); }
}

// --- 3. MAANDELIJKSE HIGHLIGHTS LOGICA ---
function calculateMonthlyHighlights(year, month) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthlySongs = musicData.filter(s => s.datum.startsWith(monthStr));
    
    const songCounts = {};
    const artistCounts = {};
    
    monthlySongs.forEach(s => {
        const songKey = `${s.titel} - ${s.artiest}`;
        songCounts[songKey] = (songCounts[songKey] || 0) + 1;
        artistCounts[s.artiest] = (artistCounts[s.artiest] || 0) + 1;
    });

    const topSong = Object.entries(songCounts).sort((a,b) => b[1] - a[1])[0];
    const topArtist = Object.entries(artistCounts).sort((a,b) => b[1] - a[1])[0];

    document.getElementById('highlights-title').innerText = `Highlights van ${new Intl.DateTimeFormat('nl-NL', { month: 'long' }).format(currentViewDate)}`;
    
    document.getElementById('month-top-song').querySelector('.content').innerText = topSong ? topSong[0] : "Geen data";
    document.getElementById('month-top-artist').querySelector('.content').innerText = topArtist ? topArtist[0] : "Geen data";
    document.getElementById('month-total-listens').querySelector('.content').innerText = monthlySongs.length;
}

// --- 4. ZOEKFUNCTIE ---
function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 2) { resultsContainer.innerHTML = ""; return; }

    const matches = statsData.filter(s => 
        s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query)
    ).sort((a, b) => b.count - a.count).slice(0, 8);

    resultsContainer.innerHTML = matches.map(s => `
        <div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')">
            <img src="${s.poster}" onerror="this.src='img/placeholder.png'">
            <div class="search-item-info">
                <span class="search-item-title">${s.titel}</span>
                <span class="search-item-artist">${s.artiest}</span>
            </div>
            <span class="search-item-count">${s.count}x</span>
        </div>`).join('');
}

// --- 5. STATISTIEKEN & INZICHTEN ---
function renderStatsDashboard() {
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 10);
    const artistMap = {};
    statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 10);

    renderList('top-songs-list', topSongs.map(s => [`${s.titel} - ${s.artiest}`, s.count]), 'x', 'song');
    renderList('top-artists-list', topArtists, 'x', 'artist');

    const artistGroups = {};
    statsData.forEach(s => {
        if (!artistGroups[s.artiest]) artistGroups[s.artiest] = [];
        artistGroups[s.artiest].push(s);
    });

    const obsessions = [];
    const explorers = [];

    Object.entries(artistGroups).forEach(([artist, songs]) => {
        if (songs.length === 1 && songs[0].count > 100) obsessions.push([`${songs[0].titel} (${artist})`, songs[0].count]);
        if (songs.length > 10 && songs.every(s => s.count < 100)) explorers.push([artist, songs.length]);
    });

    renderList('obsessions-list', obsessions.sort((a,b) => b[1] - a[1]), 'x', 'song');
    renderList('variety-list', explorers.sort((a,b) => b[1] - a[1]), ' songs', 'artist');
}

function renderList(id, items, unit, type) {
    const el = document.getElementById(id);
    if (!el) return;
    if (items.length === 0) { el.innerHTML = "<li>Geen data...</li>"; return; }
    el.innerHTML = items.map(([name, val]) => {
        const escapedName = name.replace(/'/g, "\\'");
        const clickAction = type === 'artist' ? `showArtistDetails('${escapedName}')` : `showSongSpotlight('${escapedName}')`;
        return `<li onclick="${clickAction}"><span>${name}</span><span class="point-badge">${val}${unit}</span></li>`;
    }).join('');
}

// --- 6. INTERACTIE (ARTIEST DETAILS) ---
function showArtistDetails(artist) {
    let cleanArtist = artist.includes('(') ? artist.split('(')[1].replace(')', '') : artist;
    const artistSongs = statsData.filter(s => s.artiest === cleanArtist).sort((a,b) => b.count - a.count);
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = cleanArtist;
    
    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <button onclick="applyCalendarFilter('${cleanArtist.replace(/'/g, "\\'")}')" class="apply-btn">📅 Bekijk op kalender</button>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${artistSongs.map(s => `
                <div class="search-item" style="background:rgba(255,255,255,0.05); margin-bottom:10px;" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')">
                    <img src="${s.poster}" style="width:45px; height:45px; border-radius:8px;">
                    <div class="search-item-info"><b>${s.titel}</b><br><small>${s.count}x</small></div>
                </div>`).join('')}
        </div>`;
    document.getElementById('modal').classList.remove('hidden');
}

function applyCalendarFilter(artist) {
    activeFilter = artist;
    document.getElementById('modal').classList.add('hidden');
    switchTab('calendar');
    document.getElementById('resetFilter').classList.remove('hidden');
    renderCalendar();
}

function showSongSpotlight(songFull) {
    const parts = songFull.split(' - ');
    const s = statsData.find(x => x.titel === parts[0] && x.artiest === parts[1]) || { poster: 'img/placeholder.png' };
    document.getElementById('day-top-three-container').innerHTML = `
        <div class="vinyl-container"><div class="vinyl-record"></div><img src="${s.poster}" class="vinyl-cover" onerror="this.src='img/placeholder.png'"></div>
        <h2 style="text-align:center; margin-top:20px;">${parts[0]}</h2>
        <p style="text-align:center; color:var(--spotify-green); font-weight:bold;">${parts[1]}</p>
        <p style="text-align:center; font-size: 0.8rem; color: var(--text-muted);">Totaal ${s.count}x</p>`;
    document.getElementById('modal-datum-titel').innerText = "Spotlight";
    document.getElementById('modal').classList.remove('hidden');
}

// --- 7. KALENDER RENDERING ---
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthDisplay = document.getElementById('monthDisplay');
    grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    
    // Bereken Highlights voor de nieuwe maand
    calculateMonthlyHighlights(year, month);

    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < startOffset; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));
    
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const daySongs = musicData.filter(d => d.datum === dateStr);
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        if (daySongs.length > 0) {
            cell.classList.add('has-data');
            if (activeFilter && !daySongs.some(s => s.artiest === activeFilter)) cell.classList.add('dimmed');
            cell.innerHTML = `<span class="day-number">${day}</span><img src="${daySongs[0].poster}">`;
            cell.onclick = () => openDagDetails(dateStr, daySongs);
        } else cell.innerHTML = `<span class="day-number">${day}</span>`;
        grid.appendChild(cell);
    }
}

function openDagDetails(date, songs) {
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    container.innerHTML = songs.slice(0, 5).map((s, i) => `
        <div class="search-item" style="background:rgba(255,255,255,0.05); margin-bottom:10px; border:none; cursor:default;">
            <b style="color:var(--spotify-green); width:20px;">${i+1}</b>
            <img src="${s.poster}" style="width:45px; height:45px; border-radius:8px;">
            <div class="search-item-info"><b>${s.titel}</b><br><small>${s.artiest}</small></div>
        </div>`).join('');
    document.getElementById('modal').classList.remove('hidden');
}

function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse();
    if (dates.length === 0) return;
    let streak = 0, today = new Date();
    today.setHours(0,0,0,0);
    let checkDate = new Date(dates[0]);
    if (Math.floor((today - checkDate) / 86400000) <= 1) {
        streak = 1;
        for (let i = 0; i < dates.length - 1; i++) {
            if (Math.floor((new Date(dates[i]) - new Date(dates[i+1])) / 86400000) === 1) streak++; else break;
        }
    }
    document.getElementById('streak-count').innerText = streak;
}

document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

loadMusic();