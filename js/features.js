// ==========================================
// 5. FEATURES (Merge, Search, Compare, Recap)
// ==========================================

// --- MERGE LOGIC ---

/**
 * Zet de merge-modus aan of uit en update de UI-elementen.
 */
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
        // Verwijder oranje randen van geselecteerde items
        document.querySelectorAll('.merge-selected').forEach(el => el.classList.remove('merge-selected'));
    }
    updateModalMergeButton();
}

/**
 * Ververst de knoppen onder de titel in de artiesten- of album-modal.
 */
function updateModalMergeButton() {
    const container = document.getElementById('modal-action-container');
    if (!container) return;

    const artistNameEl = document.getElementById('modal-datum-titel');
    const isArtistView = artistNameEl && !artistNameEl.innerText.startsWith('Album van');
    let artistName = isArtistView ? artistNameEl.innerText : '';

    let html = '';
    // Toon kalenderknop alleen als we NIET aan het mergen zijn
    if (isArtistView && !mergeMode) {
        html += `<button onclick="applyCalendarFilter('${escapeStr(artistName)}')" class="apply-btn-calendar" style="background:var(--spotify-green); border:none; padding:10px 20px; border-radius:10px; font-weight:700; cursor:pointer; color:black;">📅 Kalender</button>`;
    }

    if (mergeMode) {
        html += `<button onclick="toggleMergeMode()" class="btn-stop-merge" style="background:#eb4034; border:none; color:white; padding:10px 20px; border-radius:10px; font-weight:bold; cursor:pointer;">✕ Stop Merge</button>`;
        if (selectedForMerge.length >= 2) {
            html += `<button onclick="showMergeModal()" class="btn-confirm-merge-trigger" style="background:var(--spotify-green); border:none; color:black; padding:10px 20px; border-radius:10px; font-weight:bold; cursor:pointer;">✅ BEVESTIG MERGE (${selectedForMerge.length})</button>`;
        }
    } else {
        html += `<button onclick="toggleMergeMode()" class="btn-start-merge-inner" style="background:rgba(255,152,0,0.2); border:1px solid orange; color:orange; padding:10px 20px; border-radius:10px; font-weight:bold; cursor:pointer;">🛠️ Start Merge</button>`;
    }
    container.innerHTML = html;
}

/**
 * Voegt een item toe aan of verwijdert het uit de merge-selectie.
 */
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

/**
 * Update de teller in de zwevende balk.
 */
function updateMergeUI() {
    const el = document.getElementById('merge-count');
    if(el) el.innerText = `${selectedForMerge.length} geselecteerd`;
    updateModalMergeButton();
}

/**
 * Toont het definitieve keuze-venster voor het samenvoegen, inclusief covers.
 */
function showMergeModal() {
    if (selectedForMerge.length < 2) { alert("Selecteer minstens 2 items."); return; }
    
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = "Kies de Hoofdversie";
    
    let html = `<p style="text-align:center; margin-bottom:20px; color:#aaa; font-size:0.9rem;">Welke versie (en cover) moet blijven?</p>`;
    html += `<form id="merge-form" style="max-height:400px; overflow-y:auto; margin-bottom:20px; padding-right:5px;">`;
    
    selectedForMerge.forEach((obj, idx) => {
        const label = obj.type === 'song' ? obj.item.titel : obj.item.displayTitle;
        const sub = obj.item.artiest;
        const posterSrc = (obj.item.poster && obj.item.poster !== 'img/placeholder.png') 
                          ? obj.item.poster 
                          : 'https://placehold.co/64x64/1e1e1e/444444?text=🎧';

        html += `
            <label class="radio-item-merge" style="display:block; cursor:pointer; margin-bottom:12px;">
                <input type="radio" name="merge-target" value="${idx}" ${idx===0?'checked':''} style="display:none;">
                <div class="merge-option-content" style="display:flex; align-items:center; padding:15px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:18px; transition: 0.2s;">
                    <img src="${posterSrc}" style="width:60px; height:60px; border-radius:8px; object-fit:cover; margin-right:15px; background:#222;">
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <span style="font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</span>
                        <span style="font-size:0.8rem; color:#888;">${sub}</span>
                    </div>
                </div>
            </label>`;
    });
    
    html += `</form><button onclick="confirmMerge()" class="btn-merge-final">✅ Samenvoegen & Opslaan</button>`;
    
    container.innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
}

