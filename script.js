let currentViewDate = new Date();
let musicData = [], statsData = [], monthlyStats = {}, streakData = {}, activeFilter = null;

async function loadMusic() {
    try {
        const [dataRes, statsRes, monthlyRes, streaksRes] = await Promise.all([
            fetch('data.json'), fetch('stats.json'), fetch('monthly_stats.json'), fetch('streaks.json')
        ]);
        musicData = await dataRes.json();
        statsData = await statsRes.json();
        monthlyStats = await monthlyRes.json();
        streakData = await streaksRes.json();
        document.getElementById('unique-songs-count').innerText = statsData.length;
        document.getElementById('total-days-count').innerText = new Set(musicData.map(s => s.datum)).size;
        calculateStreak();
        renderCalendar();
    } catch (error) { console.error("Fout bij laden:", error); }
}

function showTop100(category) {
    const container = document.getElementById('day-top-three-container');
    const titleEl = document.getElementById('modal-datum-titel');
    let items = [];

    const monthKey = `${currentViewDate.getFullYear()}-${String(currentViewDate.getMonth() + 1).padStart(2, '0')}`;
    const mData = monthlyStats[monthKey];

    if (category === 'songs') {
        titleEl.innerText = "Top 100 Songs (Totaal)";
        items = [...statsData].sort((a, b) => b.count - a.count).slice(0, 100).map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster, 'song']);
    } else if (category === 'artists') {
        titleEl.innerText = "Top 100 Artiesten (Totaal)";
        const artistMap = {};
        statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
        items = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 100).map(a => [a[0], a[1], null, 'artist']);
    } else if (category === 'month-songs') {
        titleEl.innerText = `Top Songs in ${new Intl.DateTimeFormat('nl-NL', { month: 'long' }).format(currentViewDate)}`;
        items = mData ? mData.top_songs.map(s => [`${s[1]} - ${s[0]}`, s[2], statsData.find(x => x.titel === s[1] && x.artiest === s[0])?.poster, 'song']) : [];
    } else if (category === 'month-artists') {
        titleEl.innerText = `Top Artiesten in ${new Intl.DateTimeFormat('nl-NL', { month: 'long' }).format(currentViewDate)}`;
        items = mData ? mData.top_artists.map(a => [a[0], a[1], null, 'artist']) : [];
    } else if (category.includes('streaks')) {
        const key = category.split('streaks-')[1].replace('-', '_');
        titleEl.innerText = "Top Streaks";
        items = streakData[key].map(s => [s.titel ? `${s.titel} - ${s.artiest}` : s.naam, s.streak, statsData.find(x => x.titel === s.titel)?.poster, s.titel ? 'song' : 'artist', s.period]);
    } else if (category.includes('albums')) {
        const albumMap = {};
        statsData.forEach(s => {
            if (s.poster === "img/placeholder.png") return;
            if (!albumMap[s.poster]) albumMap[s.poster] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() };
            albumMap[s.poster].total += s.count; albumMap[s.poster].unique.add(s.titel);
        });
        const albumArray = Object.values(albumMap);
        if (category === 'albums-listens') {
            titleEl.innerText = "Top 100 Albums (Luisterbeurten)";
            items = albumArray.sort((a,b) => b.total - a.total).slice(0, 100).map(a => [`Album van ${a.artiest}`, a.total, a.poster, 'album']);
        } else {
            titleEl.innerText = "Top 100 Albums (Grootste Variatie)";
            items = albumArray.sort((a,b) => b.unique.size - a.unique.size).slice(0, 100).map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster, 'album']);
        }
    } else if (category === 'obsessions') {
        titleEl.innerText = "De Grootste Obsessies";
        const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
        items = Object.entries(artistGroups)
            .filter(([a, songs]) => songs.length === 1 && songs[0].count > 50)
            .sort((a, b) => b[1][0].count - a[1][0].count).slice(0, 100)
            .map(([a, songs]) => [`${songs[0].titel} (${a})`, songs[0].count, songs[0].poster, 'song']);
    } else if (category === 'explorers') {
        titleEl.innerText = "Ontdekkingsreizigers";
        const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
        items = Object.entries(artistGroups)
            .filter(([a, songs]) => songs.length >= 10 && songs.every(s => s.count <= 100))
            .sort((a, b) => b[1].length - a[1].length).slice(0, 100)
            .map(([a, songs]) => [a, songs.length, null, 'artist']);
    }

    container.innerHTML = `<ul class="ranking-list" style="max-height: 500px; overflow-y: auto;">` + items.map(([name, val, poster, type, period], index) => {
        const escapedName = name.replace(/'/g, "\\'");
        const action = type === 'artist' ? `showArtistDetails('${escapedName}')` : (type === 'album' ? `showAlbumDetails('${poster}')` : `showSongSpotlight('${escapedName}')`);
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px;">` : '';
        const sub = period ? `<br><small style="font-size:0.65rem; color:var(--text-muted);">${period}</small>` : '';
        return `<li onclick="${action}" style="display:flex; align-items:center; padding: 12px 15px;">
                    <span style="width: 25px; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>
                    ${img}<div style="flex-grow:1; overflow:hidden;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>${sub}</div>
                    <span class="point-badge">${val}</span>
                </li>`;
    }).join('') + `</ul>`;

    document.getElementById('modal').classList.remove('hidden');
}

