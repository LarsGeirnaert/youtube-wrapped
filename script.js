let currentViewDate = new Date();
let musicData = [], statsData = [], monthlyStats = {}, streakData = {}, chartData = {}, comebackData = [], activeFilter = null;
let myChart = null;

// --- MERGE MODE STATE ---
let mergeMode = false;
let selectedForMerge = []; 
let existingCorrections = [];
let fileHandle = null;

// --- INDEXED DB ---
const DB_NAME = 'MuziekDagboekDB';
const STORE_NAME = 'Settings';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
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
        const request = tx.objectStore(STORE_NAME).get('correctionsHandle');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// --- INITIALISATIE ---

async function loadMusic() {
    try {
        const savedHandle = await getHandleFromDB();
        if (savedHandle) {
            fileHandle = savedHandle;
            console.log("📂 Bestandskoppeling hersteld uit geheugen.");
            updateFileStatus(true);
            try {
                if ((await fileHandle.queryPermission({ mode: 'read' })) === 'granted') {
                    const file = await fileHandle.getFile();
                    const text = await file.text();
                    if (text) existingCorrections = JSON.parse(text);
                }
            } catch (e) { console.log("Wacht op permissie...", e); }
        }

        const [dataRes, statsRes, monthlyRes, streaksRes, chartRes, comebackRes, correctionsRes] = await Promise.all([
            fetch('data.json'), fetch('stats.json'), fetch('monthly_stats.json'), 
            fetch('streaks.json').catch(() => ({json: () => ({})})),
            fetch('chart_data.json').catch(() => ({json: () => ({})})),
            fetch('comebacks.json').catch(() => ({json: () => ([])})),
            fetch('corrections.json').catch(() => ({json: () => ([])})) 
        ]);

        musicData = await dataRes.json();
        statsData = await statsRes.json();
        monthlyStats = await monthlyRes.json();
        chartData = await chartRes.json();
        comebackData = await comebackRes.json();
        try { streakData = await streaksRes.json(); } catch(e) { streakData = {}; }
        
        if (existingCorrections.length === 0) {
            try { existingCorrections = await correctionsRes.json(); } catch(e) { existingCorrections = []; }
        }

        document.getElementById('unique-songs-count').innerText = statsData.length;
        document.getElementById('total-days-count').innerText = new Set(musicData.map(s => s.datum)).size;
        
        renderCharts();
        calculateStreak();
        renderCalendar();
    } catch (error) { console.error("Fout bij laden:", error); }
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

function getAlbumKey(posterUrl, artist) {
    if (!posterUrl || posterUrl.includes('placeholder')) return artist.toLowerCase();
    const uniqueId = posterUrl.split('/image/thumb/')[1] || posterUrl;
    return `${artist.toLowerCase()}_${uniqueId}`;
}

// --- FILE SYSTEM ACCESS API ---

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
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "corrections.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        return false; 
    }
}

// --- MERGE LOGICA ---

function toggleMergeMode() {
    mergeMode = !mergeMode;
    const btn = document.getElementById('btn-merge-mode');
    const instr = document.getElementById('merge-instructions');
    const bar = document.getElementById('merge-action-bar');
    
    if (mergeMode) {
        btn.innerText = "❌ Stop Merge Mode";
        btn.style.background = "red";
        btn.style.borderColor = "red";
        btn.style.color = "white";
        instr.classList.remove('hidden');
        bar.classList.add('visible');
        selectedForMerge = [];
        updateMergeUI();
    } else {
        btn.innerText = "Start Merge Mode";
        btn.style.background = "rgba(255,165,0,0.2)";
        btn.style.borderColor = "orange";
        btn.style.color = "orange";
        instr.classList.add('hidden');
        bar.classList.remove('visible');
        document.querySelectorAll('.merge-selected').forEach(el => el.classList.remove('merge-selected'));
    }
}

function handleListClick(name, type, poster, albumArtist, elementId) {
    if (mergeMode) {
        if (type === 'song') toggleMergeSelection(name, elementId);
        else alert("Je kan alleen liedjes samenvoegen.");
    } else {
        const escapedName = name; 
        if (type === 'artist') showArtistDetails(escapedName);
        else if (type === 'album') showAlbumDetails(poster, albumArtist);
        else showSongSpotlight(escapedName);
    }
}

