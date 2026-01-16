// ==========================================
// 4. DETAIL VIEWS (MODALS)
// ==========================================

function getArtistTopHits(artistName) {
    if (!artistName || artistName === "Onbekend") return [];
    let songPeaks = {}; 
    Object.values(monthlyStats).forEach(month => {
        month.top_songs.forEach((s, index) => {
            if (s[0] === artistName) {
                const songTitle = s[1];
                const currentRank = index + 1;
                if (!songPeaks[songTitle]) {
                    songPeaks[songTitle] = { bestRank: currentRank, occurrences: 1 };
                } else {
                    if (currentRank < songPeaks[songTitle].bestRank) {
                        songPeaks[songTitle].bestRank = currentRank;
                        songPeaks[songTitle].occurrences = 1;
                    } else if (currentRank === songPeaks[songTitle].bestRank) {
                        songPeaks[songTitle].occurrences++;
                    }
                }
            }
        });
    });
    return Object.entries(songPeaks)
        .sort((a, b) => a[1].bestRank - b[1].bestRank || b[1].occurrences - a[1].occurrences)
        .slice(0, 3).map(entry => entry[0]);
}

function calculatePeakStat(targetName, type, targetArtist = null) {
    if (targetName === "Onbekend") return null;
    let bestRank = 101; let occurrences = 0; let bestMonthLabel = "";
    const monthNames = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];
    Object.keys(monthlyStats).forEach(monthKey => {
        const data = monthlyStats[monthKey];
        let currentRank = (type === 'artist') ? data.top_artists.findIndex(a => a[0] === targetName) + 1 : data.top_songs.findIndex(s => s[1] === targetName && s[0] === targetArtist) + 1;
        if (currentRank > 0 && currentRank <= 100) {
            if (currentRank < bestRank) {
                bestRank = currentRank; occurrences = 1;
                const [year, month] = monthKey.split('-');
                bestMonthLabel = `${monthNames[parseInt(month) - 1]} '${year.substring(2)}`;
            } else if (currentRank === bestRank) { occurrences++; }
        }
    });
    if (bestRank > 100) return null;
    const rankClass = bestRank === 1 ? 'rank-1' : '';
    return `<div class="peak-value-container"><span class="peak-rank ${rankClass}">#${bestRank}</span><span class="peak-label">${occurrences > 1 ? occurrences + 'x behaald' : 'in ' + bestMonthLabel}</span></div>`;
}

