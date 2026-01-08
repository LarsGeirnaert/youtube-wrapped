// --- RECAP ---
function renderRecapSelector() {
    const selector = document.getElementById('recap-month-select');
    if(!selector) return;
    
    let allMonths = Object.keys(monthlyStats).sort();
    if (allMonths.length > 0) allMonths.shift();
    const months = allMonths.reverse();
    
    selector.innerHTML = months.map(m => {
        const [y, mn] = m.split('-');
        const label = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date(y, mn-1));
        return `<option value="${m}">${label}</option>`;
    }).join('');
    
    if(months.length > 0) renderRecap();
}

function renderRecap() {
    const selector = document.getElementById('recap-month-select');
    const monthKey = selector.value;
    const data = monthlyStats[monthKey];
    if(!data) return;

    const topSong = data.top_songs[0];
    if(topSong) {
        const songInfo = statsData.find(s => s.titel === topSong[1] && s.artiest === topSong[0]);
        document.getElementById('recap-hero-title').innerText = topSong[1];
        document.getElementById('recap-hero-artist').innerText = `${topSong[0]} (${topSong[2]} plays)`;
        const imgEl = document.getElementById('recap-hero-img');
        const poster = (songInfo && songInfo.poster !== 'img/placeholder.png') ? songInfo.poster : 'https://placehold.co/150x150/222/444?text=🎵';
        imgEl.src = poster;
    }

    document.getElementById('recap-total-plays').innerText = data.total_listens;
    document.getElementById('recap-unique-songs').innerText = data.unique_songs || '-';
    document.getElementById('recap-unique-artists').innerText = data.unique_artists || '-';

    const songsEl = document.getElementById('recap-top-songs');
    songsEl.innerHTML = data.top_songs.slice(0, 5).map((s, idx) => {
        const songName = `${s[1]} - ${s[0]}`;
        const info = statsData.find(x => x.titel === s[1] && x.artiest === s[0]);
        const escapedName = escapeStr(songName);
        const elementId = `recap-song-${idx}`;
        const poster = (info && info.poster) ? info.poster : 'img/placeholder.png';
        return `<li id="${elementId}" onclick="handleListClick('${escapedName}', 'song', '${poster}', '', '${elementId}')" style="display:flex; align-items:center;">
            <span style="width:20px; font-weight:bold; color:var(--spotify-green); margin-right:10px;">${idx+1}</span>
            <img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px;">
            <div style="flex-grow:1; overflow:hidden;"><span style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s[1]}</span><small style="color:#aaa;">${s[0]}</small></div>
            <span class="point-badge">${s[2]}x</span></li>`;
    }).join('');

    const artistsEl = document.getElementById('recap-top-artists');
    artistsEl.innerHTML = data.top_artists.slice(0, 5).map((a, idx) => {
        return `<li onclick="showArtistDetails('${escapeStr(a[0])}', ${a[1]}, '${monthKey}')" style="display:flex; align-items:center;">
            <span style="width:20px; font-weight:bold; color:var(--spotify-green); margin-right:10px;">${idx+1}</span>
            <div style="flex-grow:1;">${a[0]}</div>
            <span class="point-badge">${a[1]}x</span></li>`;
    }).join('');
}

function renderFunStats() {
    if(!chartData.fun_stats) return;
    const fs = chartData.fun_stats;
    document.getElementById('fun-total-days').innerText = fs.total_time_days;
    document.getElementById('fun-total-hours').innerText = `${fs.total_time_hours} uur totaal`;
    
    if(fs.busiest_day.date !== "-") {
        const d = new Date(fs.busiest_day.date);
        document.getElementById('fun-busiest-date').innerText = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
        document.getElementById('fun-busiest-count').innerText = fs.busiest_day.count;
    }
    
    document.getElementById('fun-discovery').innerText = fs.avg_discovery;
}

