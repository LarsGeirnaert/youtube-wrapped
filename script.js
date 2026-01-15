let currentViewDate = new Date();
// Zorg dat fullHistoryData hierin staat
let musicData = [], fullHistoryData = [], statsData = [], monthlyStats = {}, streakData = {}, chartData = {}, comebackData = [], activeFilter = null;
let oldFavoritesData = []; 
let calendarIndex = {}; 
let charts = {};
let modalHistory = [];
let mergeMode = false;
let selectedForMerge = []; 
let existingCorrections = [];
let fileHandle = null;
let comparisonItems = []; 
let activeSongFilter = null; // <--- TOEVOEGEN
let focusStreakRange = null;

const DB_NAME = 'MuziekDagboekDB';
const STORE_NAME = 'Settings';

// ==========================================
// 2. GENERIEKE HULPFUNCTIES (MOETEN BOVENAAN)
// ==========================================

function escapeStr(str) {
    if (!str) return '';
    // FIX: Forceer naar string om crashes te voorkomen als er per ongeluk een object in komt
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function getAlbumKey(posterUrl, artist) {
    if (!posterUrl || posterUrl.includes('placeholder')) return artist.toLowerCase();
    const uniqueId = posterUrl.split('/image/thumb/')[1] || posterUrl;
    return `${artist.toLowerCase()}_${uniqueId}`;
}

function addToHistory(viewType, args) {
    modalHistory.push({ type: viewType, args: Array.from(args) });
}

function renderList(id, items, unit, type) {
    const el = document.getElementById(id); if (!el) return;
    
    // items is nu: [name, val, poster, extraInfo, period, start, end]
    el.innerHTML = items.map(([name, val, poster, extraInfo, period, start, end], index) => {
        const escapedName = escapeStr(name);
        const elementId = `${id}-${index}`;
        const clickAction = `handleListClick('${escapedName}', '${type}', '${poster}', '${escapeStr(extraInfo||'')}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px; flex-shrink:0;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${period}</small>` : '';
        
        let badgeAttr = '';
        let badgeStyle = 'flex-shrink:0;';
        
        if (unit && unit.trim() === 'd') {
            let filterArtist = name;
            let filterSong = null;

            if (type === 'song' && name.includes(' - ')) {
                const parts = name.split(' - ');
                filterArtist = parts[parts.length - 1]; 
                filterSong = parts.slice(0, parts.length - 1).join(' - '); 
            } else if (type === 'artist') {
                filterArtist = name;
            }

            if (start && end) {
                // Hier wordt de klikactie ingesteld
                badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(filterArtist)}', '${start}', '${end}', '${escapeStr(filterSong||'')}')" title="Bekijk streak in Kalender"`;
                badgeStyle += ' cursor:pointer; border:1px solid var(--spotify-green); background:rgba(29,185,84,0.15); transition:0.2s;';
            } else {
                badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(filterArtist)}')" title="Bekijk in Kalender"`;
                badgeStyle += ' cursor:pointer; border:1px solid var(--spotify-green); background:rgba(29,185,84,0.15); transition:0.2s;';
            }
        }

        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center; padding: 12px 15px; overflow:hidden;">
                    <span style="width: 25px; flex-shrink:0; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>
                    ${img}
                    <div style="flex-grow:1; min-width:0; overflow:hidden; margin-right:10px;">
                        <span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>
                        ${sub}
                    </div>
                    <span class="point-badge" ${badgeAttr} style="${badgeStyle}" 
                          onmouseover="this.style.background='var(--spotify-green)';this.style.color='black'" 
                          onmouseout="this.style.background='rgba(29,185,84,0.15)';this.style.color='var(--spotify-green)'">
                        ${val}${unit||''}
                    </span>
                </li>`;
    }).join('');
}
function closeModal() {
    modalHistory.pop(); 
    
    if (modalHistory.length > 0) {
        const prev = modalHistory[modalHistory.length - 1]; 
        
        // FIX: Correcte parameters doorgeven bij terugkeren
        if (prev.type === 'artist') {
            showArtistDetails(prev.args[0], prev.args[1] || null, prev.args[2] || null, true);
        }
        else if (prev.type === 'album') {
            showAlbumDetails(prev.args[0], prev.args[1], true);
        }
        else if (prev.type === 'song') {
            showSongSpotlight(prev.args[0], prev.args[1] || null, true);
        }
        else if (prev.type === 'list') {
            showTop100(prev.args[0], true);
        }
    } else {
        document.getElementById('modal').classList.add('hidden');
        modalHistory = [];
    }
}

// ==========================================
// 3. UI ACTIES (DETAILS & KLIKKEN)
// ==========================================

function handleListClick(name, type, poster, albumArtist, elementId) {
    if (document.getElementById('modal').classList.contains('hidden')) {
        modalHistory = [];
    }
    
    if (mergeMode) {
        if (type === 'song' || type === 'album') toggleMergeSelection(name, type, poster, albumArtist, elementId);
        else alert("Je kan alleen liedjes of albums samenvoegen.");
    } else {
        if (type === 'artist') showArtistDetails(name);
        else if (type === 'album') showAlbumDetails(poster, albumArtist);
        else showSongSpotlight(name);
    }
}

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

function handleAlbumClick(poster, artist, elementId) {
    if (mergeMode) {
        // FIX: Merge support voor albums in artiesten detail view
        const albumName = `Album van ${artist}`;
        toggleMergeSelection(albumName, 'album', poster, artist, elementId);
    } else {
        showAlbumDetails(poster, artist);
    }
}

function showSongSpotlight(songFull, overrideCount = null, isBack = false) {
    if (!isBack) addToHistory('song', arguments);
    
    let titel, artiest; 
    if (songFull.includes(' - ')) { 
        const lastDashIndex = songFull.lastIndexOf(' - ');
        titel = songFull.substring(0, lastDashIndex);
        artiest = songFull.substring(lastDashIndex + 3);
    } else { 
        titel = songFull; artiest = "Onbekend"; 
    }
    
    const s = statsData.find(x => x.titel === titel && x.artiest === artiest) || { poster: 'img/placeholder.png', artiest: artiest, count: 0 };
    const countToDisplay = overrideCount !== null ? overrideCount : s.count;
    const label = overrideCount !== null ? "Deze maand" : "Totaal";

    const artistSongs = statsData.filter(x => x.artiest === artiest).sort((a, b) => b.count - a.count);
    const rankIndex = artistSongs.findIndex(x => x.titel === titel);
    const rank = rankIndex !== -1 ? `#${rankIndex + 1}` : '-';
    
    const totalArtistPlays = artistSongs.reduce((sum, item) => sum + item.count, 0);
    const percentage = totalArtistPlays > 0 ? ((s.count / totalArtistPlays) * 100).toFixed(1) + '%' : '0%';

    // Haal de streaks op
    const topStreaks = getSongStreaks(titel, artiest);
    
    let html = `
        <div class="vinyl-container">
            <div class="vinyl-record" style="width:200px; height:200px; background:#111; border-radius:50%; margin:0 auto; position:relative; background-image: repeating-radial-gradient(circle, #222 0, #111 2px, #222 4px);"></div>
            <img src="${s.poster}" style="position:absolute; inset:25%; width:50%; height:50%; border-radius:50%; object-fit:cover;">
        </div>
        <h2 style="text-align:center; margin-top:10px; line-height:1.2;">${titel}</h2>
        <p style="text-align:center; color:var(--spotify-green); font-weight:bold; margin-bottom:20px;">${artiest}</p>

        <div class="spotlight-stats-grid">
            <div class="spotlight-stat-box"><span class="spotlight-stat-val">${countToDisplay}x</span><span class="spotlight-stat-label">${label} Plays</span></div>
            <div class="spotlight-stat-box"><span class="spotlight-stat-val">${rank}</span><span class="spotlight-stat-label">Populair van ${artiest}</span></div>
            <div class="spotlight-stat-box" style="grid-column: span 2;"><span class="spotlight-stat-val">${percentage}</span><span class="spotlight-stat-label">van alle ${artiest} luisterbeurten</span></div>
        </div>
    `;

    if (topStreaks.length > 0) {
        html += `<h3 style="font-size:0.9rem; color:#aaa; margin-bottom:10px; text-transform:uppercase; border-bottom:1px solid #333; padding-bottom:5px;">🔥 Beste Streaks</h3>`;
        html += `<div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:5px;">`;
        
        topStreaks.forEach(st => {
            const d1 = new Date(st.start).toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: '2-digit'});
            const d2 = new Date(st.end).toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: '2-digit'});
            const periodStr = d1 === d2 ? d1 : `${d1} ➔ ${d2}`;
            
            // Format datums voor de onclick functie (YYYY-MM-DD)
            // Let op: st.start en st.end zijn Date objecten hier (vanuit getSongStreaks)
            const sStr = st.start.toISOString().split('T')[0];
            const eStr = st.end.toISOString().split('T')[0];

            // HIER MAKEN WE DE REGEL KLIKBAAR
            html += `
                <div class="streak-row" onclick="applyCalendarFilter('${escapeStr(artiest)}', '${sStr}', '${eStr}', '${escapeStr(titel)}')" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
                    <span class="streak-days">${st.count} dagen</span>
                    <span class="streak-dates">${periodStr}</span>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        html += `<p style="text-align:center; color:#555; font-size:0.8rem; margin-top:20px;">Nog geen streaks (2+ dagen) voor dit nummer.</p>`;
    }

    document.getElementById('day-top-three-container').innerHTML = html;
    document.getElementById('modal-datum-titel').innerText = "Details"; 
    document.getElementById('modal').classList.remove('hidden');
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
    // --- STREAK CORRECTIE HIER ---
    else if (category.includes('streaks')) { 
        const key = category.split('streaks-')[1].replace('-', '_'); 
        items = streakData[key].map(s => [
            s.titel ? `${s.titel} - ${s.artiest}` : s.naam, 
            s.streak, 
            statsData.find(x => x.titel === s.titel)?.poster, 
            s.titel ? 'song' : 'artist', 
            null, // <--- CORRECTIE: Lege plek voor extraInfo
            s.period,
            s.start, s.end
        ]); 
    }
    // --- EINDE CORRECTIE ---
    else if (category === 'month-songs') { titleEl.innerText = "Top Songs Deze Maand"; items = mData ? mData.top_songs.map(s => [`${s[1]} - ${s[0]}`, s[2], statsData.find(x => x.titel === s[1] && x.artiest === s[0])?.poster, 'song']) : []; }
    else if (category === 'month-artists') { titleEl.innerText = "Top Artiesten Deze Maand"; items = mData ? mData.top_artists.map(a => [a[0], a[1], null, 'artist']) : []; }
    else if (category === 'obsessions') { const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); }); items = Object.entries(artistGroups).filter(([a, songs]) => songs.length === 1 && songs[0].count > 50).sort((a, b) => b[1][0].count - a[1][0].count).slice(0, 100).map(([a, songs]) => [`${songs[0].titel} - ${a}`, songs[0].count, songs[0].poster, 'song']); }
    else if (category === 'explorers') { const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); }); items = Object.entries(artistGroups).filter(([a, songs]) => songs.length >= 10).sort((a, b) => b[1].length - a[1].length).slice(0, 100).map(([a, songs]) => [a, songs.length, null, 'artist']); }

    container.innerHTML = `<ul class="ranking-list" style="max-height: 500px; overflow-y: auto;">` + items.map(([name, val, poster, type, unit, period, start, end], index) => {
        const escapedName = escapeStr(name);
        const elementId = `top100-${index}`;
        let actualType = type; let albumArtist = '';
        if (name.startsWith('Album van ')) { 
            actualType = 'album'; 
            albumArtist = name.replace('Album van ', ''); 
        } 
        const clickAction = `handleListClick('${escapedName}', '${actualType}', '${poster}', '${escapeStr(albumArtist)}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px; flex-shrink:0;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${period}</small>` : '';
        
        let badgeAttr = '';
        let badgeStyle = 'flex-shrink:0;';
        if (unit && unit.trim() === 'd') {
             let artistArg = actualType === 'song' ? name.split(' - ').pop() : name;
             if (start && end) {
                 badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(artistArg)}', '${start}', '${end}')"`;
                 badgeStyle += ' cursor:pointer; border:1px solid var(--spotify-green); background:rgba(29,185,84,0.15); transition:0.2s;';
             }
        }

        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center; padding: 12px 15px; overflow:hidden;">
                    <span style="width: 25px; flex-shrink:0; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>
                    ${img}
                    <div style="flex-grow:1; min-width:0; overflow:hidden; margin-right:10px;">
                        <span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>
                        ${sub}
                    </div>
                    <span class="point-badge" ${badgeAttr} style="${badgeStyle}" onmouseover="this.style.background='var(--spotify-green)';this.style.color='black'" onmouseout="this.style.background='rgba(29,185,84,0.15)';this.style.color='var(--spotify-green)'">${val}${unit||''}</span></li>`;
    }).join('') + `</ul>`;
    document.getElementById('modal').classList.remove('hidden');
}
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

// ==========================================
// 4. DATABASE & BESTANDEN
// ==========================================

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveHandleToDB(handle) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, 'correctionsHandle');
    return tx.complete;
}

async function getHandleFromDB() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('correctionsHandle');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function linkFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
            multiple: false
        });
        fileHandle = handle;
        await saveHandleToDB(fileHandle);
        const file = await fileHandle.getFile();
        const text = await file.text();
        if(text) existingCorrections = JSON.parse(text);
        updateFileStatus(true);
        alert("✅ Bestand gekoppeld!");
    } catch (err) { console.error(err); alert("Kon bestand niet koppelen."); }
}

async function verifyPermission(handle, readWrite) {
    const options = {};
    if (readWrite) options.mode = 'readwrite';
    if ((await handle.queryPermission(options)) === 'granted') return true;
    if ((await handle.requestPermission(options)) === 'granted') return true;
    return false;
}

async function saveCorrections() {
    if (fileHandle) {
        try {
            const hasPermission = await verifyPermission(fileHandle, true);
            if (!hasPermission) return false;
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(existingCorrections, null, 2));
            await writable.close();
            return true;
        } catch (err) { console.error("Auto-save mislukt:", err); return false; }
    } else {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(existingCorrections, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "corrections.json");
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
        return false; 
    }
}

function updateFileStatus(isConnected) {
    const statusEl = document.getElementById('file-status');
    const btnEl = document.getElementById('btn-link-file');
    if (isConnected) {
        statusEl.innerHTML = "💾 Opslaan: <b>Automatisch</b>";
        statusEl.style.color = "#1db954";
        statusEl.style.borderColor = "#1db954";
        btnEl.classList.add('hidden');
    } else {
        statusEl.innerHTML = "💾 Opslaan: Handmatig";
        statusEl.style.color = "#aaa";
        statusEl.style.borderColor = "#333";
        btnEl.classList.remove('hidden');
    }
}

// ==========================================
// 5. STREAKS & MERGE & SEARCH
// ==========================================

function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse(); 

    if (dates.length === 0) {
        const el = document.getElementById('streak-count');
        if(el) el.innerText = 0;
        return;
    }

    let streak = 1; 
    const oneDay = 86400000;

    for (let i = 0; i < dates.length - 1; i++) { 
        const currentDate = new Date(dates[i]); 
        const prevDate = new Date(dates[i+1]);  
        
        const currentUTC = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const prevUTC = Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());

        const diffDays = (currentUTC - prevUTC) / oneDay;
        
        if (diffDays === 1) {
            streak++; 
        } else {
            break; 
        } 
    }

    const el = document.getElementById('streak-count');
    if(el) el.innerText = streak;
}

function toggleMergeMode() {
    mergeMode = !mergeMode;
    const btn = document.getElementById('btn-merge-mode');
    const instr = document.getElementById('merge-instructions');
    const bar = document.getElementById('merge-action-bar');
    
    if (mergeMode) {
        if(btn) {
            btn.innerText = "❌ Stop Merge Mode";
            btn.style.background = "red";
            btn.style.borderColor = "red";
            btn.style.color = "white";
        }
        if(instr) instr.classList.remove('hidden');
        if(bar) bar.classList.add('visible');
        selectedForMerge = [];
        updateMergeUI();
    } else {
        if(btn) {
            btn.innerText = "Start Merge Mode";
            btn.style.background = "rgba(255,165,0,0.2)";
            btn.style.borderColor = "orange";
            btn.style.color = "orange";
        }
        if(instr) instr.classList.add('hidden');
        if(bar) bar.classList.remove('visible');
        document.querySelectorAll('.merge-selected').forEach(el => el.classList.remove('merge-selected'));
    }
    updateModalMergeButton();
}

function updateModalMergeButton() {
    const container = document.getElementById('modal-action-container');
    if (!container) return;

    const artistNameEl = document.getElementById('modal-datum-titel');
    const isArtistView = artistNameEl && !artistNameEl.innerText.startsWith('Album van');
    let artistName = isArtistView ? artistNameEl.innerText : '';

    let html = '';
    if (isArtistView) {
        html += `<button onclick="applyCalendarFilter('${escapeStr(artistName)}')" class="apply-btn" style="background:var(--spotify-green); border:none; padding:10px; width:auto; border-radius:10px; font-weight:700; cursor:pointer;">📅 Kalender</button>`;
    }

    if (mergeMode) {
        html += `<button onclick="toggleMergeMode()" style="background:red;border:1px solid red;color:white;width:auto;padding:10px 15px;border-radius:10px;font-weight:bold;cursor:pointer;">❌ Stop Merge</button>`;
        if (selectedForMerge.length >= 2) {
            html += `<button onclick="showMergeModal()" style="background:var(--spotify-green); border:1px solid var(--spotify-green); color:black; width:auto; padding:10px 15px; border-radius:10px; font-weight:bold; cursor:pointer; animation: pulse 1s infinite;">✅ BEVESTIG MERGE (${selectedForMerge.length})</button>`;
        }
    } else {
        html += `<button onclick="toggleMergeMode()" style="background:rgba(255,165,0,0.2);border:1px solid orange;color:orange;width:auto;padding:10px 15px;border-radius:10px;font-weight:bold;cursor:pointer;">🛠️ Start Merge</button>`;
    }
    container.innerHTML = html;
}

function toggleMergeSelection(name, type, poster, albumArtist, elementId) {
    if (selectedForMerge.length > 0 && selectedForMerge[0].type !== type) { alert(`Je kan geen ${type} met een ${selectedForMerge[0].type} mixen.`); return; }
    let item = {};
    let key = "";
    if (type === 'song') {
        let parts = name.split(' - ');
        if (parts.length > 1) { item.artiest = parts.pop().trim(); item.titel = parts.join(' - ').trim(); }
        else { item = { titel: "", artiest: name.trim() }; }
        key = `song|${item.artiest}|${item.titel}`.toLowerCase();
    } else if (type === 'album') {
        const realArtist = albumArtist || name.replace('Album van ', '');
        item = { artiest: realArtist, poster: poster, displayTitle: name };
        key = `album|${realArtist}|${poster}`;
    }
    const index = selectedForMerge.findIndex(x => x.key === key);
    const el = document.getElementById(elementId);
    if (index > -1) { selectedForMerge.splice(index, 1); if(el) el.classList.remove('merge-selected'); }
    else { selectedForMerge.push({ key: key, naam: name, item: item, type: type }); if(el) el.classList.add('merge-selected'); }
    updateMergeUI();
}

function updateMergeUI() {
    const el = document.getElementById('merge-count');
    if(el) el.innerText = `${selectedForMerge.length} geselecteerd`;
    updateModalMergeButton();
}

function showMergeModal() {
    if (selectedForMerge.length < 2) { alert("Selecteer minstens 2 items."); return; }
    
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = "Kies de Hoofdversie";
    
    let html = `<p style="text-align:center;margin-bottom:15px;color:#ccc;">Welke versie (en cover) moet blijven?</p>`;
    html += `<form id="merge-form" style="max-height:300px;overflow-y:auto;margin-bottom:20px;">`;
    
    selectedForMerge.forEach((obj, idx) => {
        const label = obj.type === 'song' ? obj.item.titel : obj.item.displayTitle;
        const sub = obj.item.artiest;
        
        let posterSrc = 'https://placehold.co/64x64/1e1e1e/444444?text=💿';
        if (obj.item.poster && obj.item.poster !== 'img/placeholder.png') {
            posterSrc = obj.item.poster;
        }

        html += `<label class="radio-item" style="display:flex; align-items:center; padding:10px; cursor:pointer;">
                    <input type="radio" name="merge-target" value="${idx}" ${idx===0?'checked':''} style="margin-right:15px; transform:scale(1.3);">
                    <img src="${posterSrc}" style="width:60px; height:60px; border-radius:6px; object-fit:cover; margin-right:15px; background:#222;">
                    <div style="flex-grow:1; overflow:hidden;">
                        <span style="font-weight:600; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</span>
                        <span style="font-size:0.8rem; color:#aaa;">${sub}</span>
                    </div>
                 </label>`;
    });
    
    html += `</form><button onclick="confirmMerge()" class="apply-btn">✅ Samenvoegen & Opslaan</button>`;
    
    container.innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
}

async function confirmMerge() {
    const radios = document.getElementsByName('merge-target');
    let selectedIndex = -1;
    for (const r of radios) { if (r.checked) { selectedIndex = parseInt(r.value); break; } }
    
    if (selectedIndex === -1) return;
    
    const targetObj = selectedForMerge[selectedIndex];
    let newCount = 0;

    if (targetObj.type === 'song') {
        // --- LIEDJES MERGEN ---
        selectedForMerge.forEach((obj, idx) => {
            if (idx !== selectedIndex) {
                existingCorrections.push({ original: obj.item, target: targetObj.item });
                newCount++;
            }
        });
    } else if (targetObj.type === 'album') {
        // --- ALBUMS MERGEN (FIX) ---
        const targetArtist = targetObj.item.artiest;
        const targetPoster = targetObj.item.poster;

        selectedForMerge.forEach((sourceObj, idx) => {
            if (idx !== selectedIndex) {
                // Bereken de unieke sleutel van het album dat we weg willen hebben
                const sourceKey = getAlbumKey(sourceObj.item.poster, sourceObj.item.artiest);

                // Zoek alle liedjes in je database die bij die sleutel horen
                const songsToMove = statsData.filter(s => getAlbumKey(s.poster, s.artiest) === sourceKey);

                songsToMove.forEach(song => {
                    existingCorrections.push({
                        original: { titel: song.titel, artiest: song.artiest },
                        // De target krijgt dezelfde titel, maar de artiest en poster van het 'Hoofd Album'
                        target: { titel: song.titel, artiest: targetArtist, poster: targetPoster }
                    });
                    newCount++;
                });
            }
        });
    }

    const isAuto = await saveCorrections();
    let msg = `Succes! ${newCount} correctieregels toegevoegd.`;
    if (!isAuto) msg += " (Bestand gedownload).";
    
    alert(msg);
    document.getElementById('modal').classList.add('hidden');
    toggleMergeMode(); 
}

// ==========================================
// 6. DASHBOARD & STATS & CHARTS
// ==========================================

function renderStatsDashboard() {
    console.log("[DEBUG] renderStatsDashboard gestart...");
    
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 10);
    const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    // Top 5 blokjes (klein)
    renderList('top-songs-list-small', topSongs.slice(0, 5).map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list-small', topArtists.slice(0, 5).map(a => [a[0], a[1], null]), 'x', 'artist');
    
    const totalListens = Object.values(artistMap).reduce((a, b) => a + b, 0);
    const el = document.getElementById('total-listens-count');
    if(el) el.innerText = totalListens;

    // Grote lijsten (Algemeen)
    renderList('top-songs-list', topSongs.map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list', topArtists.map(a => [a[0], a[1], null]), 'x', 'artist');
    renderList('comeback-list', comebackData.slice(0, 10).map(c => [`${c.titel} - ${c.artiest}`, `${c.gap}d stilte`, c.poster, c.periode]), '', 'song');
    renderList('old-favorites-list', oldFavoritesData.slice(0, 10).map(c => [`${c.titel} - ${c.artiest}`, `${c.days_silent}d stil`, c.poster, `Laatst: ${c.last_played}`]), '', 'song');

    // --- STREAKS: HIER ZAT DE FOUT ---
    // We zorgen nu dat de array PRECIES 7 items heeft: [Naam, Waarde, Poster, Extra, Periode, Start, Eind]
    if (streakData.songs_current) {
        renderList('current-song-streaks', streakData.songs_current.slice(0, 10).map(s => [
            `${s.titel} - ${s.artiest}`, 
            s.streak, 
            statsData.find(x=>x.titel===s.titel)?.poster, 
            null, // Placeholder
            s.period, 
            s.start, s.end // DATUMS!
        ]), ' d', 'song');

        renderList('top-song-streaks', streakData.songs_top.slice(0, 10).map(s => [
            `${s.titel} - ${s.artiest}`, 
            s.streak, 
            statsData.find(x=>x.titel===s.titel)?.poster, 
            null, 
            s.period,
            s.start, s.end // DATUMS!
        ]), ' d', 'song');

        renderList('current-artist-streaks', streakData.artists_current.slice(0, 10).map(a => [
            a.naam, a.streak, null, null, 
            a.period, 
            a.start, a.end // DATUMS!
        ]), ' d', 'artist');

        renderList('top-artist-streaks', streakData.artists_top.slice(0, 10).map(a => [
            a.naam, a.streak, null, null, 
            a.period, 
            a.start, a.end // DATUMS!
        ]), ' d', 'artist');
    }

    // Albums & Obsessies (Rest ongewijzigd)
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
// --- CALENDAR RENDERING FIX (FILTERED VIEW) ---
function renderCalendar() {
    const grid = document.getElementById('calendarGrid'), monthDisplay = document.getElementById('monthDisplay');
    if (!grid) return; grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    const firstDay = new Date(year, month, 1).getDay(), offset = firstDay === 0 ? 6 : firstDay - 1;
    
    for (let i = 0; i < offset; i++) { grid.appendChild(document.createElement('div')); }
    
    // Hulpfunctie voor streak visualisatie
    const checkDateHasListen = (y, m, d) => {
        if (!activeFilter) return false;
        const checkStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return calendarIndex[checkStr] && calendarIndex[checkStr][activeFilter];
    };

    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div'); cell.className = 'calendar-day';
        let hasListen = false;
        let poster = "";
        let clickData = [];

        if (activeFilter) {
            // FILTER MODE
            if (calendarIndex[dateStr] && calendarIndex[dateStr][activeFilter]) {
                hasListen = true;
                const entry = calendarIndex[dateStr][activeFilter];
                poster = entry.poster;
                
                clickData = entry.songs.map(songObj => {
                    if (typeof songObj === 'object' && songObj !== null) {
                        return { 
                            titel: songObj.titel, 
                            artiest: activeFilter, 
                            poster: songObj.poster || poster 
                        };
                    } else {
                        return { titel: String(songObj), artiest: activeFilter, poster: poster };
                    }
                });

                // Streak connectors
                const yesterday = new Date(year, month, day - 1);
                const tomorrow = new Date(year, month, day + 1);
                
                const hadYesterday = checkDateHasListen(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
                const hasTomorrow = checkDateHasListen(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

                // FOCUS STREAK LOGICA: Check of deze datum in de actieve streak valt
                let isFocus = false;
                if (focusStreakRange) {
                    const d = new Date(dateStr);
                    const s = new Date(focusStreakRange.start);
                    // Reset tijd om puur op datum te vergelijken
                    d.setHours(0,0,0,0); s.setHours(0,0,0,0);
                    const e = new Date(focusStreakRange.end);
                    e.setHours(0,0,0,0);
                    
                    if (d >= s && d <= e) isFocus = true;
                }

                if (hadYesterday && hasTomorrow) cell.classList.add('streak-middle');
                else if (hasTomorrow) cell.classList.add('streak-start');
                else if (hadYesterday) cell.classList.add('streak-end');

                // Voeg gouden focus klasse toe
                if (isFocus) cell.classList.add('streak-focus');
            }
        } else {
            // STANDAARD MODE
            let songs = musicData.filter(d => d.datum === dateStr);
            if (songs.length > 0) {
                hasListen = true;
                poster = songs[0].poster;
                clickData = songs;
            }
        }

        if (hasListen) { 
            cell.classList.add('has-data'); 
            cell.innerHTML = `<span class="day-number">${day}</span><img src="${poster}">`; 
            cell.onclick = () => openDagDetails(dateStr, clickData); 
        } else { 
            if (activeFilter) cell.style.opacity = "0.2"; 
            cell.innerHTML = `<span class="day-number">${day}</span>`;
        }
        grid.appendChild(cell);
    }
}

function openDagDetails(date, songs) { const container = document.getElementById('day-top-three-container'); document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }); container.innerHTML = songs.slice(0, 5).map((s, i) => `<div class="search-item" onclick="showSongSpotlight('${escapeStr(s.titel)} - ${escapeStr(s.artiest)}') " style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px; cursor:pointer;"><span style="font-weight:800; color:var(--spotify-green); margin-right:15px; width:15px;">${i+1}</span><img src="${s.poster}" style="width:45px; height:45px; border-radius:8px; margin-right:15px;"><div class="search-item-info"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div></div>`).join(''); document.getElementById('modal').classList.remove('hidden'); }

// --- RECAP LOGICA ---

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
        
        return `<li id="${elementId}" onclick="handleListClick('${escapedName}', 'song', '${poster}', '', '${elementId}')" style="display:flex; align-items:center; overflow:hidden;">
            <span style="width:20px; font-weight:bold; color:var(--spotify-green); margin-right:10px; flex-shrink:0;">${idx+1}</span>
            <img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px; flex-shrink:0;">
            <div style="flex-grow:1; min-width:0; margin-right:10px;">
                <span style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s[1]}</span>
                <small style="color:#aaa; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s[0]}</small>
            </div>
            <span class="point-badge" style="flex-shrink:0;">${s[2]}x</span></li>`;
    }).join('');

    const artistsEl = document.getElementById('recap-top-artists');
    artistsEl.innerHTML = data.top_artists.slice(0, 5).map((a, idx) => {
        return `<li onclick="showArtistDetails('${escapeStr(a[0])}', ${a[1]}, '${monthKey}')" style="display:flex; align-items:center; overflow:hidden;">
            <span style="width:20px; font-weight:bold; color:var(--spotify-green); margin-right:10px; flex-shrink:0;">${idx+1}</span>
            <div style="flex-grow:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-right:10px;">${a[0]}</div>
            <span class="point-badge" style="flex-shrink:0;">${a[1]}x</span></li>`;
    }).join('');
}

