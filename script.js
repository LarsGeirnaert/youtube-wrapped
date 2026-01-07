let currentViewDate = new Date();
let musicData = [], statsData = [], monthlyStats = {}, streakData = {}, chartData = {}, comebackData = [], activeFilter = null;
let charts = {};

// --- NAVIGATIE GESCHIEDENIS ---
let modalHistory = [];

// --- MERGE MODE STATE ---
let mergeMode = false;
let selectedForMerge = []; 
let existingCorrections = [];
let fileHandle = null;

// --- COMPARISON STATE ---
let comparisonItems = []; 

function escapeStr(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

const DB_NAME = 'MuziekDagboekDB';
const STORE_NAME = 'Settings';

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
        renderFunStats();
        updateComparisonChart(); 
        renderRecapSelector();
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

function handleListClick(name, type, poster, albumArtist, elementId) {
    if (document.getElementById('modal').classList.contains('hidden')) modalHistory = [];
    if (mergeMode) {
        if (type === 'song' || type === 'album') toggleMergeSelection(name, type, poster, albumArtist, elementId);
        else alert("Je kan alleen liedjes of albums samenvoegen.");
    } else {
        if (type === 'artist') showArtistDetails(name);
        else if (type === 'album') showAlbumDetails(poster, albumArtist);
        else showSongSpotlight(name);
    }
}

// NIEUWE FUNCTIE TOEGEVOEGD OM ERROR TE VERHELPEN
function handleAlbumClick(poster, artist, elementId) {
    showAlbumDetails(poster, artist);
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
    document.getElementById('merge-count').innerText = `${selectedForMerge.length} geselecteerd`;
    updateModalMergeButton();
}

function showMergeModal() {
    if (selectedForMerge.length < 2) { alert("Selecteer minstens 2 items."); return; }
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = "Kies de Hoofdversie";
    let html = `<p style="text-align:center;margin-bottom:15px;color:#ccc;">Welke versie moet blijven?</p>`;
    html += `<form id="merge-form" style="max-height:300px;overflow-y:auto;margin-bottom:20px;">`;
    selectedForMerge.forEach((obj, idx) => {
        const label = obj.type === 'song' ? obj.item.titel : obj.item.displayTitle;
        const sub = obj.item.artiest;
        html += `<label class="radio-item"><input type="radio" name="merge-target" value="${idx}" ${idx===0?'checked':''}><div><span style="font-weight:600;display:block;">${label}</span><span style="font-size:0.8rem;color:#aaa;">${sub}</span></div></label>`;
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
        selectedForMerge.forEach((obj, idx) => {
            if (idx !== selectedIndex) {
                existingCorrections.push({ original: obj.item, target: targetObj.item });
                newCount++;
            }
        });
    } else if (targetObj.type === 'album') {
        const targetArtist = targetObj.item.artiest;
        const targetPoster = targetObj.item.poster;
        selectedForMerge.forEach((sourceObj, idx) => {
            if (idx !== selectedIndex) {
                const songsToMove = statsData.filter(s => s.artiest === sourceObj.item.artiest && s.poster === sourceObj.item.poster);
                songsToMove.forEach(song => {
                    existingCorrections.push({
                        original: { titel: song.titel, artiest: song.artiest },
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

// --- RECAP LOGICA ---

function renderRecapSelector() {
    const selector = document.getElementById('recap-month-select');
    if(!selector) return;
    
    // 1. Alle maanden ophalen en sorteren (oud -> nieuw)
    let allMonths = Object.keys(monthlyStats).sort();

    // 2. De allereerste maand verwijderen (want vaak incompleet)
    if (allMonths.length > 0) {
        allMonths.shift();
    }

    // 3. Omdraaien zodat nieuwste bovenaan staat voor de dropdown
    const months = allMonths.reverse();
    
    selector.innerHTML = months.map(m => {
        const [y, mn] = m.split('-');
        const label = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date(y, mn-1));
        return `<option value="${m}">${label}</option>`;
    }).join('');
    
    // Render direct de eerste (dit is nu de nieuwste, min de allereerste)
    if(months.length > 0) renderRecap();
}

function renderRecap() {
    const selector = document.getElementById('recap-month-select');
    const monthKey = selector.value;
    const data = monthlyStats[monthKey];
    
    if(!data) return;

    // 1. Hero Section (Top Song)
    const topSong = data.top_songs[0]; // [Artist, Title, Count]
    if(topSong) {
        const songInfo = statsData.find(s => s.titel === topSong[1] && s.artiest === topSong[0]);
        document.getElementById('recap-hero-title').innerText = topSong[1];
        document.getElementById('recap-hero-artist').innerText = `${topSong[0]} (${topSong[2]} plays)`;
        const imgEl = document.getElementById('recap-hero-img');
        
        const poster = (songInfo && songInfo.poster !== 'img/placeholder.png') ? songInfo.poster : 'https://placehold.co/150x150/222/444?text=🎵';
        imgEl.src = poster;
    }

    // 2. Stats
    document.getElementById('recap-total-plays').innerText = data.total_listens;
    document.getElementById('recap-unique-songs').innerText = data.unique_songs || '-';
    document.getElementById('recap-unique-artists').innerText = data.unique_artists || '-';

    // 3. Lijstjes
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
            <span class="point-badge">${s[2]}x</span>
        </li>`;
    }).join('');

    const artistsEl = document.getElementById('recap-top-artists');
    artistsEl.innerHTML = data.top_artists.slice(0, 5).map((a, idx) => {
        return `<li onclick="showArtistDetails('${escapeStr(a[0])}', ${a[1]}, '${monthKey}')" style="display:flex; align-items:center;">
            <span style="width:20px; font-weight:bold; color:var(--spotify-green); margin-right:10px;">${idx+1}</span>
            <div style="flex-grow:1;">${a[0]}</div>
            <span class="point-badge">${a[1]}x</span>
        </li>`;
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

    const labels = chartData.history.labels; // Maanden (bijv. "2023-01")
    
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
            tension: 0.3
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
        type: 'bar',
        data: { labels: labels.map(l => l.substring(2)), datasets: datasetsMonthly },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ccc' } } },
            scales: { x: { grid: { display: false }, ticks: { color: '#777' } }, y: { grid: { color: '#333' }, ticks: { color: '#777' } } }
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
    charts['hours'] = new Chart(ctxHours, { type: 'bar', data: { labels: chartData.hours.labels, datasets: [{ data: chartData.hours.values, backgroundColor: 'rgba(33, 150, 243, 0.6)', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color:'#777', font:{size:9} }, grid:{display:false} }, y: { display: false } } } });

    const ctxWeek = document.getElementById('weekChart').getContext('2d');
    if (charts['week']) charts['week'].destroy();
    charts['week'] = new Chart(ctxWeek, { type: 'bar', data: { labels: chartData.weekdays.labels, datasets: [{ data: chartData.weekdays.values, backgroundColor: 'rgba(255, 165, 0, 0.6)', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color:'#777' }, grid:{display:false} }, y: { display: false } } } });

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
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } } }, 
            cutout: '70%' 
        } 
    });
}

function renderStatsDashboard() {
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 9);
    const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 9);
    
    renderList('top-songs-list', topSongs.map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list', topArtists.map(a => [a[0], a[1], null]), 'x', 'artist');
    renderList('comeback-list', comebackData.slice(0, 9).map(c => [`${c.titel} - ${c.artiest}`, `${c.gap}d stilte`, c.poster, c.periode]), '', 'song');

    if (streakData.songs_current) {
        renderList('current-song-streaks', streakData.songs_current.slice(0, 9).map(s => [`${s.titel} - ${s.artiest}`, s.streak, statsData.find(x=>x.titel===s.titel)?.poster, s.period]), ' d', 'song');
        renderList('top-song-streaks', streakData.songs_top.slice(0, 9).map(s => [`${s.titel} - ${s.artiest}`, s.streak, statsData.find(x=>x.titel===s.titel)?.poster, s.period]), ' d', 'song');
        renderList('current-artist-streaks', streakData.artists_current.slice(0, 9).map(a => [a.naam, a.streak, null, a.period]), ' d', 'artist');
        renderList('top-artist-streaks', streakData.artists_top.slice(0, 9).map(a => [a.naam, a.streak, null, a.period]), ' d', 'artist');
    }

    const albumMap = {};
    statsData.forEach(s => {
        if (s.poster === "img/placeholder.png") return;
        const key = getAlbumKey(s.poster, s.artiest);
        if (!albumMap[key]) albumMap[key] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() };
        albumMap[key].total += s.count; albumMap[key].unique.add(s.titel);
    });
    const albums = Object.values(albumMap);
    
    renderList('top-albums-listens', albums.sort((a,b) => b.total - a.total).slice(0, 9).map(a => [`Album van ${a.artiest}`, a.total, a.poster, a.artiest]), 'x', 'album');
    
    const sortedVariety = [...albums].sort((a,b) => b.unique.size - a.unique.size);
    const filteredVariety = []; const counts = {};
    for (const alb of sortedVariety) {
        if (filteredVariety.length >= 9) break;
        const art = alb.artiest; counts[art] = (counts[art] || 0) + 1;
        if (counts[art] <= 2) filteredVariety.push(alb);
    }
    renderList('top-albums-variety', filteredVariety.map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster, a.artiest]), ' songs', 'album');

    const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
    const obsessions = [], explorers = [];
    Object.entries(artistGroups).forEach(([artist, songs]) => {
        if (songs.length === 1 && songs[0].count > 50) obsessions.push([`${songs[0].titel} - ${artist}`, songs[0].count, songs[0].poster]);
        if (songs.length >= 9) explorers.push([artist, songs.length, null]);
    });
    renderList('obsessions-list', obsessions.sort((a,b) => b[1] - a[1]).slice(0, 9), 'x', 'song');
    renderList('variety-list', explorers.sort((a,b) => b[1] - a[1]).slice(0, 9), ' songs', 'artist');
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
            const escapedName = escapeStr(songName);
            const elementId = `month-song-${idx}`;
            return `<li id="${elementId}" onclick="handleListClick('${escapedName}', 'song', '${info ? info.poster : 'img/placeholder.png'}', '', '${elementId}')">
                <img src="${info ? info.poster : 'img/placeholder.png'}" style="width:20px; height:20px; border-radius:4px; margin-right:8px;">
                <span style="flex-grow:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${songName}</span>
                <span style="color:var(--text-muted); font-size:0.7rem; margin-left:5px;">${s[2]}x</span></li>`;
        }).join('');
        artistsEl.innerHTML = data.top_artists.slice(0, 5).map(a => `<li onclick="showArtistDetails('${escapeStr(a[0])}', ${a[1]}, '${monthKey}')">
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
    // calculateMonthlyHighlights verwijderd
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
    
    // Streak blijft geldig als je gisteren OF vandaag geluisterd hebt.
    const lastListenDate = dates[0];
    if (lastListenDate !== todayStr && lastListenDate !== yesterdayStr) {
        document.getElementById('streak-count').innerText = 0;
        return;
    }
    
    let streak = 1; 
    for (let i = 0; i < dates.length - 1; i++) { 
        const current = new Date(dates[i]);
        const previous = new Date(dates[i+1]);
        
        // Verschil in dagen berekenen
        const diffTime = Math.abs(current - previous);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays === 1) {
            streak++;
        } else {
            break; 
        }
    }
    document.getElementById('streak-count').innerText = streak;
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

loadMusic();