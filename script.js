let currentViewDate = new Date();
let musicData = [], statsData = [], monthlyStats = {}, activeFilter = null;

async function loadMusic() {
    try {
        const [dataRes, statsRes, monthlyRes] = await Promise.all([
            fetch('data.json'), fetch('stats.json'), fetch('monthly_stats.json')
        ]);
        musicData = await dataRes.json();
        statsData = await statsRes.json();
        monthlyStats = await monthlyRes.json();
        document.getElementById('unique-songs-count').innerText = statsData.length;
        document.getElementById('total-days-count').innerText = new Set(musicData.map(s => s.datum)).size;
        calculateStreak();
        renderCalendar();
    } catch (error) { console.error("Fout bij laden:", error); }
}

function calculateMonthlyHighlights(year, month) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const data = monthlyStats[monthKey];
    if (data) {
        document.querySelector('#month-top-song .content').innerText = data.top_song;
        document.querySelector('#month-top-artist .content').innerText = data.top_artist;
        document.querySelector('#month-total-listens .content').innerText = data.total_listens;
    }
}

function renderStatsDashboard() {
    // 1. Top Songs & Artists
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 10);
    const artistMap = {};
    statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    renderList('top-songs-list', topSongs.map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list', topArtists.map(a => [a[0], a[1], null]), 'x', 'artist');

    // 2. Albums
    const albumMap = {};
    statsData.forEach(s => {
        if (s.poster === "img/placeholder.png") return;
        if (!albumMap[s.poster]) albumMap[s.poster] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() };
        albumMap[s.poster].total += s.count;
        albumMap[s.poster].unique.add(s.titel);
    });
    const albums = Object.values(albumMap);
    renderList('top-albums-listens', [...albums].sort((a,b) => b.total - a.total).slice(0, 10).map(a => [`Album van ${a.artiest}`, a.total, a.poster]), 'x', 'album');
    renderList('top-albums-variety', [...albums].sort((a,b) => b.unique.size - a.unique.size).slice(0, 10).map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster]), ' songs', 'album');

    // 3. Obsessies & Ontdekkingsreizigers
    const artistGroups = {};
    statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
    
    const obsessions = [], explorers = [];
    Object.entries(artistGroups).forEach(([artist, songs]) => {
        // Obsessie: exact 1 liedje > 50 luisterbeurten
        if (songs.length === 1 && songs[0].count > 50) {
            obsessions.push([`${songs[0].titel} (${artist})`, songs[0].count, songs[0].poster]);
        }
        
        // Ontdekkingsreiziger: minstens 10 songs, GEEN enkele boven 100
        const hasMinSongs = songs.length >= 10;
        const allUnder100 = songs.every(s => s.count <= 100);
        if (hasMinSongs && allUnder100) explorers.push([artist, songs.length, null]);
    });
    
    renderList('obsessions-list', obsessions.sort((a,b) => b[1] - a[1]).slice(0, 10), 'x', 'song');
    renderList('variety-list', explorers.sort((a,b) => b[1] - a[1]).slice(0, 10), ' songs', 'artist');
}

function renderList(id, items, unit, type) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = items.map(([name, val, poster]) => {
        const escapedName = name.replace(/'/g, "\\'");
        let action = type === 'artist' ? `showArtistDetails('${escapedName}')` : (type === 'album' ? `showAlbumDetails('${poster}')` : `showSongSpotlight('${escapedName}')`);
        
        // Voeg afbeelding toe voor albums of liedjes
        const imgTag = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px; object-fit:cover;">` : '';
        
        return `<li onclick="${action}" style="display:flex; align-items:center;">
                    ${imgTag}
                    <span style="flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
                    <span class="point-badge" style="margin-left:10px;">${val}${unit}</span>
                </li>`;
    }).join('');
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid'), monthDisplay = document.getElementById('monthDisplay');
    if (!grid) return; grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    calculateMonthlyHighlights(year, month);
    const firstDay = new Date(year, month, 1).getDay(), offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const songs = musicData.filter(d => d.datum === dateStr);
        const cell = document.createElement('div'); cell.className = 'calendar-day';
        if (songs.length > 0) {
            cell.classList.add('has-data');
            if (activeFilter && !songs.some(s => s.artiest === activeFilter)) cell.classList.add('dimmed');
            cell.innerHTML = `<span class="day-number">${day}</span><img src="${songs[0].poster}">`;
            cell.onclick = () => openDagDetails(dateStr, songs);
        } else cell.innerHTML = `<span class="day-number">${day}</span>`;
        grid.appendChild(cell);
    }
}