// --- COMPARISON LOGIC ---

function handleComparisonSearch(type) {
    const inputId = type === 'song' ? 'comp-song-search' : 'comp-artist-search';
    const resultsId = type === 'song' ? 'comp-song-results' : 'comp-artist-results';
    const query = document.getElementById(inputId).value.toLowerCase().trim();
    const dropdown = document.getElementById(resultsId);
    
    if (query.length < 2) { dropdown.classList.add('hidden'); return; }

    let matches = [];
    if (type === 'song') {
        matches = statsData.filter(s => s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query))
            .sort((a,b) => b.count - a.count).slice(0, 5);
    } else {
        const artistMap = {};
        statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
        matches = Object.keys(artistMap).filter(a => a.toLowerCase().includes(query))
            .map(a => ({ artiest: a, count: artistMap[a] }))
            .sort((a,b) => b.count - a.count).slice(0, 5);
    }

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(m => {
            const name = type === 'song' ? m.titel : m.artiest;
            const sub = type === 'song' ? m.artiest : `${m.count}x`;
            const clickArg = type === 'song' ? `${m.titel}|${m.artiest}` : m.artiest;
            return `<div class="comp-result-item" onclick="addToComparison('${escapeStr(clickArg)}', '${type}')">
                        <b>${name}</b><br><small>${sub}</small>
                    </div>`;
        }).join('');
        dropdown.classList.remove('hidden');
    } else { dropdown.classList.add('hidden'); }
}

