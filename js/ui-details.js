// ==========================================
// 4. DETAIL VIEWS (MODALS)
// ==========================================

// Aangepast: Berekent de top 3 liedjes op basis van de BESTE piekpositie ooit
function getArtistTopHits(artistName) {
    let songPeaks = {}; // Formaat: { "Song Titel": { bestRank: X, occurrences: Y } }

    Object.values(monthlyStats).forEach(month => {
        month.top_songs.forEach((s, index) => {
            // s[0] = Artiest, s[1] = Titel
            if (s[0] === artistName) {
                const songTitle = s[1];
                const currentRank = index + 1;

                if (!songPeaks[songTitle]) {
                    songPeaks[songTitle] = { bestRank: currentRank, occurrences: 1 };
                } else {
                    if (currentRank < songPeaks[songTitle].bestRank) {
                        // Nieuwe absolute piek gevonden
                        songPeaks[songTitle].bestRank = currentRank;
                        songPeaks[songTitle].occurrences = 1;
                    } else if (currentRank === songPeaks[songTitle].bestRank) {
                        // Piek opnieuw behaald
                        songPeaks[songTitle].occurrences++;
                    }
                }
            }
        });
    });

    // Sorteer op bestRank (laagste getal is beter)
    // Bij gelijke rank: sorteer op hoe vaak die rank behaald is
    return Object.entries(songPeaks)
        .sort((a, b) => {
            if (a[1].bestRank !== b[1].bestRank) {
                return a[1].bestRank - b[1].bestRank;
            }
            return b[1].occurrences - a[1].occurrences;
        })
        .slice(0, 3)
        .map(entry => entry[0]);
}

function calculatePeakStat(targetName, type, targetArtist = null) {
    let bestRank = 101;
    let occurrences = 0;
    let bestMonthLabel = "";
    const monthNames = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];

    Object.keys(monthlyStats).forEach(monthKey => {
        const data = monthlyStats[monthKey];
        let currentRank = -1;
        if (type === 'artist') {
            currentRank = data.top_artists.findIndex(a => a[0] === targetName) + 1;
        } else {
            currentRank = data.top_songs.findIndex(s => s[1] === targetName && s[0] === targetArtist) + 1;
        }

        if (currentRank > 0 && currentRank <= 100) {
            if (currentRank < bestRank) {
                bestRank = currentRank; occurrences = 1;
                const [year, month] = monthKey.split('-');
                bestMonthLabel = `${monthNames[parseInt(month) - 1]} '${year.substring(2)}`;
            } else if (currentRank === bestRank) {
                occurrences++;
            }
        }
    });

    if (bestRank > 100) return null;
    const rankClass = bestRank === 1 ? 'rank-1' : '';
    const subText = occurrences > 1 ? `${occurrences}x behaald` : `in ${bestMonthLabel}`;

    return `
        <div class="peak-value-container">
            <span class="peak-rank ${rankClass}">#${bestRank}</span>
            <span class="peak-label">${subText}</span>
        </div>
    `;
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