function toggleMergeSelection(name, elementId) {
    let parts = name.split(' - ');
    let item = {};
    if (parts.length > 1) item = { titel: parts[0].trim(), artiest: parts[1].trim() };
    else item = { titel: "", artiest: name.trim() };
    
    const key = `${item.artiest}|${item.titel}`.toLowerCase();
    const index = selectedForMerge.findIndex(x => x.key === key);
    
    if (index > -1) {
        selectedForMerge.splice(index, 1);
        if(document.getElementById(elementId)) document.getElementById(elementId).classList.remove('merge-selected');
    } else {
        selectedForMerge.push({ key: key, naam: name, item: item });
        if(document.getElementById(elementId)) document.getElementById(elementId).classList.add('merge-selected');
    }
    updateMergeUI();
}

function updateMergeUI() {
    document.getElementById('merge-count').innerText = `${selectedForMerge.length} geselecteerd`;
}

function showMergeModal() {
    if (selectedForMerge.length < 2) { alert("Selecteer minstens 2 liedjes."); return; }

    const container = document.getElementById('day-top-three-container');
    const titleEl = document.getElementById('modal-datum-titel');
    titleEl.innerText = "Kies de Hoofdversie";
    
    let html = `<p style="text-align:center; margin-bottom:15px; color:#ccc;">Welke naam wil je behouden?</p>`;
    html += `<form id="merge-form" style="max-height:300px; overflow-y:auto; margin-bottom:20px;">`;
    
    selectedForMerge.forEach((obj, idx) => {
        const checked = idx === 0 ? 'checked' : '';
        html += `<label class="radio-item"><input type="radio" name="merge-target" value="${idx}" ${checked}><div><span style="font-weight:600; display:block;">${obj.item.titel}</span><span style="font-size:0.8rem; color:#aaa;">${obj.item.artiest}</span></div></label>`;
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
    
    const targetObj = selectedForMerge[selectedIndex].item;
    let newCount = 0;
    selectedForMerge.forEach((obj, idx) => {
        if (idx !== selectedIndex) {
            existingCorrections.push({ original: obj.item, target: targetObj });
            newCount++;
        }
    });

    const isAuto = await saveCorrections();
    let msg = `Succes! ${newCount} variaties samengevoegd.`;
    if (!isAuto) msg += " (Bestand gedownload).";
    
    alert(msg);
    document.getElementById('modal').classList.add('hidden');
    toggleMergeMode(); 
}

// --- RENDER FUNCTIES ---

function renderCharts() {
    const canvas = document.getElementById('listeningChart');
    if (!canvas || !chartData.values) return;
    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels.map(l => {
                const [y, m] = l.split('-');
                return new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' }).format(new Date(y, m-1));
            }),
            datasets: [{
                data: chartData.values, borderColor: '#1db954', backgroundColor: 'rgba(29, 185, 84, 0.1)',
                borderWidth: 3, tension: 0.4, fill: true, pointRadius: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#b3b3b3', font: { size: 10 } } } } }
    });
}

function renderStatsDashboard() {
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 10);
    const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
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
    
    renderList('top-albums-listens', albums.sort((a,b) => b.total - a.total).slice(0, 10).map(a => [`Album van ${a.artiest}`, a.total, a.poster]), 'x', 'album');
    
    const sortedVariety = [...albums].sort((a,b) => b.unique.size - a.unique.size);
    const filteredVariety = [];
    const counts = {};
    for (const alb of sortedVariety) {
        if (filteredVariety.length >= 10) break;
        const art = alb.artiest;
        counts[art] = (counts[art] || 0) + 1;
        if (counts[art] <= 2) filteredVariety.push(alb);
    }
    renderList('top-albums-variety', filteredVariety.map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster]), ' songs', 'album');

    const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
    const obsessions = [], explorers = [];
    Object.entries(artistGroups).forEach(([artist, songs]) => {
        if (songs.length === 1 && songs[0].count > 50) obsessions.push([`${songs[0].titel} (${artist})`, songs[0].count, songs[0].poster]);
        if (songs.length >= 10) explorers.push([artist, songs.length, null]);
    });
    renderList('obsessions-list', obsessions.sort((a,b) => b[1] - a[1]).slice(0, 10), 'x', 'song');
    renderList('variety-list', explorers.sort((a,b) => b[1] - a[1]).slice(0, 10), ' songs', 'artist');
}