function addToComparison(key, type) {
    if (comparisonItems.length >= 5) { alert("Max 5 items tegelijk vergelijken."); return; }
    
    let label = key;
    if (type === 'song') {
        const [t, a] = key.split('|');
        label = `${t} - ${a}`;
    }

    if (!comparisonItems.some(i => i.key === key && i.type === type)) {
        comparisonItems.push({ type: type, key: key, label: label });
        updateComparisonUI();
        updateComparisonChart();
    }
    
    document.getElementById('comp-song-search').value = '';
    document.getElementById('comp-artist-search').value = '';
    document.querySelectorAll('.search-dropdown').forEach(d => d.classList.add('hidden'));
}

function removeFromComparison(index) {
    comparisonItems.splice(index, 1);
    updateComparisonUI();
    updateComparisonChart();
}

function updateComparisonUI() {
    const container = document.getElementById('selected-chips');
    container.innerHTML = comparisonItems.map((item, idx) => 
        `<div class="comp-chip">${item.label} <span onclick="removeFromComparison(${idx})">&times;</span></div>`
    ).join('');
}

function updateComparisonChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    const ctxMonthly = document.getElementById('comparisonMonthlyChart').getContext('2d');
    
    if (charts['comparison']) charts['comparison'].destroy();
    if (charts['comparisonMonthly']) charts['comparisonMonthly'].destroy();

    const labels = chartData.history.labels; 
    const datasetsCumulative = [];
    const datasetsMonthly = [];

    comparisonItems.forEach((item, i) => {
        const color = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'][i % 5];
        let dataPointsCumulative = [];
        let dataPointsMonthly = [];
        let runningTotal = 0;

        labels.forEach(month => {
            let count = 0;
            if (monthlyStats[month]) {
                if (item.type === 'artist') {
                    if (monthlyStats[month].artist_counts) {
                        count = monthlyStats[month].artist_counts[item.key] || 0;
                    }
                } else {
                    if (monthlyStats[month].song_counts) {
                        count = monthlyStats[month].song_counts[item.key] || 0;
                    }
                }
            }
            runningTotal += count;
            dataPointsMonthly.push(count);
            dataPointsCumulative.push(runningTotal);
        });

        datasetsCumulative.push({
            label: item.label,
            data: dataPointsCumulative,
            borderColor: color,
            backgroundColor: color + '22',
            tension: 0.3,
            fill: false
        });

        datasetsMonthly.push({
            label: item.label,
            data: dataPointsMonthly,
            backgroundColor: color + '88', 
            borderColor: color,
            borderWidth: 1,
            tension: 0.4,
            fill: true,
            pointRadius: 3
        });
    });

    charts['comparison'] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels.map(l => l.substring(2)), datasets: datasetsCumulative },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ccc' } } },
            scales: { x: { grid: { color: '#333' }, ticks: { color: '#777' } }, y: { grid: { color: '#333' }, ticks: { color: '#777' } } }
        }
    });

    charts['comparisonMonthly'] = new Chart(ctxMonthly, {
        type: 'line', 
        data: { labels: labels.map(l => l.substring(2)), datasets: datasetsMonthly },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ccc' } } },
            scales: { x: { grid: { display: false }, ticks: { color: '#777' } }, y: { grid: { color: '#333' }, ticks: { color: '#777' } } }
        }
    });
}

