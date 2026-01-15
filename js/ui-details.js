// ==========================================
// 4. DETAIL VIEWS (MODALS)
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
    
    // Naam opschonen (bijv. "Drake (feat...)" -> "Drake")
    let cleanArtist = artist.includes('(') ? artist.split('(')[1].replace(')', '') : artist;
    
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = cleanArtist;
    
    let songsToShow = []; 
    let label = "totaal";
    
    // Bepaal welke songs we laten zien (totaal of per maand)
    if (monthKey && monthlyStats[monthKey] && monthlyStats[monthKey].artist_details[cleanArtist]) {
        songsToShow = monthlyStats[monthKey].artist_details[cleanArtist].map(i => { 
            const info = statsData.find(x => x.artiest === cleanArtist && x.titel === i[0]); 
            return { 
                titel: i[0], 
                count: i[1], 
                poster: info ? info.poster : 'img/placeholder.png', 
                artiest: cleanArtist 
            }; 
        });
        label = "deze maand";
    } else { 
        songsToShow = statsData.filter(s => s.artiest === cleanArtist.trim()).sort((a,b) => b.count - a.count); 
    }

    // Albums verzamelen
    const albums = {};
    songsToShow.forEach(s => {
        if (s.poster && s.poster !== "img/placeholder.png") {
            const albumKey = getAlbumKey(s.poster, s.artiest);
            if (!albums[albumKey]) albums[albumKey] = { poster: s.poster, count: 0, title: 'Album' };
            albums[albumKey].count += s.count;
        }
    });
    const sortedAlbums = Object.values(albums).sort((a,b) => b.count - a.count);

    // --- NIEUW: STREAKS OPHALEN ---
    const topStreaks = getArtistStreaks(cleanArtist);

    // HTML Bouwen
    let html = '';
    if (overrideCount) html += `<p style="text-align:center; color:var(--spotify-green); margin-bottom:10px; font-weight:700;">${monthKey ? 'Deze maand' : 'Totaal'} ${overrideCount}x geluisterd</p>`;
    
    html += `<div id="modal-action-container" style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;"></div>`;

    // --- NIEUW: STREAKS WEERGEVEN ---
    if (topStreaks.length > 0) {
        html += `<h3 style="font-size:0.9rem; color:#aaa; margin-bottom:10px; text-transform:uppercase; border-bottom:1px solid #333; padding-bottom:5px;">🔥 Beste Streaks</h3>`;
        html += `<div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:5px; margin-bottom:20px;">`;
        
        topStreaks.forEach(st => {
            // Datums formatteren voor weergave
            const d1Obj = new Date(st.start);
            const d2Obj = new Date(st.end);
            const d1 = d1Obj.toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: '2-digit'});
            const d2 = d2Obj.toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: '2-digit'});
            const periodStr = d1 === d2 ? d1 : `${d1} ➔ ${d2}`;
            
            // Datums formatteren voor filter (YYYY-MM-DD strings)
            // Let op: st.start en st.end zijn hier strings uit getArtistStreaks (want die haalt ze uit fullHistoryData)
            // Als getArtistStreaks ze als strings teruggeeft (zoals in globals.js), kunnen we ze direct gebruiken.
            // Als het Date objecten zijn, moeten we ze converteren.
            // De globals.js code die ik gaf gebruikt 'currentStreak.end = uniqueDates[i]' wat een string is.
            
            const sStr = st.start; 
            const eStr = st.end; 

            // Klikbaar maken -> Song title sturen we als null, zodat de kalender ALLE liedjes van de artiest toont
            html += `
                <div class="streak-row" onclick="applyCalendarFilter('${escapeStr(cleanArtist)}', '${sStr}', '${eStr}', null)" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
                    <span class="streak-days">${st.count} dagen</span>
                    <span class="streak-dates">${periodStr}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

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
            // FIX VOOR CRASH:
            // We maken een nieuw Date object. Als st.start al een string is, werkt dit.
            // Als het al een Date object is, werkt dit ook.
            const d1Obj = new Date(st.start);
            const d2Obj = new Date(st.end);
            
            const d1 = d1Obj.toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: '2-digit'});
            const d2 = d2Obj.toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: '2-digit'});
            const periodStr = d1 === d2 ? d1 : `${d1} ➔ ${d2}`;
            
            // Format datums voor filter (YYYY-MM-DD)
            // .toISOString() crasht als de datum ongeldig is, dus we doen een check
            let sStr = "", eStr = "";
            try {
                sStr = d1Obj.toISOString().split('T')[0];
                eStr = d2Obj.toISOString().split('T')[0];
            } catch (e) {
                // Fallback als conversie mislukt (bijv als st.start al de string "2023-01-01" is, gebruiken we die)
                sStr = st.start;
                eStr = st.end;
            }

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
    // STREAKS FIX: 7 items (inclusief datums)
    else if (category.includes('streaks')) { 
        const key = category.split('streaks-')[1].replace('-', '_'); 
        items = streakData[key].map(s => [
            s.titel ? `${s.titel} - ${s.artiest}` : s.naam, 
            s.streak, 
            statsData.find(x => x.titel === s.titel)?.poster, 
            s.titel ? 'song' : 'artist', 
            null, 
            s.period, 
            s.start, s.end
        ]); 
    }
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
             let songArg = null;
             if(actualType === 'song') {
                 // Haal de titel uit de volledige string "Titel - Artiest"
                 const parts = name.split(' - ');
                 // Omdat we in renderList pop() gebruikten, moeten we hier voorzichtig zijn.
                 // renderList split logic:
                 // filterArtist = parts.pop(); filterSong = parts.join(' - ');
                 // We doen hier hetzelfde:
                 songArg = parts.slice(0, parts.length - 1).join(' - ');
             }

             if (start && end) {
                 badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(artistArg)}', '${start}', '${end}', '${escapeStr(songArg||'')}')"`;
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
                    <span class="point-badge" ${badgeAttr} style="${badgeStyle}" onmouseover="this.style.background='var(--spotify-green)';this.style.color='black'" onmouseout="this.style.background='rgba(29,185,84,0.15)';this.style.color='var(--spotify-green)'">${val}${unit||' d'}</span></li>`;
    }).join('') + `</ul>`;
    document.getElementById('modal').classList.remove('hidden');
}