/**
 * Voert de samenvoeging uit en slaat de regels op in corrections.json.
 */
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
                existingCorrections.push({ 
                    original: { titel: obj.item.titel, artiest: obj.item.artiest }, 
                    target: { titel: targetObj.item.titel, artiest: targetObj.item.artiest } 
                });
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
    
    alert(msg + "\n\nDraai nu generate_smart_top5.py om de data te verversen.");
    document.getElementById('modal').classList.add('hidden');
    toggleMergeMode(); 
}

// --- SEARCH LOGIC ---

/**
 * Handelt de snelle zoekfunctie af in de Statistieken tab, met filter voor "Onbekend".
 */
function handleSearch() {
    const query = document.getElementById('musicSearch').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results'); 
    if (query.length < 2) { resultsContainer.innerHTML = ""; return; }

    const artistMap = {};
    statsData.forEach(s => {
        // FILTER: Sla artiest "Onbekend" over
        if (s.artiest === "Onbekend") return;
        
        const cleanName = s.artiest;
        if (!artistMap[cleanName]) artistMap[cleanName] = { name: cleanName, count: 0 };
        artistMap[cleanName].count += s.count;
    });
    
    const artistMatches = Object.values(artistMap)
        .filter(a => a.name.toLowerCase().includes(query))
        .sort((a,b) => b.count - a.count)
        .slice(0, 3);
        
    // FILTER: Sla song "Onbekend" over
    const songMatches = statsData.filter(s => 
        s.artiest !== "Onbekend" && 
        s.titel !== "Onbekend" && 
        (s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query))
    ).sort((a, b) => b.count - a.count).slice(0, 8);

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

// --- RECAP LOGIC ---

/**
 * Vult de maand-selector voor de Recap tab.
 */
function renderRecapSelector() {
    const selector = document.getElementById('recap-month-select');
    if(!selector) return;
    
    let allMonths = Object.keys(monthlyStats).sort();
    // Sla de eerste maand over (vaak onvolledig)
    if (allMonths.length > 0) allMonths.shift();
    const months = allMonths.reverse();
    
    selector.innerHTML = months.map(m => {
        const [y, mn] = m.split('-');
        const label = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date(y, mn-1));
        return `<option value="${m}">${label}</option>`;
    }).join('');
    
    if(months.length > 0) renderRecap();
}

/**
 * Genereert de visuele Recap kaart voor de geselecteerde maand.
 */
function renderRecap() {
    const selector = document.getElementById('recap-month-select');
    const monthKey = selector.value;
    const data = monthlyStats[monthKey];
    if(!data) return;

    // 1. Label instellen
    const [y, m] = monthKey.split('-');
    const dateObj = new Date(y, m - 1);
    const monthName = dateObj.toLocaleDateString('nl-NL', { month: 'long' }).toUpperCase();
    document.getElementById('wrapped-month-label').innerText = `RECAP ${monthName} ${y}`;

    // 2. Minuten berekenen (schatting: 3.5 min per play)
    const totalMinutes = Math.round(data.total_listens * 3.5);
    document.getElementById('wrapped-total-minutes').innerText = totalMinutes.toLocaleString();

    // 3. Top Artiesten met posters
    const artistsEl = document.getElementById('wrapped-artists');
    artistsEl.innerHTML = data.top_artists.slice(0, 5).map(a => {
        const info = statsData.find(s => s.artiest === a[0]);
        const poster = (info && info.poster) ? info.poster : 'img/placeholder.png';
        return `
            <div class="wrapped-item">
                <img src="${poster}">
                <div class="info"><span class="name">${a[0]}</span></div>
            </div>`;
    }).join('');

    // 4. Top Songs met posters
    const songsEl = document.getElementById('wrapped-songs');
    songsEl.innerHTML = data.top_songs.slice(0, 5).map(s => {
        const info = statsData.find(x => x.titel === s[1] && x.artiest === s[0]);
        const poster = (info && info.poster) ? info.poster : 'img/placeholder.png';
        return `
            <div class="wrapped-item">
                <img src="${poster}">
                <div class="info"><span class="name">${s[1]}</span></div>
            </div>`;
    }).join('');
}

/**
 * Gebruikt html2canvas om de recap-kaart als PNG te downloaden.
 */
function downloadWrapped() {
    const card = document.getElementById('wrapped-card');
    const monthLabel = document.getElementById('wrapped-month-label').innerText;
    
    const btn = event.target;
    btn.innerText = "⏳ Bezig...";

    html2canvas(card, {
        scale: 3, 
        useCORS: true, 
        backgroundColor: "#0c0c0c"
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Wrapped_${monthLabel.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        btn.innerText = "📸 Download als Afbeelding";
    });
}