function handleListClick(name, type, poster, albumArtist, elementId) {
    if (name.includes("Onbekend")) return;
    if (document.getElementById('modal').classList.contains('hidden')) {
        lastScrollPos = window.scrollY;
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

function handleAlbumClick(poster, artist, elementId) {
    if (mergeMode) { toggleMergeSelection(`Album van ${artist}`, 'album', poster, artist, elementId); }
    else { showAlbumDetails(poster, artist); }
}

function showAlbumDetails(posterUrl, artistName, isBack = false) {
    if (!isBack) modalHistory.push({ type: 'album', args: [posterUrl, artistName] });
    const key = getAlbumKey(posterUrl, artistName);
    const albumSongs = statsData.filter(s => getAlbumKey(s.poster, s.artiest) === key).sort((a,b) => b.count - a.count);
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = `Album van ${artistName}`;
    container.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;"><img src="${posterUrl}" style="width:140px;border-radius:20px;box-shadow:var(--shadow-lg);">
        <div id="modal-action-container" style="display:flex; justify-content:center; gap:10px; margin-top:10px;"></div></div>
        <div class="modal-list-wrapper">${albumSongs.map((s, idx) => {
            const elementId = `album-det-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapeStr(s.titel + ' - ' + s.artiest)}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;"><div style="flex-grow:1;"><b>${s.titel}</b></div><span class="point-badge">${s.count}x</span></div>`;
        }).join('')}</div>`;
    document.getElementById('modal').classList.remove('hidden');
    updateModalMergeButton();
}

function showArtistDetails(artist, overrideCount = null, monthKey = null, isBack = false) {
    if (artist === "Onbekend") return;
    if (!isBack) modalHistory.push({ type: 'artist', args: [artist, overrideCount, monthKey] });
    let cleanArtist = artist.includes('(') ? artist.split('(')[1].replace(')', '') : artist;
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = cleanArtist;
    let songsToShow = (monthKey && monthlyStats[monthKey]?.artist_details[cleanArtist]) 
        ? monthlyStats[monthKey].artist_details[cleanArtist].map(i => { const info = statsData.find(x => x.artiest === cleanArtist && x.titel === i[0]); return { titel: i[0], count: i[1], poster: info ? info.poster : 'img/placeholder.png', artiest: cleanArtist }; })
        : statsData.filter(s => s.artiest === cleanArtist.trim()).sort((a,b) => b.count - a.count);
    const sortedAlbums = Object.values(songsToShow.reduce((acc, s) => { if (s.poster && s.poster !== "img/placeholder.png") { const key = getAlbumKey(s.poster, s.artiest); if (!acc[key]) acc[key] = { poster: s.poster, count: 0 }; acc[key].count += s.count; } return acc; }, {})).sort((a,b) => b.count - a.count);
    const peakStat = calculatePeakStat(cleanArtist, 'artist');
    const topHits = getArtistTopHits(cleanArtist);
    let html = (peakStat) ? `<div class="spotlight-stat-box" style="margin: 0 auto 15px; max-width: 200px; background: rgba(255,204,0,0.1); border-color: #ffcc00;">${peakStat}</div>` : '';
    html += `<div id="modal-action-container" style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;"></div>`;
    if (topHits.length > 0) {
        html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">🏆 Top 100 All-Time Hits</h3><div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:20px;">`;
        topHits.forEach((hitTitle, idx) => {
            const info = statsData.find(s => s.artiest === cleanArtist && s.titel === hitTitle);
            html += `<div onclick="showSongSpotlight('${escapeStr(hitTitle + ' - ' + cleanArtist)}')" style="cursor:pointer; text-align:center;"><div style="position:relative; width:100%; aspect-ratio:1/1;"><img src="${info?.poster || 'img/placeholder.png'}" style="width:100%; height:100%; border-radius:8px; object-fit:cover; border:1px solid var(--glass-border);"><span style="position:absolute; top:-5px; left:-5px; width:22px; height:22px; background:var(--spotify-green); color:black; border-radius:50%; font-size:0.7rem; font-weight:800; display:flex; align-items:center; justify-content:center;">${idx+1}</span></div><span style="display:block; font-size:0.65rem; font-weight:600; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${hitTitle}</span></div>`;
        });
        html += `</div>`;
    }
    if (sortedAlbums.length > 0) {
        html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Albums</h3><div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px; margin-bottom:10px;">`;
        sortedAlbums.forEach((alb, idx) => {
            const elementId = `artist-alb-${idx}`;
            html += `<div id="${elementId}" onclick="handleAlbumClick('${alb.poster}', '${escapeStr(cleanArtist)}', '${elementId}')" style="flex-shrink:0; cursor:pointer;"><img src="${alb.poster}" style="width:70px; height:70px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.3);"></div>`;
        });
        html += `</div>`;
    }
    html += `<h3 style="font-size:0.8rem; color:#aaa; margin-bottom:10px; text-transform:uppercase;">Alle Songs</h3><div>${songsToShow.map((s, idx) => {
            const elementId = `artist-det-${idx}`;
            return `<div id="${elementId}" class="search-item" onclick="handleListClick('${escapeStr(s.titel + ' - ' + cleanArtist)}', 'song', '${s.poster}', '', '${elementId}')" style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:5px; cursor:pointer;"><img src="${s.poster}" style="width:30px;height:30px;border-radius:5px;margin-right:10px;"><div style="flex-grow:1; font-size:0.9rem;"><b>${s.titel}</b></div><span class="point-badge" style="background:transparent; color:#777;">${s.count}x</span></div>`;
        }).join('')}</div>`;
    container.innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
    updateModalMergeButton();
}

function showSongSpotlight(songFull, overrideCount = null, isBack = false) {
    if (songFull.includes("Onbekend")) return;
    if (!isBack) modalHistory.push({ type: 'song', args: [songFull, overrideCount] });
    let titel, artiest; 
    if (songFull.includes(' - ')) { 
        const lastDashIndex = songFull.lastIndexOf(' - ');
        titel = songFull.substring(0, lastDashIndex); artiest = songFull.substring(lastDashIndex + 3);
    } else { titel = songFull; artiest = "Onbekend"; }
    const s = statsData.find(x => x.titel === titel && x.artiest === artiest) || { poster: 'img/placeholder.png', artiest: artiest, count: 0 };
    const countToDisplay = overrideCount !== null ? overrideCount : s.count;
    const peakStat = calculatePeakStat(titel, 'song', artiest);
    document.getElementById('day-top-three-container').innerHTML = `
        <div class="vinyl-container"><div class="vinyl-record"></div><img src="${s.poster}" class="vinyl-cover"></div>
        <h2 style="text-align:center; font-size:1.4rem; line-height:1.2; margin-bottom:2px;">${titel}</h2>
        <p style="text-align:center; color:var(--spotify-green); font-weight:bold; margin-bottom:10px;">${artiest}</p>
        <div style="text-align:center; margin-bottom:20px;"><button onclick="fixSongCover('${escapeStr(titel)}', '${escapeStr(artiest)}')" style="background:none; border:1px solid #444; color:#777; padding:4px 10px; border-radius:20px; font-size:0.7rem; cursor:pointer;">🖊️ Fix Cover URL</button></div>
        <div class="spotlight-stats-grid">
            <div class="spotlight-stat-box"><span class="spotlight-stat-val">${countToDisplay}x</span><span class="spotlight-stat-label">Plays</span></div>
            <div class="spotlight-stat-box">${peakStat ? peakStat : '<span class="spotlight-stat-val">-</span><span class="spotlight-stat-label">Piek</span>'}</div>
        </div>`;
    document.getElementById('modal-datum-titel').innerText = "Details"; 
    document.getElementById('modal').classList.remove('hidden');
}

async function fixSongCover(titel, artiest) {
    const newUrl = prompt(`Plak URL voor:\n${titel} - ${artiest}`);
    if (!newUrl || !newUrl.startsWith('http')) return;
    existingCorrections.push({ original: { titel: titel, artiest: artiest }, target: { titel: titel, artiest: artiest, poster: newUrl } });
    const isAuto = await saveCorrections();
    alert("Opgeslagen! Draai generate_smart_top5.py.");
}

function showTop100(category, isBack = false) {
    if (!isBack) modalHistory.push({ type: 'list', args: [category] });
    const container = document.getElementById('day-top-three-container');
    const titleEl = document.getElementById('modal-datum-titel');
    let items = [];
    
    if (category === 'songs') { 
        titleEl.innerText = "Top 100 Songs"; 
        items = [...statsData].sort((a, b) => b.count - a.count).slice(0, 100).map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster, 'song']); 
    }
    else if (category === 'artists') { 
        titleEl.innerText = "Top 100 Artiesten"; 
        const artistMap = {}; 
        statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; }); 
        items = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 100).map(a => [a[0], a[1], statsData.find(s=>s.artiest===a[0])?.poster, 'artist']); 
    }
    else if (category.includes('albums')) {
        const albumMap = {}; statsData.forEach(s => { if (s.poster === "img/placeholder.png") return; const key = getAlbumKey(s.poster, s.artiest); if (!albumMap[key]) albumMap[key] = { poster: s.poster, artiest: s.artiest, total: 0 }; albumMap[key].total += s.count; });
        const albums = Object.values(albumMap);
        items = albums.sort((a,b) => b.total - a.total).slice(0, 100).map(a => [`Album van ${a.artiest}`, a.total, a.poster, 'album', a.artiest]);
    }
    else if (category.includes('streaks')) {
        const key = category.split('streaks-')[1].replace(/-/g, '_'); 
        if (streakData[key]) {
            items = streakData[key].map(s => {
                const name = s.titel ? `${s.titel} - ${s.artiest}` : s.naam;
                const poster = statsData.find(x => x.titel === s.titel)?.poster || statsData.find(x => x.artiest === s.naam)?.poster;
                // De unit ' d' activeert de klik-logica in renderList
                return [name, s.streak, poster, s.titel ? 'song' : 'artist', ' d', s.period, s.start, s.end];
            });
        }
    }
    else if (category === 'obsessions') { 
        titleEl.innerText = "De Obsessies";
        const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); }); 
        items = Object.entries(artistGroups).filter(([a, songs]) => songs.length === 1 && songs[0].count > 50).sort((a, b) => b[1][0].count - a[1][0].count).slice(0, 100).map(([a, songs]) => [`${songs[0].titel} - ${a}`, songs[0].count, songs[0].poster, 'song']); 
    }
    else if (category === 'explorers') { 
        titleEl.innerText = "Ontdekkingsreizigers";
        const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); }); 
        items = Object.entries(artistGroups).filter(([a, songs]) => songs.length >= 10).sort((a, b) => b[1].length - a[1].length).slice(0, 100).map(([a, songs]) => [a, songs.length, statsData.find(s => s.artiest === a)?.poster, 'artist']); 
    }

    container.innerHTML = `<ul class="ranking-list" style="max-height: 500px; overflow-y: auto;">` + items.filter(item => item[0] && !item[0].includes("Onbekend")).map(([name, val, poster, type, unit, period, start, end], index) => {
        const escapedName = escapeStr(name);
        const elementId = `top100-${index}`;
        let actualType = type; let albumArtist = '';
        if (name.startsWith('Album van ')) { actualType = 'album'; albumArtist = name.replace('Album van ', ''); } 
        
        const clickAction = `handleListClick('${escapedName}', '${actualType}', '${poster}', '${escapeStr(albumArtist)}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:${actualType === 'artist' ? '50%' : '5px'}; margin-right:10px; flex-shrink:0; object-fit:cover;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${period}</small>` : '';

        let badgeAttr = '';
        let badgeStyle = '';
        if (unit === ' d' && start && end) {
            let filterArtist = name;
            let filterSong = null;
            if (actualType === 'song' && name.includes(' - ')) {
                const parts = name.split(' - ');
                filterArtist = parts[parts.length - 1]; 
                filterSong = parts.slice(0, parts.length - 1).join(' - '); 
            }
            badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(filterArtist)}', '${start}', '${end}', '${escapeStr(filterSong||'')}')"`;
            badgeStyle = 'cursor:pointer; border:1px solid var(--spotify-green); background:rgba(29,185,84,0.15);';
        }

        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center; padding: 12px 15px; overflow:hidden;"><span style="width: 25px; flex-shrink:0; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>${img}<div style="flex-grow:1; min-width:0; overflow:hidden; margin-right:10px;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>${sub}</div><span class="point-badge" ${badgeAttr} style="${badgeStyle}">${val}${unit||''}</span></li>`;
    }).join('') + `</ul>`;
    document.getElementById('modal').classList.remove('hidden');
}