// --- STATS DASHBOARD ---
function renderStatsDashboard() {
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 10);
    const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    renderList('top-songs-list-small', topSongs.slice(0, 5).map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list-small', topArtists.slice(0, 5).map(a => [a[0], a[1], null]), 'x', 'artist');
    
    const totalListens = Object.values(artistMap).reduce((a, b) => a + b, 0);
    document.getElementById('total-listens-count').innerText = totalListens;

    renderList('top-songs-list', topSongs.map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list', topArtists.map(a => [a[0], a[1], null]), 'x', 'artist');
    renderList('comeback-list', comebackData.slice(0, 10).map(c => [`${c.titel} - ${c.artiest}`, `${c.gap}d stilte`, c.poster, c.periode]), '', 'song');

    if (streakData.songs_current) {
        renderList('current-song-streaks', streakData.songs_current.slice(0, 10).map(s => [`${s.titel} - ${s.artiest}`, s.streak, statsData.find(x=>x.titel===s.titel)?.poster, s.period]), ' d', 'song');
        renderList('top-song-streaks', streakData.songs_top.slice(0, 10).map(s => [`${s.titel} - ${s.artiest}`, s.streak, statsData.find(x=>x.titel===s.titel)?.poster, s.period]), ' d', 'song');
        renderList('current-artist-streaks', streakData.artists_current.slice(0, 10).map(a => [a.naam, a.streak, null, a.period]), ' d', 'artist');
        renderList('top-artist-streaks', streakData.artists_top.slice(0, 10).map(a => [a.naam, a.streak, null, a.period]), ' d', 'artist');
    }

    const albumMap = {};
    statsData.forEach(s => {
        if (s.poster === "img/placeholder.png") return;
        const key = getAlbumKey(s.poster, s.artiest);
        if (!albumMap[key]) albumMap[key] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() };
        albumMap[key].total += s.count; albumMap[key].unique.add(s.titel);
    });
    const albums = Object.values(albumMap);
    
    renderList('top-albums-listens', albums.sort((a,b) => b.total - a.total).slice(0, 10).map(a => [`Album van ${a.artiest}`, a.total, a.poster, a.artiest]), 'x', 'album');
    
    const sortedVariety = [...albums].sort((a,b) => b.unique.size - a.unique.size);
    const filteredVariety = []; const counts = {};
    for (const alb of sortedVariety) {
        if (filteredVariety.length >= 10) break;
        const art = alb.artiest; counts[art] = (counts[art] || 0) + 1;
        if (counts[art] <= 2) filteredVariety.push(alb);
    }
    renderList('top-albums-variety', filteredVariety.map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster, a.artiest]), ' songs', 'album');

    const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
    const obsessions = [], explorers = [];
    Object.entries(artistGroups).forEach(([artist, songs]) => {
        if (songs.length === 1 && songs[0].count > 50) obsessions.push([`${songs[0].titel} - ${artist}`, songs[0].count, songs[0].poster]);
        if (songs.length >= 10) explorers.push([artist, songs.length, null]);
    });
    renderList('obsessions-list', obsessions.sort((a,b) => b[1] - a[1]).slice(0, 10), 'x', 'song');
    renderList('variety-list', explorers.sort((a,b) => b[1] - a[1]).slice(0, 10), ' songs', 'artist');
}