function showAlbumDetails(posterUrl, artistName, isBack = false) {
    if (!isBack) addToHistory('album', arguments);
    const key = getAlbumKey(posterUrl, artistName);
    const albumSongs = statsData.filter(s => getAlbumKey(s.poster, s.artiest) === key).sort((a,b) => b.count - a.count);
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = `Album van ${artistName}`;
    container.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;"><img src="${posterUrl}" style="width:140px;border-radius:20px;box-shadow:var(--shadow-lg);">
        <div id="modal-action-container" style="display:flex; justify-content:center; gap:10px; margin-top:10px;"></div></div>
        <div class="modal-list-wrapper">${albumSongs.map((s, idx) => {
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

    const sortedAlbums = Object.values(songsToShow.reduce((acc, s) => {
        if (s.poster && s.poster !== "img/placeholder.png") {
            const key = getAlbumKey(s.poster, s.artiest);
            if (!acc[key]) acc[key] = { poster: s.poster, count: 0 };
            acc[key].count += s.count;
        }
        return acc;
    }, {})).sort((a,b) => b.count - a.count);

    const topStreaks = getArtistStreaks(cleanArtist);
    const peakStat = calculatePeakStat(cleanArtist, 'artist');
    const topHits = getArtistTopHits(cleanArtist);

    let html = '';
    if (overrideCount) html += `<p style="text-align:center; color:var(--spotify-green); margin-bottom:10px; font-weight:700;">${monthKey ? 'Deze maand' : 'Totaal'} ${overrideCount}x geluisterd</p>`;
    if (peakStat) html += `<div class="spotlight-stat-box" style="margin: 0 auto 15px; max-width: 200px; background: rgba(255,204,0,0.1); border-color: #ffcc00;">${peakStat}</div>`;

    html += `<div id="modal-action-container" style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;"></div>`;

    // TOP 3 LIEDJES (Geselecteerd op beste piekpositie ooit)
    if (topHits.length > 0) {
        html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">🏆 Top 100 All-Time Hits</h3>`;
        html += `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:20px;">`;
        topHits.forEach((hitTitle, idx) => {
            const info = statsData.find(s => s.artiest === cleanArtist && s.titel === hitTitle);
            const poster = (info && info.poster) ? info.poster : 'img/placeholder.png';
            html += `
                <div onclick="showSongSpotlight('${escapeStr(hitTitle + ' - ' + cleanArtist)}')" style="cursor:pointer; text-align:center;">
                    <div style="position:relative; width:100%; aspect-ratio:1/1;">
                        <img src="${poster}" style="width:100%; height:100%; border-radius:8px; object-fit:cover; border:1px solid var(--glass-border);">
                        <span style="position:absolute; top:-5px; left:-5px; width:22px; height:22px; background:var(--spotify-green); color:black; border-radius:50%; font-size:0.7rem; font-weight:800; display:flex; align-items:center; justify-content:center;">${idx+1}</span>
                    </div>
                    <span style="display:block; font-size:0.65rem; font-weight:600; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${hitTitle}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    if (topStreaks.length > 0) {
        html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">🔥 Beste Streaks</h3><div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:5px; margin-bottom:15px;">`;
        topStreaks.forEach(st => {
            const d1 = new Date(st.start).toLocaleDateString('nl-NL', {day:'numeric', month:'short'});
            const d2 = new Date(st.end).toLocaleDateString('nl-NL', {day:'numeric', month:'short'});
            html += `<div class="streak-row" onclick="applyCalendarFilter('${escapeStr(cleanArtist)}', '${st.start}', '${st.end}', null)" style="cursor:pointer; padding:8px; display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--spotify-green); font-weight:bold;">${st.count} dagen</span><span style="color:#777;">${d1} ➔ ${d2}</span></div>`;
        });
        html += `</div>`;
    }

    if (sortedAlbums.length > 0) {
        html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Albums</h3><div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px; margin-bottom:10px;">`;
        sortedAlbums.forEach(alb => {
            html += `<div onclick="handleAlbumClick('${alb.poster}', '${escapeStr(cleanArtist)}', '')" style="flex-shrink:0; cursor:pointer;"><img src="${alb.poster}" style="width:70px; height:70px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.3);"></div>`;
        });
        html += `</div>`;
    }

    html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Alle Songs</h3>`;
    html += `<div>${songsToShow.map((s, idx) => {
            const elementId = `artist-det-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapeStr(s.titel + ' - ' + cleanArtist)}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;"><img src="${s.poster}" style="width:30px;height:30px;border-radius:5px;margin-right:10px;"><div style="flex-grow:1; font-size:0.9rem;"><b>${s.titel}</b></div><span class="point-badge" style="background:transparent; color:#777;">${s.count}x</span></div>`;
        }).join('')}</div>`;
    
    container.innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
    updateModalMergeButton();
}

function showSongSpotlight(songFull, overrideCount = null, isBack = false) {
    if (!isBack) addToHistory('song', arguments);
    let titel, artiest; 
    if (songFull.includes(' - ')) { 
        const lastDashIndex = songFull.lastIndexOf(' - ');
        titel = songFull.substring(0, lastDashIndex); artiest = songFull.substring(lastDashIndex + 3);
    } else { titel = songFull; artiest = "Onbekend"; }
    
    const s = statsData.find(x => x.titel === titel && x.artiest === artiest) || { poster: 'img/placeholder.png', artiest: artiest, count: 0 };
    const countToDisplay = overrideCount !== null ? overrideCount : s.count;
    const artistSongs = statsData.filter(x => x.artiest === artiest).sort((a, b) => b.count - a.count);
    const rank = artistSongs.findIndex(x => x.titel === titel) + 1;
    const totalArtistPlays = artistSongs.reduce((sum, item) => sum + item.count, 0);
    const percentage = totalArtistPlays > 0 ? ((s.count / totalArtistPlays) * 100).toFixed(1) + '%' : '0%';
    const topStreaks = getSongStreaks(titel, artiest);
    const peakStat = calculatePeakStat(titel, 'song', artiest);
    
    let html = `
        <div class="vinyl-container">
            <div class="vinyl-record"></div>
            <img src="${s.poster}" class="vinyl-cover">
        </div>
        <h2 style="text-align:center; font-size:1.4rem; line-height:1.2; margin-bottom:2px;">${titel}</h2>
        <p style="text-align:center; color:var(--spotify-green); font-weight:bold; margin-bottom:20px;">${artiest}</p>

        <div class="spotlight-stats-grid">
            <div class="spotlight-stat-box"><span class="spotlight-stat-val">${countToDisplay}x</span><span class="spotlight-stat-label">Plays</span></div>
            <div class="spotlight-stat-box">${peakStat ? peakStat : '<span class="spotlight-stat-val">-</span><span class="spotlight-stat-label">Piek</span>'}</div>
            <div class="spotlight-stat-box"><span class="spotlight-stat-val">#${rank}</span><span class="spotlight-stat-label">Bij ${artiest}</span></div>
            <div class="spotlight-stat-box"><span class="spotlight-stat-val">${percentage}</span><span class="spotlight-stat-label">Aandeel</span></div>
        </div>
    `;

    if (topStreaks.length > 0) {
        html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase; border-bottom:1px solid #333; padding-bottom:5px;">🔥 Beste Streaks</h3>`;
        topStreaks.forEach(st => {
            const d1 = new Date(st.start).toLocaleDateString('nl-NL', {day:'numeric', month:'short'});
            const d2 = new Date(st.end).toLocaleDateString('nl-NL', {day:'numeric', month:'short'});
            html += `<div class="streak-row" onclick="applyCalendarFilter('${escapeStr(artiest)}', '${st.start}', '${st.end}', '${escapeStr(titel)}')" style="cursor:pointer; display:flex; justify-content:space-between; padding:8px 0; font-size:0.9rem;"><span style="color:var(--spotify-green); font-weight:bold;">${st.count} dagen</span><span style="color:#777;">${d1} ➔ ${d2}</span></div>`;
        });
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
    else if (category.includes('streaks')) { 
        const key = category.split('streaks-')[1].replace('-', '_'); 
        items = streakData[key].map(s => [
            s.titel ? `${s.titel} - ${s.artiest}` : s.naam, s.streak, 
            statsData.find(x => x.titel === s.titel)?.poster, s.titel ? 'song' : 'artist', 
            null, s.period, s.start, s.end
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
        if (name.startsWith('Album van ')) { actualType = 'album'; albumArtist = name.replace('Album van ', ''); } 
        const clickAction = `handleListClick('${escapedName}', '${actualType}', '${poster}', '${escapeStr(albumArtist)}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px; flex-shrink:0;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${period}</small>` : '';
        
        let badgeAttr = '';
        let badgeStyle = 'flex-shrink:0;';
        if (unit && unit.trim() === 'd') {
             let artistArg = actualType === 'song' ? name.split(' - ').pop() : name;
             let songArg = null;
             if(actualType === 'song') {
                 const parts = name.split(' - ');
                 songArg = parts.slice(0, parts.length - 1).join(' - ');
             }
             if (start && end) {
                 badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(artistArg)}', '${start}', '${end}', '${escapeStr(songArg||'')}')"`;
                 badgeStyle += ' cursor:pointer; border:1px solid var(--spotify-green); background:rgba(29,185,84,0.15); transition:0.2s;';
             }
        }
        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center; padding: 12px 15px; overflow:hidden;"><span style="width: 25px; flex-shrink:0; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>${img}<div style="flex-grow:1; min-width:0; overflow:hidden; margin-right:10px;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>${sub}</div><span class="point-badge" ${badgeAttr} style="${badgeStyle}" onmouseover="this.style.background='var(--spotify-green)';this.style.color='black'" onmouseout="this.style.background='rgba(29,185,84,0.15)';this.style.color='var(--spotify-green)'">${val}${unit||' d'}</span></li>`;
    }).join('') + `</ul>`;
    document.getElementById('modal').classList.remove('hidden');
}