let currentViewDate = new Date();
let musicData = [];
let activeFilter = null;

// --- 1. TAB NAVIGATIE ---
function switchTab(tabName) {
    const calendarView = document.getElementById('view-calendar');
    const statsView = document.getElementById('view-stats');
    const btnCalendar = document.getElementById('btn-calendar');
    const btnStats = document.getElementById('btn-stats');

    if (tabName === 'calendar') {
        calendarView.classList.remove('hidden');
        statsView.classList.add('hidden');
        btnCalendar.classList.add('active');
        btnStats.classList.remove('active');
        renderCalendar();
    } else {
        calendarView.classList.add('hidden');
        statsView.classList.remove('hidden');
        btnCalendar.classList.remove('active');
        btnStats.classList.add('active');
        renderDashboard();
    }
}

// --- 2. DATA LADEN ---
async function loadMusic() {
    try {
        const response = await fetch('data.json');
        musicData = await response.json();
        
        const uniqueSongs = new Set(musicData.map(s => `${s.titel}-${s.artiest}`)).size;
        document.getElementById('unique-songs-count').innerText = uniqueSongs;
        
        calculateStreak();
        renderDashboard();
        renderCalendar();
    } catch (error) { 
        console.error("Fout bij laden van data.json:", error); 
    }
}

// --- 3. ZOEKFUNCTIE ---
function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    
    if (query.length < 2) {
        resultsContainer.innerHTML = "";
        return;
    }

    // Tel hoe vaak elk uniek liedje voorkomt
    const matches = {};
    musicData.forEach(item => {
        const fullTitle = `${item.titel} - ${item.artiest}`;
        if (fullTitle.toLowerCase().includes(query)) {
            if (!matches[fullTitle]) {
                matches[fullTitle] = { count: 0, poster: item.poster, artiest: item.artiest, titel: item.titel };
            }
            matches[fullTitle].count++;
        }
    });

    const sortedMatches = Object.entries(matches)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    if (sortedMatches.length === 0) {
        resultsContainer.innerHTML = "<p style='padding:10px; color:#666;'>Geen resultaten gevonden...</p>";
        return;
    }

    resultsContainer.innerHTML = sortedMatches.map(([name, data]) => `
        <div class="search-item" onclick="showSongSpotlight('${name.replace(/'/g, "\\'")}')">
            <img src="${data.poster}" onerror="this.src='img/placeholder.png'">
            <div class="search-item-info">
                <span class="search-item-title">${data.titel}</span>
                <span class="search-item-artist">${data.artiest}</span>
            </div>
            <span class="search-item-count">${data.count}x</span>
        </div>
    `).join('');
}

// --- 4. STATISTIEKEN BEREKENEN ---
function renderDashboard() {
    const songPoints = {};
    const artistCounts = {};
    const uniekeDagen = new Set(musicData.map(item => item.datum));

    // We groeperen data per dag om rangorde te bepalen
    const dailyData = {};
    musicData.forEach(item => {
        if (!dailyData[item.datum]) dailyData[item.datum] = [];
        dailyData[item.datum].push(item);
    });

    Object.values(dailyData).forEach(daySongs => {
        daySongs.forEach((song, index) => {
            if (index < 5) {
                const points = 5 - index;
                const songKey = `${song.titel} - ${song.artiest}`;
                songPoints[songKey] = (songPoints[songKey] || 0) + points;
                artistCounts[song.artiest] = (artistCounts[song.artiest] || 0) + 1;
            }
        });
    });

    document.getElementById('total-days-count').innerText = uniekeDagen.size;

    const topSongs = Object.entries(songPoints).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const topArtists = Object.entries(artistCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);

    renderList('top-songs-list', topSongs, 'pt', 'song');
    renderList('top-artists-list', topArtists, 'x', 'artist');
}

function renderList(id, items, unit, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(([name, val]) => {
        const escapedName = name.replace(/'/g, "\\'");
        const clickAction = type === 'artist' ? `showArtistDetails('${escapedName}')` : `showSongSpotlight('${escapedName}')`;
        return `<li onclick="${clickAction}"><span>${name}</span><span class="point-badge">${val}${unit}</span></li>`;
    }).join('');
}

// --- 5. STREAK & INTERACTIE ---
function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse();
    if (dates.length === 0) return;
    let streak = 0;
    let today = new Date();
    today.setHours(0,0,0,0);
    let checkDate = new Date(dates[0]);
    if (Math.floor((today - checkDate) / 86400000) <= 1) {
        streak = 1;
        for (let i = 0; i < dates.length - 1; i++) {
            let diff = Math.floor((new Date(dates[i]) - new Date(dates[i+1])) / 86400000);
            if (diff === 1) streak++; else break;
        }
    }
    document.getElementById('streak-count').innerText = streak;
}

function showArtistDetails(artist) {
    activeFilter = artist;
    switchTab('calendar');
    document.getElementById('resetFilter').classList.remove('hidden');
    renderCalendar();
}

function showSongSpotlight(songFull) {
    const parts = songFull.split(' - ');
    const songData = musicData.find(s => s.titel === parts[0] && s.artiest === parts[1]) || { poster: 'img/placeholder.png' };
    const container = document.getElementById('day-top-three-container');
    container.innerHTML = `
        <div class="vinyl-container"><div class="vinyl-record"></div><img src="${songData.poster}" class="vinyl-cover" onerror="this.src='img/placeholder.png'"></div>
        <h2 style="text-align:center; margin-top:20px;">${parts[0]}</h2>
        <p style="text-align:center; color:var(--spotify-green); font-weight:bold;">${parts[1]}</p>
    `;
    document.getElementById('modal-datum-titel').innerText = "Spotlight";
    document.getElementById('modal').classList.remove('hidden');
}

// --- 6. KALENDER ---
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthDisplay = document.getElementById('monthDisplay');
    grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
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

document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

loadMusic();