function calculateMonthlyHighlights(year, month) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const data = monthlyStats[monthKey];
    const songsEl = document.getElementById('month-songs-list');
    const artistsEl = document.getElementById('month-artists-list');
    const totalEl = document.getElementById('month-total-listens-count');

    if (data && songsEl) {
        songsEl.innerHTML = data.top_songs.slice(0, 5).map(s => {
            const songName = `${s[1]} - ${s[0]}`;
            const info = statsData.find(x => x.titel === s[1] && x.artiest === s[0]);
            return `<li onclick="showSongSpotlight('${songName.replace(/'/g, "\\'")}', ${s[2]})">
                <img src="${info ? info.poster : 'img/placeholder.png'}" style="width:20px; height:20px; border-radius:4px; margin-right:8px;">
                <span style="flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${songName}</span>
                <span style="color:var(--text-muted); font-size:0.7rem; margin-left:5px;">${s[2]}x</span>
            </li>`;
        }).join('');
        artistsEl.innerHTML = data.top_artists.slice(0, 5).map(a => `<li onclick="showArtistDetails('${a[0].replace(/'/g, "\\'")}', ${a[1]}, '${monthKey}')">
            <span style="flex-grow:1;">${a[0]}</span><span class="point-badge">${a[1]}x</span></li>`).join('');
        totalEl.innerText = data.total_listens;
    } else if (songsEl) {
        songsEl.innerHTML = "<li>Geen data</li>"; artistsEl.innerHTML = "<li>Geen data</li>"; totalEl.innerText = 0;
    }
}