function renderList(id, items, unit, type) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = items.map(([name, val, poster, extraInfo, period], index) => {
        const escapedName = escapeStr(name);
        const elementId = `${id}-${index}`;
        const clickAction = `handleListClick('${escapedName}', '${type}', '${poster}', '${escapeStr(extraInfo||'')}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px;">` : '';
        const sub = period ? `<br><small style="color:var(--text-muted); font-size:0.65rem;">${period}</small>` : '';
        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center;">
                    <span style="width:20px; font-size:0.7rem; font-weight:700; color:var(--spotify-green); margin-right:5px;">${index+1}.</span>
                    ${img}<div style="flex-grow:1; overflow:hidden;"><span style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${name}</span>${sub}</div>
                    <span class="point-badge" style="margin-left:10px;">${val}${unit}</span></li>`;
    }).join('');
}

// --- MODALS & DETAILS ---
function showAlbumDetails(posterUrl, artistName, isBack = false) {
    if (!isBack) addToHistory('album', arguments);
    const key = getAlbumKey(posterUrl, artistName);
    const albumSongs = statsData.filter(s => getAlbumKey(s.poster, s.artiest) === key).sort((a,b) => b.count - a.count);
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = `Album van ${artistName}`;
    container.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><img src="${posterUrl}" style="width:150px;border-radius:20px;box-shadow:var(--shadow-lg);">
        <div id="modal-action-container" style="display:flex; justify-content:center; gap:10px; margin-top:10px;"></div></div>
        <div style="max-height:350px;overflow-y:auto;">${albumSongs.map((s, idx) => {
            const escapedName = escapeStr(`${s.titel} - ${s.artiest}`);
            const elementId = `album-det-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;"><div style="flex-grow:1;"><b>${s.titel}</b></div><span class="point-badge">${s.count}x</span></div>`;
        }).join('')}</div>`;
    document.getElementById('modal').classList.remove('hidden');
    updateModalMergeButton();
}

function showArtistDetails(artist, overrideCount = null, monthKey = null, isBack = false) {
    if (!isBack) addToHistory('artist', arguments);
    let cleanArtist = artist.includes('(') ? artist.split('(')[1].replace(')', '') : artist;
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = cleanArtist;
    
    let songsToShow = []; let label = "totaal";
    if (monthKey && monthlyStats[monthKey] && monthlyStats[monthKey].artist_details[cleanArtist]) {
        songsToShow = monthlyStats[monthKey].artist_details[cleanArtist].map(i => { const info = statsData.find(x => x.artiest === cleanArtist && x.titel === i[0]); return { titel: i[0], count: i[1], poster: info ? info.poster : 'img/placeholder.png', artiest: cleanArtist }; });
        label = "deze maand";
    } else { songsToShow = statsData.filter(s => s.artiest === cleanArtist.trim()).sort((a,b) => b.count - a.count); }

    const albums = {};
    songsToShow.forEach(s => {
        if (s.poster && s.poster !== "img/placeholder.png") {
            const albumKey = getAlbumKey(s.poster, s.artiest);
            if (!albums[albumKey]) albums[albumKey] = { poster: s.poster, count: 0, title: 'Album' };
            albums[albumKey].count += s.count;
        }
    });
    const sortedAlbums = Object.values(albums).sort((a,b) => b.count - a.count);

    let html = '';
    if (overrideCount) html += `<p style="text-align:center; color:var(--spotify-green); margin-bottom:10px; font-weight:700;">${monthKey ? 'Deze maand' : 'Totaal'} ${overrideCount}x geluisterd</p>`;
    html += `<div id="modal-action-container" style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;"></div>`;

    if (sortedAlbums.length > 0) {
        html += `<h3 style="font-size:0.9rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Albums</h3>`;
        html += `<div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:15px; margin-bottom:10px;">`;
        sortedAlbums.forEach((alb, idx) => {
            const albEscaped = escapeStr(cleanArtist);
            const elementId = `artist-album-${idx}`;
            html += `<div id="${elementId}" onclick="handleAlbumClick('${alb.poster}', '${albEscaped}', '${elementId}')" style="flex-shrink:0; cursor:pointer; width:80px; text-align:center;">
                        <img src="${alb.poster}" style="width:80px; height:80px; border-radius:10px; object-fit:cover; margin-bottom:5px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                    </div>`;
        });
        html += `</div>`;
    }

    html += `<h3 style="font-size:0.9rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Songs</h3>`;
    html += `<div style="max-height:400px; overflow-y:auto;">${songsToShow.map((s, idx) => {
            const escapedName = escapeStr(`${s.titel} - ${cleanArtist}`);
            const elementId = `artist-det-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;"><img src="${s.poster}" style="width:35px;height:35px;border-radius:5px;margin-right:10px;"><div style="flex-grow:1;"><b>${s.titel}</b></div><span class="point-badge" style="background:rgba(255,255,255,0.05); color:white;">${s.count}x ${label}</span></div>`;
        }).join('')}</div>`;
    
    container.innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
    updateModalMergeButton();
}

function showSongSpotlight(songFull, overrideCount = null, isBack = false) {
    if (!isBack) addToHistory('song', arguments);
    let titel, artiest; if (songFull.includes(' - ')) { const p = songFull.split(' - '); titel = p[0]; artiest = p[1]; } else { titel = songFull; artiest = "Onbekend"; }
    const s = statsData.find(x => x.titel.trim() === titel.trim()) || { poster: 'img/placeholder.png', artiest: artiest, count: '?' };
    const countToDisplay = overrideCount !== null ? overrideCount : s.count;
    const label = overrideCount !== null ? "Deze maand" : "Totaal";
    document.getElementById('day-top-three-container').innerHTML = `<div class="vinyl-container"><div class="vinyl-record" style="width:200px; height:200px; background:#111; border-radius:50%; margin:0 auto; position:relative; background-image: repeating-radial-gradient(circle, #222 0, #111 2px, #222 4px);"></div><img src="${s.poster}" style="position:absolute; inset:25%; width:50%; height:50%; border-radius:50%; object-fit:cover;"></div><h2 style="text-align:center;margin-top:20px;">${titel}</h2><p style="text-align:center;color:#1db954;font-weight:bold;">${s.artiest || artiest}</p><p style="text-align:center;font-size:0.9rem;color:var(--text-muted); margin-top:10px;">${label} <b>${countToDisplay}x</b> geluisterd</p>`;
    document.getElementById('modal-datum-titel').innerText = "Spotlight"; document.getElementById('modal').classList.remove('hidden');
}

function showTop100(category, isBack = false) {
    if (!isBack) addToHistory('list', arguments);
    const container = document.getElementById('day-top-three-container');
    const titleEl = document.getElementById('modal-datum-titel');
    let items = [];
    const monthKey = `${currentViewDate.getFullYear()}-${String(currentViewDate.getMonth() + 1).padStart(2, '0')}`;
    const mData = monthlyStats[monthKey];

    if (category === 'songs') { titleEl.innerText = "Top 100 Songs"; items = [...statsData].sort((a, b) => b.count - a.count).slice(0, 100).map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster, 'song']); }
    else if (category === 'artists') { titleEl.innerText = "Top 100 Artiesten"; const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; }); items = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 100).map(a => [a[0], a[1], null, 'artist']); }
    else if (category.includes('albums')) {
        const albumMap = {}; statsData.forEach(s => { if (s.poster === "img/placeholder.png") return; const key = getAlbumKey(s.poster, s.artiest); if (!albumMap[key]) albumMap[key] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() }; albumMap[key].total += s.count; albumMap[key].unique.add(s.titel); });
        const albums = Object.values(albumMap);
        if (category === 'albums-listens') { titleEl.innerText = "Top 100 Albums (Luisterbeurten)"; items = albums.sort((a,b) => b.total - a.total).slice(0, 100).map(a => [`Album van ${a.artiest}`, a.total, a.poster, 'album']); }
        else { titleEl.innerText = "Top 100 Albums (Variatie)"; const sorted = albums.sort((a,b) => b.unique.size - a.unique.size); const filtered = []; const counts = {}; for (const alb of sorted) { if (filtered.length >= 100) break; const art = alb.artiest; counts[art] = (counts[art] || 0) + 1; if (counts[art] <= 2) filtered.push(alb); } items = filtered.map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster, 'album']); }
    }
    else if (category.includes('streaks')) { const key = category.split('streaks-')[1].replace('-', '_'); items = streakData[key].map(s => [s.titel ? `${s.titel} - ${s.artiest}` : s.naam, s.streak, statsData.find(x => x.titel === s.titel)?.poster, s.titel ? 'song' : 'artist', s.period]); }
    else if (category === 'month-songs') { titleEl.innerText = "Top Songs Deze Maand"; items = mData ? mData.top_songs.map(s => [`${s[1]} - ${s[0]}`, s[2], statsData.find(x => x.titel === s[1] && x.artiest === s[0])?.poster, 'song']) : []; }
    else if (category === 'month-artists') { titleEl.innerText = "Top Artiesten Deze Maand"; items = mData ? mData.top_artists.map(a => [a[0], a[1], null, 'artist']) : []; }
    else if (category === 'obsessions') { const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); }); items = Object.entries(artistGroups).filter(([a, songs]) => songs.length === 1 && songs[0].count > 50).sort((a, b) => b[1][0].count - a[1][0].count).slice(0, 100).map(([a, songs]) => [`${songs[0].titel} - ${a}`, songs[0].count, songs[0].poster, 'song']); }
    else if (category === 'explorers') { const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); }); items = Object.entries(artistGroups).filter(([a, songs]) => songs.length >= 10).sort((a, b) => b[1].length - a[1].length).slice(0, 100).map(([a, songs]) => [a, songs.length, null, 'artist']); }

    container.innerHTML = `<ul class="ranking-list" style="max-height: 500px; overflow-y: auto;">` + items.map(([name, val, poster, type, unit, period], index) => {
        const escapedName = escapeStr(name);
        const elementId = `top100-${index}`;
        let actualType = type; let albumArtist = '';
        if (name.startsWith('Album van ')) { 
            actualType = 'album'; 
            albumArtist = name.replace('Album van ', ''); 
        } 
        const clickAction = `handleListClick('${escapedName}', '${actualType}', '${poster}', '${escapeStr(albumArtist)}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted);">${period}</small>` : '';
        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center; padding: 12px 15px;">
                    <span style="width: 25px; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>
                    ${img}<div style="flex-grow:1; overflow:hidden;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>${sub}</div>
                    <span class="point-badge">${val}${unit||''}</span></li>`;
    }).join('') + `</ul>`;
    document.getElementById('modal').classList.remove('hidden');
}

function addToHistory(viewType, args) {
    modalHistory.push({ type: viewType, args: Array.from(args) });
}

function closeModal() {
    modalHistory.pop();
    if (modalHistory.length > 0) {
        const prev = modalHistory[modalHistory.length - 1]; 
        if (prev.type === 'artist') showArtistDetails(...prev.args, true);
        else if (prev.type === 'album') showAlbumDetails(...prev.args, true);
        else if (prev.type === 'song') showSongSpotlight(...prev.args, true);
        else if (prev.type === 'list') showTop100(...prev.args, true);
    } else {
        document.getElementById('modal').classList.add('hidden');
        modalHistory = [];
    }
}

// --- CALENDAR ---
function renderCalendar() {
    const grid = document.getElementById('calendarGrid'), monthDisplay = document.getElementById('monthDisplay');
    if (!grid) return; grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    const firstDay = new Date(year, month, 1).getDay(), offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) { grid.appendChild(document.createElement('div')); }
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const songs = musicData.filter(d => d.datum === dateStr);
        const cell = document.createElement('div'); cell.className = 'calendar-day';
        if (songs.length > 0) { cell.classList.add('has-data'); cell.innerHTML = `<span class="day-number">${day}</span><img src="${songs[0].poster}">`; cell.onclick = () => openDagDetails(dateStr, songs); }
        else cell.innerHTML = `<span class="day-number">${day}</span>`;
        grid.appendChild(cell);
    }
}

function openDagDetails(date, songs) { const container = document.getElementById('day-top-three-container'); document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }); container.innerHTML = songs.slice(0, 5).map((s, i) => `<div class="search-item" onclick="showSongSpotlight('${escapeStr(s.titel)} - ${escapeStr(s.artiest)}') " style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px; cursor:pointer;"><span style="font-weight:800; color:var(--spotify-green); margin-right:15px; width:15px;">${i+1}</span><img src="${s.poster}" style="width:45px; height:45px; border-radius:8px; margin-right:15px;"><div class="search-item-info"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div></div>`).join(''); document.getElementById('modal').classList.remove('hidden'); }

function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results'); 
    if (query.length < 2) { resultsContainer.innerHTML = ""; return; }

    const artistMap = {};
    statsData.forEach(s => {
        const cleanName = s.artiest;
        if (!artistMap[cleanName]) artistMap[cleanName] = { name: cleanName, count: 0 };
        artistMap[cleanName].count += s.count;
    });
    
    const artistMatches = Object.values(artistMap).filter(a => a.name.toLowerCase().includes(query)).sort((a,b) => b.count - a.count).slice(0, 3);
    const songMatches = statsData.filter(s => s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query)).sort((a, b) => b.count - a.count).slice(0, 8);

    let html = '';
    if (artistMatches.length > 0) {
        html += `<div style="padding: 5px 10px; font-size: 0.75rem; color: #aaa; text-transform:uppercase; font-weight:bold;">🎤 Artiesten</div>`;
        html += artistMatches.map((a, idx) => {
            const escapedName = escapeStr(a.name);
            const elementId = `search-art-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'artist', null, '', '${elementId}')" style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:5px; cursor:pointer;">
                        <div style="width:40px; height:40px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center; margin-right:12px; font-size:1.2rem;">🎤</div>
                        <div style="flex-grow:1;"><b>${a.name}</b><br><small style="color:var(--text-muted);">Artiest</small></div>
                        <span class="point-badge">${a.count}x</span>
                    </div>`;
        }).join('');
        html += `<div style="margin-bottom:15px;"></div>`; 
    }

    if (songMatches.length > 0) {
        html += `<div style="padding: 5px 10px; font-size: 0.75rem; color: #aaa; text-transform:uppercase; font-weight:bold;">🎵 Liedjes</div>`;
        html += songMatches.map((s, idx) => {
            const name = `${s.titel} - ${s.artiest}`;
            const escapedName = escapeStr(name);
            const elementId = `search-song-${idx}`;
            const posterSrc = (s.poster && s.poster !== 'img/placeholder.png') ? s.poster : 'https://placehold.co/64x64/1e1e1e/444444?text=🎵';
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:5px; cursor:pointer;"><img src="${posterSrc}" onerror="this.src='https://placehold.co/64x64/1e1e1e/444444?text=🎵'" style="width:40px; height:40px; border-radius:6px; margin-right:12px;"><div style="flex-grow:1;"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div><span class="point-badge">${s.count}x</span></div>`;
        }).join('');
    }

    if (artistMatches.length === 0 && songMatches.length === 0) {
        html = `<div style="padding:20px; text-align:center; color:#777;">Geen resultaten gevonden.</div>`;
    }
    resultsContainer.innerHTML = html;
}

