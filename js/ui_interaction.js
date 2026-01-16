// ==========================================
// BESTAND: js/ui_interaction.js
// DOEL: Interacties in de Grafieken sectie
// ==========================================

function handleHistorySearch() {
    const query = document.getElementById('history-search').value.toLowerCase().trim();
    const dropdown = document.getElementById('history-search-results');
    
    if (query.length < 2) { 
        dropdown.classList.add('hidden'); 
        return; 
    }

    // Zoek artiesten in statsData (geaggregeerd)
    const artistMap = {};
    statsData.forEach(s => { 
        artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; 
    });
    
    const artistMatches = Object.keys(artistMap)
        .filter(a => a.toLowerCase().includes(query))
        .sort((a, b) => artistMap[b] - artistMap[a])
        .slice(0, 3);

    // Zoek songs in statsData
    const songMatches = statsData
        .filter(s => s.titel.toLowerCase().includes(query) || s.artiest.toLowerCase().includes(query))
        .sort((a,b) => b.count - a.count)
        .slice(0, 5);

    let html = '';
    
    artistMatches.forEach(a => {
        const artInfo = statsData.find(s => s.artiest === a);
        const poster = (artInfo && artInfo.poster && artInfo.poster !== 'img/placeholder.png') ? artInfo.poster : 'img/placeholder.png';
        
        // OPTIE 1: De artiest zelf
        html += `<div class="comp-result-item" onclick="renderRankingHistoryChart('${escapeStr(a)}', 'artist')">
                    <img src="${poster}" style="width:30px; height:30px; border-radius:50%; margin-right:10px; object-fit:cover; vertical-align:middle;">
                    <div style="display:inline-block; vertical-align:middle;">
                        <b>🎤 ${a} (Artiest)</b><br><small>Verloop van algemene positie</small>
                    </div>
                </div>`;
        
        // OPTIE 2: Alle liedjes van de artiest
        html += `<div class="comp-result-item" onclick="renderRankingHistoryChart('${escapeStr(a)}', 'artist-all-songs')">
                    <img src="${poster}" style="width:30px; height:30px; border-radius:50%; margin-right:10px; object-fit:cover; vertical-align:middle; border: 2px solid var(--spotify-green);">
                    <div style="display:inline-block; vertical-align:middle;">
                        <b>🎵 ${a} (Alle Songs)</b><br><small>Verloop van alle Top 100 hits</small>
                    </div>
                </div>`;
    });
    
    songMatches.forEach(s => {
        const poster = (s.poster && s.poster !== 'img/placeholder.png') ? s.poster : 'img/placeholder.png';
        
        html += `<div class="comp-result-item" onclick="renderRankingHistoryChart('${escapeStr(s.titel)}', 'song', '${escapeStr(s.artiest)}')">
                    <img src="${poster}" style="width:30px; height:30px; border-radius:4px; margin-right:10px; object-fit:cover; vertical-align:middle;">
                    <div style="display:inline-block; vertical-align:middle;">
                        <b>🎵 ${s.titel}</b><br><small>${s.artiest}</small>
                    </div>
                </div>`;
    });

    if (html === '') {
        dropdown.classList.add('hidden');
    } else {
        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
    }
}

function handleRepertoireSearch() {
    const query = document.getElementById('repertoire-search').value.toLowerCase().trim();
    const dropdown = document.getElementById('repertoire-results');
    
    if (query.length < 2) { dropdown.classList.add('hidden'); return; }

    const artistMap = {};
    statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const matches = Object.keys(artistMap)
        .filter(a => a.toLowerCase().includes(query))
        .map(a => ({ artiest: a, count: artistMap[a] }))
        .sort((a,b) => b.count - a.count).slice(0, 5);

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(m => {
            const artInfo = statsData.find(s => s.artiest === m.artiest);
            const poster = (artInfo && artInfo.poster && artInfo.poster !== 'img/placeholder.png') ? artInfo.poster : 'img/placeholder.png';
            return `<div class="comp-result-item" onclick="showRepertoireChart('${escapeStr(m.artiest)}', '${poster}')">
                        <img src="${poster}" style="width:30px; height:30px; border-radius:50%; margin-right:10px; object-fit:cover; vertical-align:middle;">
                        <div style="display:inline-block; vertical-align:middle;">
                            <b>🎤 ${m.artiest}</b><br><small>${m.count}x plays</small>
                        </div>
                    </div>`;
        }).join('');
        dropdown.classList.remove('hidden');
    } else { dropdown.classList.add('hidden'); }
}

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
            
            // Zoek poster
            let poster = 'img/placeholder.png';
            if (type === 'song') {
                poster = m.poster || 'img/placeholder.png';
            } else {
                const artInfo = statsData.find(s => s.artiest === m.artiest);
                poster = (artInfo && artInfo.poster) ? artInfo.poster : 'img/placeholder.png';
            }

            return `<div class="comp-result-item" onclick="addToComparison('${escapeStr(clickArg)}', '${type}', '${poster}')">
                        <img src="${poster}" style="width:30px; height:30px; border-radius:${type==='artist'?'50%':'4px'}; margin-right:10px; object-fit:cover; vertical-align:middle;">
                        <div style="display:inline-block; vertical-align:middle;">
                            <b>${name}</b><br><small>${sub}</small>
                        </div>
                    </div>`;
        }).join('');
        dropdown.classList.remove('hidden');
    } else { dropdown.classList.add('hidden'); }
}

function addToComparison(key, type, poster) {
    if (comparisonItems.length >= 5) { alert("Max 5 items tegelijk vergelijken."); return; }
    
    let label = key;
    if (type === 'song') {
        const [t, a] = key.split('|');
        label = `${t} - ${a}`;
    }

    if (!comparisonItems.some(i => i.key === key && i.type === type)) {
        comparisonItems.push({ type: type, key: key, label: label, poster: poster });
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
        `<div class="comp-chip">
            <img src="${item.poster}" style="width:18px; height:18px; border-radius:${item.type==='artist'?'50%':'2px'}; object-fit:cover;">
            ${item.label} 
            <span onclick="removeFromComparison(${idx})">&times;</span>
        </div>`
    ).join('');
}