function renderStatsDashboard() {
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 10);
    const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    renderList('top-songs-list', topSongs.map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list', topArtists.map(a => [a[0], a[1], null]), 'x', 'artist');
    
    renderList('current-song-streaks', streakData.songs_current.slice(0, 10).map(s => [`${s.titel} - ${s.artiest}`, s.streak, statsData.find(x=>x.titel===s.titel)?.poster, s.period]), ' d', 'song');
    renderList('top-song-streaks', streakData.songs_top.slice(0, 10).map(s => [`${s.titel} - ${s.artiest}`, s.streak, statsData.find(x=>x.titel===s.titel)?.poster, s.period]), ' d', 'song');
    renderList('current-artist-streaks', streakData.artists_current.slice(0, 10).map(a => [a.naam, a.streak, null, a.period]), ' d', 'artist');
    renderList('top-artist-streaks', streakData.artists_top.slice(0, 10).map(a => [a.naam, a.streak, null, a.period]), ' d', 'artist');

    const albumMap = {};
    statsData.forEach(s => {
        if (s.poster === "img/placeholder.png") return;
        if (!albumMap[s.poster]) albumMap[s.poster] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() };
        albumMap[s.poster].total += s.count; albumMap[s.poster].unique.add(s.titel);
    });
    const albums = Object.values(albumMap);
    renderList('top-albums-listens', [...albums].sort((a,b) => b.total - a.total).slice(0, 10).map(a => [`Album van ${a.artiest}`, a.total, a.poster]), 'x', 'album');
    renderList('top-albums-variety', [...albums].sort((a,b) => b.unique.size - a.unique.size).slice(0, 10).map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster]), ' songs', 'album');

    const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
    const obsessions = [], explorers = [];
    Object.entries(artistGroups).forEach(([artist, songs]) => {
        if (songs.length === 1 && songs[0].count > 50) obsessions.push([`${songs[0].titel} (${artist})`, songs[0].count, songs[0].poster]);
        const hasMinSongs = songs.length >= 10; const allUnder100 = songs.every(s => s.count <= 100);
        if (hasMinSongs && allUnder100) explorers.push([artist, songs.length, null]);
    });
    renderList('obsessions-list', obsessions.sort((a,b) => b[1] - a[1]).slice(0, 10), 'x', 'song');
    renderList('variety-list', explorers.sort((a,b) => b[1] - a[1]).slice(0, 10), ' songs', 'artist');
}