// --- MAIN ---
function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse(); 
    if (dates.length === 0) {
        document.getElementById('streak-count').innerText = 0;
        return;
    }
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastListenDate = dates[0];
    if (lastListenDate !== todayStr && lastListenDate !== yesterdayStr) {
        document.getElementById('streak-count').innerText = 0;
        return;
    }
    let streak = 1;
    for (let i = 0; i < dates.length - 1; i++) { 
        const current = new Date(dates[i]);
        const previous = new Date(dates[i+1]);
        const diffTime = Math.abs(current - previous);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) streak++;
        else break;
    }
    document.getElementById('streak-count').innerText = streak;
}

function switchTab(tabName) { 
    document.getElementById('view-calendar').classList.toggle('hidden', tabName !== 'calendar'); 
    document.getElementById('view-stats').classList.toggle('hidden', tabName !== 'stats'); 
    document.getElementById('view-graphs').classList.toggle('hidden', tabName !== 'graphs');
    document.getElementById('view-recap').classList.toggle('hidden', tabName !== 'recap');
    
    document.getElementById('btn-calendar').classList.toggle('active', tabName === 'calendar'); 
    document.getElementById('btn-stats').classList.toggle('active', tabName === 'stats');
    document.getElementById('btn-graphs').classList.toggle('active', tabName === 'graphs');
    document.getElementById('btn-recap').classList.toggle('active', tabName === 'recap');
    
    if (tabName === 'calendar') renderCalendar(); 
    else if (tabName === 'stats') renderStatsDashboard();
    else if (tabName === 'graphs') {
        renderCharts();
        updateComparisonChart(); 
    }
    else if (tabName === 'recap') {
        renderRecapSelector();
    }
}

function applyCalendarFilter(artist) { activeFilter = artist; document.getElementById('modal').classList.add('hidden'); switchTab('calendar'); document.getElementById('resetFilter').classList.remove('hidden'); renderCalendar(); }
document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => closeModal();
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

// --- BOOTSTRAP ---
loadMusic();