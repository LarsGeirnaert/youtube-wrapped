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
        html += `<div class="comp-result-item" onclick="renderRankingHistoryChart('${escapeStr(a)}', 'artist')">
                    <b>🎤 ${a}</b><br><small>Toon Ranking Historie</small>
                </div>`;
    });
    
    songMatches.forEach(s => {
        html += `<div class="comp-result-item" onclick="renderRankingHistoryChart('${escapeStr(s.titel)}', 'song', '${escapeStr(s.artiest)}')">
                    <b>🎵 ${s.titel}</b><br><small>${s.artiest}</small>
                </div>`;
    });

    if (html === '') {
        dropdown.classList.add('hidden');
    } else {
        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
    }
}