function renderList(id, items, unit, type) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = items.map(([name, val, poster, period], index) => {
        const escapedName = name.replace(/'/g, "\\'");
        const elementId = `${id}-${index}`;
        const clickAction = `handleListClick('${escapedName}', '${type}', '${poster}', '${(escapedName.split('van ')[1] || '')}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px;">` : '';
        const sub = period ? `<br><small style="color:var(--text-muted); font-size:0.65rem;">${period}</small>` : '';
        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center;">
                    <span style="width:20px; font-size:0.7rem; font-weight:700; color:var(--spotify-green); margin-right:5px;">${index+1}.</span>
                    ${img}<div style="flex-grow:1; overflow:hidden;"><span style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${name}</span>${sub}</div>
                    <span class="point-badge" style="margin-left:10px;">${val}${unit}</span></li>`;
    }).join('');
}

function showAlbumDetails(posterUrl, artistName) {
    const key = getAlbumKey(posterUrl, artistName);
    const albumSongs = statsData.filter(s => getAlbumKey(s.poster, s.artiest) === key).sort((a,b) => b.count - a.count);
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = `Album van ${artistName}`;
    
    container.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><img src="${posterUrl}" style="width:150px;border-radius:20px;box-shadow:var(--shadow-lg);"></div>
        <div style="max-height:350px;overflow-y:auto;">${albumSongs.map((s, idx) => {
            const name = `${s.titel} - ${s.artiest}`;
            const escapedName = name.replace(/'/g, "\\'");
            const elementId = `album-det-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;"><div style="flex-grow:1;"><b>${s.titel}</b></div><span class="point-badge">${s.count}x</span></div>`;
        }).join('')}</div>`;
    document.getElementById('modal').classList.remove('hidden');
}

// --- HIER ZIT DE AANPASSING VOOR DE ARTIESTENPAGINA ---
function showArtistDetails(artist, overrideCount = null, monthKey = null) {
    let cleanArtist = artist.includes('(') ? artist.split('(')[1].replace(')', '') : artist;
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = cleanArtist;
    
    let songsToShow = []; 
    let label = "totaal";
    
    if (monthKey && monthlyStats[monthKey] && monthlyStats[monthKey].artist_details[cleanArtist]) {
        songsToShow = monthlyStats[monthKey].artist_details[cleanArtist].map(i => { 
            const info = statsData.find(x => x.artiest === cleanArtist && x.titel === i[0]); 
            return { titel: i[0], count: i[1], poster: info ? info.poster : 'img/placeholder.png', artiest: cleanArtist }; 
        });
        label = "deze maand";
    } else { 
        songsToShow = statsData.filter(s => s.artiest === cleanArtist.trim()).sort((a,b) => b.count - a.count); 
    }

    // -- NIEUW: Verzamel Albums van deze artiest --
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
    
    html += `<button onclick="applyCalendarFilter('${cleanArtist.replace(/'/g, "\\'")}')" class="apply-btn" style="background:var(--spotify-green); border:none; padding:10px; width:100%; border-radius:10px; font-weight:700; cursor:pointer; margin-bottom:15px;">📅 Bekijk op kalender</button>`;

    // -- NIEUW: Toon albums als die er zijn --
    if (sortedAlbums.length > 0) {
        html += `<h3 style="font-size:0.9rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Albums</h3>`;
        html += `<div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:15px; margin-bottom:10px;">`;
        sortedAlbums.forEach(alb => {
            html += `<div onclick="showAlbumDetails('${alb.poster}', '${cleanArtist.replace(/'/g, "\\'")}')" style="flex-shrink:0; cursor:pointer; width:80px; text-align:center;">
                        <img src="${alb.poster}" style="width:80px; height:80px; border-radius:10px; object-fit:cover; margin-bottom:5px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                    </div>`;
        });
        html += `</div>`;
    }

    html += `<h3 style="font-size:0.9rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Songs</h3>`;
    html += `<div style="max-height:400px; overflow-y:auto;">${songsToShow.map((s, idx) => {
            const name = `${s.titel} - ${cleanArtist}`;
            const escapedName = name.replace(/'/g, "\\'");
            const elementId = `artist-det-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;"><img src="${s.poster}" style="width:35px;height:35px;border-radius:5px;margin-right:10px;"><div style="flex-grow:1;"><b>${s.titel}</b></div><span class="point-badge" style="background:rgba(255,255,255,0.05); color:white;">${s.count}x ${label}</span></div>`;
        }).join('')}</div>`;
    
    container.innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
}

function showSongSpotlight(songFull, overrideCount = null) {
    let titel, artiest; if (songFull.includes(' - ')) { const p = songFull.split(' - '); titel = p[0]; artiest = p[1]; } else { titel = songFull; artiest = "Onbekend"; }
    const s = statsData.find(x => x.titel.trim() === titel.trim()) || { poster: 'img/placeholder.png', artiest: artiest, count: '?' };
    const countToDisplay = overrideCount !== null ? overrideCount : s.count;
    const label = overrideCount !== null ? "Deze maand" : "Totaal";
    document.getElementById('day-top-three-container').innerHTML = `<div class="vinyl-container"><div class="vinyl-record" style="width:200px; height:200px; background:#111; border-radius:50%; margin:0 auto; position:relative; background-image: repeating-radial-gradient(circle, #222 0, #111 2px, #222 4px);"></div><img src="${s.poster}" style="position:absolute; inset:25%; width:50%; height:50%; border-radius:50%; object-fit:cover;"></div><h2 style="text-align:center;margin-top:20px;">${titel}</h2><p style="text-align:center;color:#1db954;font-weight:bold;">${s.artiest || artiest}</p><p style="text-align:center;font-size:0.9rem;color:var(--text-muted); margin-top:10px;">${label} <b>${countToDisplay}x</b> geluisterd</p>`;
    document.getElementById('modal-datum-titel').innerText = "Spotlight"; document.getElementById('modal').classList.remove('hidden');
}

function showTop100(category) {
    const container = document.getElementById('day-top-three-container');
    const titleEl = document.getElementById('modal-datum-titel');
    let items = [];
    const monthKey = `${currentViewDate.getFullYear()}-${String(currentViewDate.getMonth() + 1).padStart(2, '0')}`;
    const mData = monthlyStats[monthKey];

    if (category === 'songs') {
        titleEl.innerText = "Top 100 Songs";
        items = [...statsData].sort((a, b) => b.count - a.count).slice(0, 100).map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster, 'song']);
    } else if (category === 'artists') {
        titleEl.innerText = "Top 100 Artiesten";
        const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
        items = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 100).map(a => [a[0], a[1], null, 'artist']);
    } else if (category.includes('albums')) {
        const albumMap = {};
        statsData.forEach(s => {
            if (s.poster === "img/placeholder.png") return;
            const key = getAlbumKey(s.poster, s.artiest);
            if (!albumMap[key]) albumMap[key] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() };
            albumMap[key].total += s.count; albumMap[key].unique.add(s.titel);
        });
        const albums = Object.values(albumMap);
        if (category === 'albums-listens') { 
            titleEl.innerText = "Top 100 Albums (Luisterbeurten)";
            items = albums.sort((a,b) => b.total - a.total).slice(0, 100).map(a => [`Album van ${a.artiest}`, a.total, a.poster, 'album']); 
        } else { 
            titleEl.innerText = "Top 100 Albums (Variatie)";
            const sorted = albums.sort((a,b) => b.unique.size - a.unique.size);
            const filtered = [];
            const counts = {};
            for (const alb of sorted) {
                if (filtered.length >= 100) break;
                const art = alb.artiest;
                counts[art] = (counts[art] || 0) + 1;
                if (counts[art] <= 2) filtered.push(alb);
            }
            items = filtered.map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster, 'album']); 
        }
    } else if (category.includes('streaks')) {
        const key = category.split('streaks-')[1].replace('-', '_');
        items = streakData[key].map(s => [s.titel ? `${s.titel} - ${s.artiest}` : s.naam, s.streak, statsData.find(x => x.titel === s.titel)?.poster, s.titel ? 'song' : 'artist', s.period]);
    } else if (category === 'month-songs') {
        titleEl.innerText = "Top Songs Deze Maand";
        items = mData ? mData.top_songs.map(s => [`${s[1]} - ${s[0]}`, s[2], statsData.find(x => x.titel === s[1] && x.artiest === s[0])?.poster, 'song']) : [];
    } else if (category === 'month-artists') {
        titleEl.innerText = "Top Artiesten Deze Maand";
        items = mData ? mData.top_artists.map(a => [a[0], a[1], null, 'artist']) : [];
    } else if (category === 'obsessions') {
        const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
        items = Object.entries(artistGroups).filter(([a, songs]) => songs.length === 1 && songs[0].count > 50).sort((a, b) => b[1][0].count - a[1][0].count).slice(0, 100).map(([a, songs]) => [`${songs[0].titel} (${a})`, songs[0].count, songs[0].poster, 'song']);
    } else if (category === 'explorers') {
        const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
        items = Object.entries(artistGroups).filter(([a, songs]) => songs.length >= 10).sort((a, b) => b[1].length - a[1].length).slice(0, 100).map(([a, songs]) => [a, songs.length, null, 'artist']);
    }

    container.innerHTML = `<ul class="ranking-list" style="max-height: 500px; overflow-y: auto;">` + items.map(([name, val, poster, type, unit, period], index) => {
        const escapedName = name.replace(/'/g, "\\'");
        const elementId = `top100-${index}`;
        const clickAction = `handleListClick('${escapedName}', '${type}', '${poster}', '${(escapedName.split('van ')[1] || '')}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted);">${period}</small>` : '';
        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center; padding: 12px 15px;">
                    <span style="width: 25px; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>
                    ${img}<div style="flex-grow:1; overflow:hidden;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>${sub}</div>
                    <span class="point-badge">${val}${unit||''}</span></li>`;
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
        songsEl.innerHTML = data.top_songs.slice(0, 5).map((s, idx) => {
            const songName = `${s[1]} - ${s[0]}`;
            const info = statsData.find(x => x.titel === s[1] && x.artiest === s[0]);
            const escapedName = songName.replace(/'/g, "\\'");
            const elementId = `month-song-${idx}`;
            return `<li id="${elementId}" onclick="handleListClick('${escapedName}', 'song', '${info ? info.poster : 'img/placeholder.png'}', '', '${elementId}')">
                <img src="${info ? info.poster : 'img/placeholder.png'}" style="width:20px; height:20px; border-radius:4px; margin-right:8px;">
                <span style="flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${songName}</span>
                <span style="color:var(--text-muted); font-size:0.7rem; margin-left:5px;">${s[2]}x</span></li>`;
        }).join('');
        artistsEl.innerHTML = data.top_artists.slice(0, 5).map(a => `<li onclick="showArtistDetails('${a[0].replace(/'/g, "\\'")}', ${a[1]}, '${monthKey}')">
            <span style="flex-grow:1;">${a[0]}</span><span class="point-badge">${a[1]}x</span></li>`).join('');
        totalEl.innerText = data.total_listens;
    } else if (songsEl) {
        songsEl.innerHTML = "<li>Geen data</li>"; artistsEl.innerHTML = "<li>Geen data</li>"; totalEl.innerText = 0;
    }
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
        if (songs.length > 0) { cell.classList.add('has-data'); cell.innerHTML = `<span class="day-number">${day}</span><img src="${songs[0].poster}">`; cell.onclick = () => openDagDetails(dateStr, songs); }
        else cell.innerHTML = `<span class="day-number">${day}</span>`;
        grid.appendChild(cell);
    }
}

function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results'); if (query.length < 2) { resultsContainer.innerHTML = ""; return; }
    const matches = statsData.filter(s => s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query)).sort((a, b) => b.count - a.count).slice(0, 8);
    
    resultsContainer.innerHTML = matches.map((s, idx) => {
        const name = `${s.titel} - ${s.artiest}`;
        const escapedName = name.replace(/'/g, "\\'");
        const elementId = `search-${idx}`;
        return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:5px; cursor:pointer;"><img src="${s.poster}" onerror="this.src='img/placeholder.png'" style="width:40px; height:40px; border-radius:6px; margin-right:12px;"><div style="flex-grow:1;"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div><span class="point-badge">${s.count}x</span></div>`;
    }).join('');
}