function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 2) { resultsContainer.innerHTML = ""; return; }
    const matches = statsData.filter(s => s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query)).sort((a, b) => b.count - a.count).slice(0, 8);
    resultsContainer.innerHTML = matches.map(s => `
        <div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')">
            <img src="${s.poster}" onerror="this.src='img/placeholder.png'">
            <div class="search-item-info"><b>${s.titel}</b><br><small>${s.artiest}</small></div>
            <span class="point-badge">${s.count}x</span>
        </div>`).join('');
}

function showSongSpotlight(songFull) {
    // Splits artiest uit (Liedje (Artiest) -> Liedje en Artiest)
    let titel, artiest;
    if (songFull.includes('(') && songFull.includes(')')) {
        titel = songFull.split(' (')[0];
        artiest = songFull.split('(')[1].replace(')', '');
    } else if (songFull.includes(' - ')) {
        titel = songFull.split(' - ')[0];
        artiest = songFull.split(' - ')[1];
    } else {
        titel = songFull;
    }

    const s = statsData.find(x => x.titel.trim() === titel.trim()) || { poster: 'img/placeholder.png', artiest: artiest || 'Onbekend', count: '?' };
    
    document.getElementById('day-top-three-container').innerHTML = `
        <div class="vinyl-container"><div class="vinyl-record"></div><img src="${s.poster}" class="vinyl-cover"></div>
        <h2 style="text-align:center;margin-top:20px;">${titel}</h2>
        <p style="text-align:center;color:#1db954;font-weight:bold;">${s.artiest}</p>
        <p style="text-align:center;font-size:0.8rem;color:var(--text-muted);">Totaal ${s.count}x geluisterd</p>`;
    document.getElementById('modal-datum-titel').innerText = "Spotlight";
    document.getElementById('modal').classList.remove('hidden');
}

function showAlbumDetails(posterUrl) {
    const albumSongs = statsData.filter(s => s.poster === posterUrl).sort((a,b) => b.count - a.count);
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = `Album van ${albumSongs[0].artiest}`;
    container.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><img src="${posterUrl}" style="width:150px;border-radius:20px;box-shadow:var(--shadow-lg);"></div><div style="max-height:350px;overflow-y:auto;">${albumSongs.map(s => `<div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')"><b>${s.titel}</b><br><small>${s.count}x</small></div>`).join('')}</div>`;
    document.getElementById('modal').classList.remove('hidden');
}

function showArtistDetails(artist) {
    let cleanArtist = artist.includes('(') ? artist.split('(')[1].replace(')', '') : artist;
    const artistSongs = statsData.filter(s => s.artiest === cleanArtist.trim()).sort((a,b) => b.count - a.count);
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = cleanArtist;
    container.innerHTML = `<button onclick="applyCalendarFilter('${cleanArtist.replace(/'/g, "\\'")}')" class="apply-btn">📅 Bekijk op kalender</button><div style="max-height:400px;overflow-y:auto;margin-top:15px;">${artistSongs.map(s => `<div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')"><b>${s.titel}</b><br><small>${s.count}x</small></div>`).join('')}</div>`;
    document.getElementById('modal').classList.remove('hidden');
}

function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse();
    if (dates.length === 0) return;
    let streak = 0, today = new Date(); today.setHours(0,0,0,0);
    if (Math.floor((today - new Date(dates[0])) / 86400000) <= 1) {
        streak = 1; for (let i = 0; i < dates.length - 1; i++) { if (Math.floor((new Date(dates[i]) - new Date(dates[i+1])) / 86400000) === 1) streak++; else break; }
    }
    document.getElementById('streak-count').innerText = streak;
}

function openDagDetails(date, songs) {
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    container.innerHTML = songs.slice(0, 5).map((s, i) => `<div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')"><b>${s.titel}</b><br><small>${s.artiest}</small></div>`).join('');
    document.getElementById('modal').classList.remove('hidden');
}

function switchTab(tabName) {
    document.getElementById('view-calendar').classList.toggle('hidden', tabName !== 'calendar');
    document.getElementById('view-stats').classList.toggle('hidden', tabName !== 'stats');
    document.getElementById('btn-calendar').classList.toggle('active', tabName === 'calendar');
    document.getElementById('btn-stats').classList.toggle('active', tabName === 'stats');
    if (tabName === 'calendar') renderCalendar(); else renderStatsDashboard();
}

function applyCalendarFilter(artist) { activeFilter = artist; document.getElementById('modal').classList.add('hidden'); switchTab('calendar'); document.getElementById('resetFilter').classList.remove('hidden'); renderCalendar(); }
document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

loadMusic();