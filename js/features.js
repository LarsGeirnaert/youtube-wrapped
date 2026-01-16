// ==========================================
// 5. FEATURES (Merge, Search, Compare, Recap)
// ==========================================

// --- MERGE LOGIC ---
function toggleMergeMode() {
    mergeMode = !mergeMode;
    const btn = document.getElementById('btn-merge-mode');
    const instr = document.getElementById('merge-instructions');
    const bar = document.getElementById('merge-action-bar');
    
    if (mergeMode) {
        if(btn) {
            btn.innerText = "✕ Stop Merge Mode";
            btn.classList.add('active-stop');
        }
        if(instr) instr.classList.remove('hidden');
        if(bar) bar.classList.add('visible');
        selectedForMerge = [];
        updateMergeUI();
    } else {
        if(btn) {
            btn.innerText = "Start Merge Mode";
            btn.classList.remove('active-stop');
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
        html += `<button onclick="applyCalendarFilter('${escapeStr(artistName)}')" class="apply-btn" style="background:var(--spotify-green); border:none; padding:10px; width:auto; border-radius:10px; font-weight:700; cursor:pointer; color:black;">📅 Kalender</button>`;
    }

    if (mergeMode) {
        html += `<button onclick="toggleMergeMode()" style="background:#eb4034;border:1px solid #eb4034;color:white;width:auto;padding:10px 15px;border-radius:10px;font-weight:bold;cursor:pointer;">✕ Stop Merge</button>`;
        if (selectedForMerge.length >= 2) {
            html += `<button onclick="showMergeModal()" style="background:var(--spotify-green); border:1px solid var(--spotify-green); color:black; width:auto; padding:10px 15px; border-radius:10px; font-weight:bold; cursor:pointer; animation: pulse 1s infinite;">✅ BEVESTIG MERGE (${selectedForMerge.length})</button>`;
        }
    } else {
        html += `<button onclick="toggleMergeMode()" style="background:rgba(255,152,0,0.2);border:1px solid orange;color:orange;width:auto;padding:10px 15px;border-radius:10px;font-weight:bold;cursor:pointer;">🛠️ Start Merge</button>`;
    }
    container.innerHTML = html;
}

function toggleMergeSelection(name, type, poster, albumArtist, elementId) {
    if (selectedForMerge.length > 0 && selectedForMerge[0].type !== type) { 
        alert(`Je kan geen ${type} met een ${selectedForMerge[0].type} mixen.`); 
        return; 
    }
    
    let item = {};
    let key = "";
    
    if (type === 'song') {
        let parts = name.split(' - ');
        let artiest = parts.length > 1 ? parts.pop().trim() : name.trim();
        let titel = parts.join(' - ').trim();
        item = { artiest: artiest, titel: titel, poster: poster };
        key = `song|${artiest}|${titel}`.toLowerCase();
    } else if (type === 'album') {
        const realArtist = albumArtist || name.replace('Album van ', '');
        item = { artiest: realArtist, poster: poster, displayTitle: name };
        key = `album|${realArtist}|${poster}`;
    }

    const index = selectedForMerge.findIndex(x => x.key === key);
    const el = document.getElementById(elementId);
    
    if (index > -1) {
        selectedForMerge.splice(index, 1);
        if(el) el.classList.remove('merge-selected');
    } else {
        selectedForMerge.push({ key: key, naam: name, item: item, type: type });
        if(el) el.classList.add('merge-selected');
    }
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
        let posterSrc = (obj.item.poster && obj.item.poster !== 'img/placeholder.png') ? obj.item.poster : 'https://placehold.co/64x64/1e1e1e/444444?text=💿';
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
                const sourceKey = getAlbumKey(sourceObj.item.poster, sourceObj.item.artiest);
                const songsToMove = statsData.filter(s => getAlbumKey(s.poster, s.artiest) === sourceKey);
                songsToMove.forEach(song => {
                    existingCorrections.push({ original: { titel: song.titel, artiest: song.artiest }, target: { titel: song.titel, artiest: targetArtist, poster: targetPoster } });
                    newCount++;
                });
            }
        });
    }

    const isAuto = await saveCorrections();
    alert(`Succes! ${newCount} correctieregels toegevoegd.`);
    document.getElementById('modal').classList.add('hidden');
    toggleMergeMode(); 
}

function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results'); 
    if (query.length < 2) { resultsContainer.innerHTML = ""; return; }
    const artistMap = {};
    statsData.forEach(s => {
        if (s.artiest === "Onbekend") return;
        const cleanName = s.artiest;
        if (!artistMap[cleanName]) artistMap[cleanName] = { name: cleanName, count: 0 };
        artistMap[cleanName].count += s.count;
    });
    const artistMatches = Object.values(artistMap).filter(a => a.name.toLowerCase().includes(query)).sort((a,b) => b.count - a.count).slice(0, 3);
    const songMatches = statsData.filter(s => s.artiest !== "Onbekend" && s.titel !== "Onbekend" && (s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query))).sort((a, b) => b.count - a.count).slice(0, 8);
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
            const escapedName = escapeStr(`${s.titel} - ${s.artiest}`);
            const elementId = `search-song-${idx}`;
            const posterSrc = (s.poster && s.poster !== 'img/placeholder.png') ? s.poster : 'https://placehold.co/64x64/1e1e1e/444444?text=🎵';
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapedName}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:5px; cursor:pointer;"><img src="${posterSrc}" onerror="this.src='https://placehold.co/64x64/1e1e1e/444444?text=🎵'" style="width:40px; height:40px; border-radius:6px; margin-right:12px;"><div style="flex-grow:1;"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div><span class="point-badge">${s.count}x</span></div>`;
        }).join('');
    }
    resultsContainer.innerHTML = html;
}