// --- REPERTOIRE LOGICA ---

function handleRepertoireSearch() {
    const query = document.getElementById('repertoire-search').value.toLowerCase().trim();
    const dropdown = document.getElementById('repertoire-results');
    
    if (query.length < 2) { dropdown.classList.add('hidden'); return; }

    const artistMap = {};
    statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const matches = Object.keys(artistMap).filter(a => a.toLowerCase().includes(query))
        .map(a => ({ artiest: a, count: artistMap[a] }))
        .sort((a,b) => b.count - a.count).slice(0, 5);

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(m => {
            return `<div class="comp-result-item" onclick="showRepertoireChart('${escapeStr(m.artiest)}')">
                        <b>${m.artiest}</b><br><small>${m.count}x plays</small>
                    </div>`;
        }).join('');
        dropdown.classList.remove('hidden');
    } else { dropdown.classList.add('hidden'); }
}

function showRepertoireChart(artistName) {
    document.getElementById('repertoire-search').value = '';
    document.getElementById('repertoire-results').classList.add('hidden');
    document.getElementById('repertoire-chart-container').classList.remove('hidden');
    document.getElementById('repertoire-title').innerText = `Top 5 van ${artistName}`;

    renderRepertoireGrowthChart(artistName);
    renderRepertoireMonthlyChart(artistName);
}

