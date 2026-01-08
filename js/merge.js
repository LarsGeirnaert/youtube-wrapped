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