function handleComparisonSearch(type) {
    const inputId = type === 'song' ? 'comp-song-search' : 'comp-artist-search';
    const resultsId = type === 'song' ? 'comp-song-results' : 'comp-artist-results';
    const query = document.getElementById(inputId).value.toLowerCase().trim();
    const dropdown = document.getElementById(resultsId);
    if (query.length < 2) { dropdown.classList.add('hidden'); return; }
    let matches = [];
    if (type === 'song') { matches = statsData.filter(s => s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query)).sort((a,b) => b.count - a.count).slice(0, 5); } 
    else { const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; }); matches = Object.keys(artistMap).filter(a => a.toLowerCase().includes(query)).map(a => ({ artiest: a, count: artistMap[a] })).sort((a,b) => b.count - a.count).slice(0, 5); }
    if (matches.length > 0) { dropdown.innerHTML = matches.map(m => `<div class="comp-result-item" onclick="addToComparison('${escapeStr(type === 'song' ? m.titel+'|'+m.artiest : m.artiest)}', '${type}')"><b>${type === 'song' ? m.titel : m.artiest}</b><br><small>${type === 'song' ? m.artiest : m.count+'x'}</small></div>`).join(''); dropdown.classList.remove('hidden'); } else { dropdown.classList.add('hidden'); }
}
function addToComparison(key, type) {
    if (comparisonItems.length >= 5) { alert("Max 5 items tegelijk vergelijken."); return; }
    let label = key; if (type === 'song') { const [t, a] = key.split('|'); label = `${t} - ${a}`; }
    if (!comparisonItems.some(i => i.key === key && i.type === type)) { comparisonItems.push({ type: type, key: key, label: label }); updateComparisonUI(); updateComparisonChart(); }
    document.getElementById('comp-song-search').value = ''; document.getElementById('comp-artist-search').value = ''; document.querySelectorAll('.search-dropdown').forEach(d => d.classList.add('hidden'));
}
function removeFromComparison(index) { comparisonItems.splice(index, 1); updateComparisonUI(); updateComparisonChart(); }
function updateComparisonUI() { const container = document.getElementById('selected-chips'); container.innerHTML = comparisonItems.map((item, idx) => `<div class="comp-chip">${item.label} <span onclick="removeFromComparison(${idx})">&times;</span></div>`).join(''); }
function handleRepertoireSearch() { const query = document.getElementById('repertoire-search').value.toLowerCase().trim(); const dropdown = document.getElementById('repertoire-results'); if (query.length < 2) { dropdown.classList.add('hidden'); return; }
    const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const matches = Object.keys(artistMap).filter(a => a.toLowerCase().includes(query)).map(a => ({ artiest: a, count: artistMap[a] })).sort((a,b) => b.count - a.count).slice(0, 5);
    if (matches.length > 0) { dropdown.innerHTML = matches.map(m => `<div class="comp-result-item" onclick="showRepertoireChart('${escapeStr(m.artiest)}')"><b>${m.artiest}</b><br><small>${m.count}x plays</small></div>`).join(''); dropdown.classList.remove('hidden'); } else { dropdown.classList.add('hidden'); }
}
function showRepertoireChart(artistName) { document.getElementById('repertoire-search').value = ''; document.getElementById('repertoire-results').classList.add('hidden'); document.getElementById('repertoire-chart-container').classList.remove('hidden'); document.getElementById('repertoire-title').innerText = `Top 5 van ${artistName}`; renderRepertoireGrowthChart(artistName); renderRepertoireMonthlyChart(artistName); }
function renderRecapSelector() { const selector = document.getElementById('recap-month-select'); if(!selector) return; let allMonths = Object.keys(monthlyStats).sort(); if (allMonths.length > 0) allMonths.shift(); const months = allMonths.reverse(); selector.innerHTML = months.map(m => { const [y, mn] = m.split('-'); const label = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date(y, mn-1)); return `<option value="${m}">${label}</option>`; }).join(''); if(months.length > 0) renderRecap(); }
function renderRecap() { const selector = document.getElementById('recap-month-select'); const monthKey = selector.value; const data = monthlyStats[monthKey]; if(!data) return; const [y, m] = monthKey.split('-'); const dateObj = new Date(y, m - 1); const monthName = dateObj.toLocaleDateString('nl-NL', { month: 'long' }).toUpperCase(); document.getElementById('wrapped-month-label').innerText = `RECAP ${monthName} ${y}`; const totalMinutes = Math.round(data.total_listens * 3.5); document.getElementById('wrapped-total-minutes').innerText = totalMinutes.toLocaleString();
    document.getElementById('wrapped-artists').innerHTML = data.top_artists.slice(0, 5).map(a => `<div class="wrapped-item"><img src="${statsData.find(s => s.artiest === a[0])?.poster || 'img/placeholder.png'}"><div class="info"><span class="name">${a[0]}</span></div></div>`).join('');
    document.getElementById('wrapped-songs').innerHTML = data.top_songs.slice(0, 5).map(s => `<div class="wrapped-item"><img src="${statsData.find(x => x.titel === s[1] && x.artiest === s[0])?.poster || 'img/placeholder.png'}"><div class="info"><span class="name">${s[1]}</span></div></div>`).join('');
}
function downloadWrapped() { const card = document.getElementById('wrapped-card'); const monthLabel = document.getElementById('wrapped-month-label').innerText; const btn = event.target; btn.innerText = "⏳ Bezig..."; html2canvas(card, { scale: 3, useCORS: true, backgroundColor: "#0c0c0c" }).then(canvas => { const link = document.createElement('a'); link.download = `Wrapped_${monthLabel.replace(' ', '_')}.png`; link.href = canvas.toDataURL("image/png"); link.click(); btn.innerText = "📸 Download als Afbeelding"; }); }