function renderRepertoireGrowthChart(artistName) {
    const ctx = document.getElementById('repertoireChart').getContext('2d');
    if (charts['repertoire']) charts['repertoire'].destroy();

    const songs = statsData.filter(s => s.artiest === artistName)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5);

    const labels = chartData.history.labels;
    const colors = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#cddc39', '#f44336', '#795548'];

    const datasets = songs.map((song, i) => {
        let dataPoints = [];
        let runningTotal = 0;
        labels.forEach(month => {
            let count = 0;
            const key = `${song.titel}|${song.artiest}`;
            if (monthlyStats[month] && monthlyStats[month].song_counts) {
                count = monthlyStats[month].song_counts[key] || 0;
            }
            runningTotal += count;
            dataPoints.push(runningTotal);
        });
        return {
            label: song.titel, data: dataPoints, borderColor: colors[i % colors.length],
            backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2
        };
    });

    charts['repertoire'] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels.map(l => l.substring(2)), datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ccc', boxWidth: 10, font: {size:10} } } },
            scales: { x: { grid: { color: '#333' }, ticks: { color: '#777' } }, y: { grid: { color: '#333' }, ticks: { color: '#777' } } },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

function renderRepertoireMonthlyChart(artistName) {
    const ctx = document.getElementById('repertoireMonthlyChart').getContext('2d');
    if (charts['repertoireMonthly']) charts['repertoireMonthly'].destroy();

    const songs = statsData.filter(s => s.artiest === artistName)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5);

    const labels = chartData.history.labels.map(l => {
        const [y, m] = l.split('-'); 
        return new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' }).format(new Date(y, m-1));
    });
    const colors = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];

    const datasets = songs.map((song, i) => {
        const dataPoints = chartData.history.labels.map(month => {
            let count = 0;
            const key = `${song.titel}|${song.artiest}`;
            if (monthlyStats[month] && monthlyStats[month].song_counts) {
                count = monthlyStats[month].song_counts[key] || 0;
            }
            return count;
        });

        return {
            label: song.titel,
            data: dataPoints,
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length] + '22',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false
        };
    });

    charts['repertoireMonthly'] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: true, labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#777' } },
                x: { grid: { display: false }, ticks: { color: '#777', maxTicksLimit: 10 } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
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

// --- RENDER FUNCTIES (STANDAARD) ---

function renderCharts() {
    const ctxHist = document.getElementById('listeningChart').getContext('2d');
    if (charts['history']) charts['history'].destroy();
    
    const histLabels = chartData.history ? chartData.history.labels : chartData.labels;
    const histValues = chartData.history ? chartData.history.values : chartData.values;

    charts['history'] = new Chart(ctxHist, {
        type: 'line',
        data: {
            labels: histLabels.map(l => { const [y, m] = l.split('-'); return new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' }).format(new Date(y, m-1)); }),
            datasets: [{ data: histValues, borderColor: '#1db954', backgroundColor: 'rgba(29, 185, 84, 0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#b3b3b3', font: { size: 10 } } } } }
    });

    if (!chartData.hours) return;

    const ctxHours = document.getElementById('hoursChart').getContext('2d');
    if (charts['hours']) charts['hours'].destroy();
    charts['hours'] = new Chart(ctxHours, {
        type: 'line',
        data: {
            labels: chartData.hours.labels,
            datasets: [{
                data: chartData.hours.values,
                borderColor: '#2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { ticks: { color: '#777', font: { size: 9 } }, grid: { display: false } }, y: { display: false } }
        }
    });

    const ctxWeek = document.getElementById('weekChart').getContext('2d');
    if (charts['week']) charts['week'].destroy();
    charts['week'] = new Chart(ctxWeek, {
        type: 'line',
        data: {
            labels: chartData.weekdays.labels,
            datasets: [{
                data: chartData.weekdays.values,
                borderColor: '#ff9800',
                backgroundColor: 'rgba(255, 165, 0, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { ticks: { color: '#777' }, grid: { display: false } }, y: { display: false } }
        }
    });
    
    renderArtistPieChart();
    renderSongPieChart();
}

function renderArtistPieChart() {
    const ctxArtist = document.getElementById('artistPieChart').getContext('2d');
    if (charts['artist']) charts['artist'].destroy();
    charts['artist'] = new Chart(ctxArtist, { 
        type: 'doughnut', 
        data: { 
            labels: chartData.artists.labels, 
            datasets: [{ 
                data: chartData.artists.values, 
                backgroundColor: ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#cddc39', '#f44336', '#795548'], 
                borderWidth: 0 
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } } }, 
            cutout: '70%' 
        } 
    });
}

function renderSongPieChart() {
    const ctxSong = document.getElementById('songPieChart').getContext('2d');
    if (charts['song']) charts['song'].destroy();
    charts['song'] = new Chart(ctxSong, { 
        type: 'doughnut', 
        data: { 
            labels: chartData.songs.labels, 
            datasets: [{ 
                data: chartData.songs.values, 
                backgroundColor: ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#cddc39', '#f44336', '#795548'], 
                borderWidth: 0 
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } } }, 
            cutout: '70%' 
        } 
    });
}

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

// --- DATA LOADING ---

async function loadMusic() {
    try {
        const savedHandle = await getHandleFromDB();
        if (savedHandle) {
            fileHandle = savedHandle;
            console.log("📂 Bestandskoppeling hersteld.");
            updateFileStatus(true);
            try {
                if ((await fileHandle.queryPermission({ mode: 'read' })) === 'granted') {
                    const file = await fileHandle.getFile();
                    const text = await file.text();
                    if (text) existingCorrections = JSON.parse(text);
                }
            } catch (e) { console.log("Wacht op permissie...", e); }
        }

        const [dataRes, statsRes, monthlyRes, streaksRes, chartRes, comebackRes, correctionsRes, calendarRes, oldFavRes, fullHistRes] = await Promise.all([
            fetch('data.json'), fetch('stats.json'), fetch('monthly_stats.json'), 
            fetch('streaks.json').catch(() => ({json: () => ({})})),
            fetch('chart_data.json').catch(() => ({json: () => ({})})),
            fetch('comebacks.json').catch(() => ({json: () => ([])})),
            fetch('corrections.json').catch(() => ({json: () => ([])})),
            fetch('calendar_index.json').catch(() => ({json: () => ({})})),
            fetch('old_favorites.json').catch(() => ({json: () => ([])})),
            fetch('full_history.json').catch(() => ({json: () => ([])})) // <--- DEZE IS CRUCIAAL
        ]);

        musicData = await dataRes.json();
        statsData = await statsRes.json();
        monthlyStats = await monthlyRes.json();
        chartData = await chartRes.json();
        comebackData = await comebackRes.json();
        try { streakData = await streaksRes.json(); } catch(e) { streakData = {}; }
        try { calendarIndex = await calendarRes.json(); } catch(e) { calendarIndex = {}; }
        oldFavoritesData = await oldFavRes.json(); 
        
        // Data toewijzen
        fullHistoryData = await fullHistRes.json(); 
        
        if (existingCorrections.length === 0) {
            try { existingCorrections = await correctionsRes.json(); } catch(e) { existingCorrections = []; }
        }

        document.getElementById('unique-songs-count').innerText = statsData.length;
        document.getElementById('total-days-count').innerText = new Set(musicData.map(s => s.datum)).size;
        
        renderCharts();
        calculateStreak();
        renderCalendar();
        renderFunStats();
        updateComparisonChart(); 
        renderRecapSelector();
    } catch (error) { console.error("Fout bij laden:", error); }
}

// --- CALENDAR RENDERING ---

function renderCalendar() {
    const grid = document.getElementById('calendarGrid'), monthDisplay = document.getElementById('monthDisplay');
    if (!grid) return; grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    const firstDay = new Date(year, month, 1).getDay(), offset = firstDay === 0 ? 6 : firstDay - 1;
    
    for (let i = 0; i < offset; i++) { grid.appendChild(document.createElement('div')); }
    
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div'); cell.className = 'calendar-day';
        let hasListen = false;
        let poster = "";
        let clickData = [];

        if (activeFilter) {
            // FILTER MODE: Check de complete index
            if (calendarIndex[dateStr] && calendarIndex[dateStr][activeFilter]) {
                hasListen = true;
                const entry = calendarIndex[dateStr][activeFilter];
                poster = entry.poster;
                
                // --- FIX: entry.songs is een lijst van OBJECTEN, niet strings ---
                clickData = entry.songs.map(songObj => ({
                    titel: songObj.titel,       // Pak de string 'titel'
                    artiest: activeFilter,      // De artiest weten we al
                    poster: songObj.poster || poster // Gebruik de song-poster
                }));
            }
        } else {
            // STANDAARD MODE: Check Top 5 data
            let songs = musicData.filter(d => d.datum === dateStr);
            if (songs.length > 0) {
                hasListen = true;
                poster = songs[0].poster;
                clickData = songs;
            }
        }

        if (hasListen) { 
            cell.classList.add('has-data'); 
            cell.innerHTML = `<span class="day-number">${day}</span><img src="${poster}">`; 
            cell.onclick = () => openDagDetails(dateStr, clickData); 
        } else { 
            if (activeFilter) cell.style.opacity = "0.3"; 
            cell.innerHTML = `<span class="day-number">${day}</span>`;
        }
        grid.appendChild(cell);
    }
}

function openDagDetails(date, songs) { const container = document.getElementById('day-top-three-container'); document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }); container.innerHTML = songs.slice(0, 5).map((s, i) => `<div class="search-item" onclick="showSongSpotlight('${escapeStr(s.titel)} - ${escapeStr(s.artiest)}') " style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px; cursor:pointer;"><span style="font-weight:800; color:var(--spotify-green); margin-right:15px; width:15px;">${i+1}</span><img src="${s.poster}" style="width:45px; height:45px; border-radius:8px; margin-right:15px;"><div class="search-item-info"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div></div>`).join(''); document.getElementById('modal').classList.remove('hidden'); }

function switchTab(tabName) { 
    document.getElementById('view-calendar').classList.toggle('hidden', tabName !== 'calendar'); 
    document.getElementById('view-stats').classList.toggle('hidden', tabName !== 'stats'); 
    document.getElementById('view-graphs').classList.toggle('hidden', tabName !== 'graphs'); 
    document.getElementById('view-recap').classList.toggle('hidden', tabName !== 'recap'); 
    
    document.getElementById('btn-calendar').classList.toggle('active', tabName === 'calendar'); 
    document.getElementById('btn-stats').classList.toggle('active', tabName === 'stats'); 
    document.getElementById('btn-graphs').classList.toggle('active', tabName === 'graphs'); 
    document.getElementById('btn-recap').classList.toggle('active', tabName === 'recap'); 
    
    // Reset focus als we van tab wisselen (behalve als we net gefilterd hebben)
    if (tabName !== 'calendar') focusStreakRange = null;

    if (tabName === 'calendar') renderCalendar(); 
    else if (tabName === 'stats') {
        renderStatsDashboard();
    }
    else if (tabName === 'graphs') {
        renderCharts();
        updateComparisonChart(); 
    }
    else if (tabName === 'recap') {
        renderRecapSelector();
    }
}
function applyCalendarFilter(artist, startDate, endDate, songTitle = null) { 
    console.log(`[DEBUG] applyCalendarFilter: ${artist}, Song: ${songTitle}, Start: ${startDate}`);
    
    activeFilter = artist; 
    activeSongFilter = songTitle; // Sla het specifieke liedje op

    if (startDate && endDate) {
        // Focus instellen
        focusStreakRange = { start: startDate, end: endDate };
        // Navigeren naar start
        currentViewDate = new Date(startDate);
        currentViewDate.setDate(1); 
    } else {
        focusStreakRange = null;
        // Zoek laatste luistermoment
        const allDates = Object.keys(calendarIndex).sort().reverse();
        const lastListenDate = allDates.find(date => calendarIndex[date][artist]);
        if (lastListenDate) {
            currentViewDate = new Date(lastListenDate);
            currentViewDate.setDate(1); 
        }
    }

    document.getElementById('modal').classList.add('hidden'); 
    switchTab('calendar'); 
    document.getElementById('resetFilter').classList.remove('hidden'); 
    renderCalendar(); 
}
function getSongStreaks(titel, artiest) {
    // FIX: Gebruik fullHistoryData (alles) ipv musicData (alleen top 5)
    // Hierdoor tellen dagen waarop het liedje op #6 stond nu WEL mee.
    const rawDates = fullHistoryData
        .filter(m => m.titel === titel && m.artiest === artiest)
        .map(m => m.datum);

    // 2. Unieke datums maken en sorteren
    const uniqueDates = [...new Set(rawDates)].sort();

    if (uniqueDates.length === 0) return [];

    let streaks = [];
    
    // Helper: Zet string '2023-01-01' om naar datum object (middernacht)
    const parseDate = (str) => {
        if(!str) return new Date();
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0);
    };

    // Begin eerste streak
    let currentStreak = { 
        start: uniqueDates[0], 
        end: uniqueDates[0], 
        count: 1 
    };

    // Een dag in ms
    const oneDayMs = 1000 * 60 * 60 * 24;

    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = parseDate(uniqueDates[i-1]);
        const currDate = parseDate(uniqueDates[i]);
        
        // Bereken verschil in dagen (afronden om zeker te zijn)
        const diffMs = currDate - prevDate;
        const diffDays = Math.round(diffMs / oneDayMs);

        if (diffDays === 1) {
            // Aansluitend
            currentStreak.count++;
            currentStreak.end = uniqueDates[i];
        } else {
            // Gat
            if (currentStreak.count > 1) streaks.push(currentStreak);
            currentStreak = { start: uniqueDates[i], end: uniqueDates[i], count: 1 };
        }
    }
    // Laatste toevoegen
    if (currentStreak.count > 1) streaks.push(currentStreak);

    // Sorteer op lengte (grootste bovenaan) en pak top 3
    return streaks.sort((a,b) => b.count - a.count).slice(0, 3);
}
// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
    document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
    document.getElementById('close-button').onclick = () => closeModal();
document.getElementById('resetFilter').onclick = function() { 
    activeFilter = null; 
    activeSongFilter = null; // <--- TOEVOEGEN
    focusStreakRange = null; 
    this.classList.add('hidden'); 
    renderCalendar(); 
};    
    loadMusic();
});