function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse(); if (dates.length === 0) return;
    let streak = 0; for (let i = 0; i < dates.length - 1; i++) { if (Math.floor((new Date(dates[i]) - new Date(dates[i+1])) / 86400000) === 1) streak++; else break; }
    document.getElementById('streak-count').innerText = streak + 1;
}

function openDagDetails(date, songs) { const container = document.getElementById('day-top-three-container'); document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }); container.innerHTML = songs.slice(0, 5).map((s, i) => `<div class="search-item" onclick="showSongSpotlight('${s.titel.replace(/'/g, "\\'")} - ${s.artiest.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px; cursor:pointer;"><span style="font-weight:800; color:var(--spotify-green); margin-right:15px; width:15px;">${i+1}</span><img src="${s.poster}" style="width:45px; height:45px; border-radius:8px; margin-right:15px;"><div class="search-item-info"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div></div>`).join(''); document.getElementById('modal').classList.remove('hidden'); }
function switchTab(tabName) { document.getElementById('view-calendar').classList.toggle('hidden', tabName !== 'calendar'); document.getElementById('view-stats').classList.toggle('hidden', tabName !== 'stats'); document.getElementById('btn-calendar').classList.toggle('active', tabName === 'calendar'); document.getElementById('btn-stats').classList.toggle('active', tabName === 'stats'); if (tabName === 'calendar') renderCalendar(); else renderStatsDashboard(); }
function applyCalendarFilter(artist) { activeFilter = artist; document.getElementById('modal').classList.add('hidden'); switchTab('calendar'); document.getElementById('resetFilter').classList.remove('hidden'); renderCalendar(); }
document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

loadMusic();