function renderList(id, items, unit, type) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = items.map(([name, val, poster, period], index) => {
        const escapedName = name.replace(/'/g, "\\'");
        let action = type === 'artist' ? `showArtistDetails('${escapedName}')` : (type === 'album' ? `showAlbumDetails('${poster}')` : `showSongSpotlight('${escapedName}')`);
        const imgTag = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px; object-fit:cover;">` : '';
        const periodTag = period ? `<br><small style="color:var(--text-muted); font-size:0.65rem;">${period}</small>` : '';
        return `<li onclick="${action}" style="display:flex; align-items:center;">
                    <span style="width: 20px; font-size: 0.7rem; font-weight: 700; color: var(--spotify-green); margin-right: 5px;">${index + 1}.</span>
                    ${imgTag}<div style="flex-grow:1; overflow:hidden;"><span style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${name}</span>${periodTag}</div>
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
    for (let i = 0; i < offset; i++) { grid.appendChild(document.createElement('div')); }
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

function showArtistDetails(artist, overrideCount = null, monthKey = null) {
    let cleanArtist = artist.includes('(') ? artist.split('(')[1].replace(')', '') : artist;
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = cleanArtist;
    let songsToShow = []; let countLabelSuffix = "totaal";
    if (monthKey && monthlyStats[monthKey] && monthlyStats[monthKey].artist_details[cleanArtist]) {
        songsToShow = monthlyStats[monthKey].artist_details[cleanArtist].map(item => {
            const info = statsData.find(x => x.artiest === cleanArtist && x.titel === item[0]);
            return { titel: item[0], count: item[1], poster: info ? info.poster : 'img/placeholder.png' };
        });
        countLabelSuffix = "deze maand";
    } else { songsToShow = statsData.filter(s => s.artiest === cleanArtist.trim()).sort((a,b) => b.count - a.count); }
    const countLabel = overrideCount !== null ? `<p style="text-align:center; color:var(--spotify-green); margin-bottom:10px; font-weight:700;">${monthKey ? 'Deze maand' : 'Totaal'} ${overrideCount}x geluisterd</p>` : '';
    container.innerHTML = `${countLabel}<button onclick="applyCalendarFilter('${cleanArtist.replace(/'/g, "\\'")}')" class="apply-btn" style="background:var(--spotify-green); border:none; padding:10px; width:100%; border-radius:10px; font-weight:700; cursor:pointer; margin-bottom:15px;">📅 Bekijk op kalender</button>
        <div style="max-height:400px; overflow-y:auto;">
            ${songsToShow.map(s => `<div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${cleanArtist.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;">
                <img src="${s.poster}" style="width:35px;height:35px;border-radius:5px;margin-right:10px;">
                <div style="flex-grow:1;"><b>${s.titel}</b></div><span class="point-badge" style="background:rgba(255,255,255,0.05); color:white;">${s.count}x</span>
            </div>`).join('')}
        </div>`;
    document.getElementById('modal').classList.remove('hidden');
}

function showSongSpotlight(songFull, overrideCount = null) {
    let titel, artiest;
    if (songFull.includes(' - ')) { const p = songFull.split(' - '); titel = p[0]; artiest = p[1]; } 
    else if (songFull.includes(' (')) { const p = songFull.split(' ('); titel = p[0]; artiest = p[1].replace(')', ''); }
    else { titel = songFull; artiest = "Onbekend"; }
    const s = statsData.find(x => x.titel.trim() === titel.trim()) || { poster: 'img/placeholder.png', artiest: artiest, count: '?' };
    const countToDisplay = overrideCount !== null ? overrideCount : s.count;
    const label = overrideCount !== null ? "Deze maand" : "Totaal";
    document.getElementById('day-top-three-container').innerHTML = `<div class="vinyl-container"><div class="vinyl-record" style="width:200px; height:200px; background:#111; border-radius:50%; margin:0 auto; position:relative; background-image: repeating-radial-gradient(circle, #222 0, #111 2px, #222 4px);"></div><img src="${s.poster}" style="position:absolute; inset:25%; width:50%; height:50%; border-radius:50%; object-fit:cover;"></div>
        <h2 style="text-align:center;margin-top:20px;">${titel}</h2><p style="text-align:center;color:#1db954;font-weight:bold;">${s.artiest || artiest}</p>
        <p style="text-align:center;font-size:0.9rem;color:var(--text-muted); margin-top:10px;">${label} <b>${countToDisplay}x</b> geluisterd</p>`;
    document.getElementById('modal-datum-titel').innerText = "Spotlight";
    document.getElementById('modal').classList.remove('hidden');
}

function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 2) { resultsContainer.innerHTML = ""; return; }
    const matches = statsData.filter(s => s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query)).sort((a, b) => b.count - a.count).slice(0, 8);
    resultsContainer.innerHTML = matches.map(s => `<div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:5px; cursor:pointer;">
        <img src="${s.poster}" onerror="this.src='img/placeholder.png'" style="width:40px; height:40px; border-radius:6px; margin-right:12px;"><div class="search-item-info" style="flex-grow:1;"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div>
        <span class="point-badge">${s.count}x</span></div>`).join('');
}

function openDagDetails(date, songs) {
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    container.innerHTML = songs.slice(0, 5).map((s, i) => `<div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px; cursor:pointer;">
        <span style="font-weight:800; color:var(--spotify-green); margin-right:15px; width:15px;">${i+1}</span><img src="${s.poster}" style="width:45px; height:45px; border-radius:8px; margin-right:15px;"><div class="search-item-info"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div></div>`).join('');
    document.getElementById('modal').classList.remove('hidden');
}

function switchTab(tabName) {
    document.getElementById('view-calendar').classList.toggle('hidden', tabName !== 'calendar');
    document.getElementById('view-stats').classList.toggle('hidden', tabName !== 'stats');
    document.getElementById('btn-calendar').classList.toggle('active', tabName === 'calendar');
    document.getElementById('btn-stats').classList.toggle('active', tabName === 'stats');
    if (tabName === 'calendar') renderCalendar(); else renderStatsDashboard();
}

function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse();
    if (dates.length === 0) return;
    let streak = 0; 
    for (let i = 0; i < dates.length - 1; i++) { if (Math.floor((new Date(dates[i]) - new Date(dates[i+1])) / 86400000) === 1) streak++; else break; }
    document.getElementById('streak-count').innerText = streak + 1;
}

function applyCalendarFilter(artist) { activeFilter = artist; document.getElementById('modal').classList.add('hidden'); switchTab('calendar'); document.getElementById('resetFilter').classList.remove('hidden'); renderCalendar(); }
document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

loadMusic();