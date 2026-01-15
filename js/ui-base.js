// ==========================================
// 3. BASE UI COMPONENTS
// ==========================================

function renderList(id, items, unit, type) {
    const el = document.getElementById(id); if (!el) return;
    
    el.innerHTML = items.map(([name, val, poster, extraInfo, period, start, end], index) => {
        const escapedName = escapeStr(name);
        const elementId = `${id}-${index}`;
        const clickAction = `handleListClick('${escapedName}', '${type}', '${poster}', '${escapeStr(extraInfo||'')}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:5px; margin-right:10px; flex-shrink:0;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${period}</small>` : '';
        
        let badgeAttr = '';
        let badgeStyle = 'flex-shrink:0;';
        
        if (unit && unit.trim() === 'd') {
            let filterArtist = name;
            let filterSong = null;

            if (type === 'song' && name.includes(' - ')) {
                const parts = name.split(' - ');
                filterArtist = parts[parts.length - 1]; // Artiest is laatste deel
                filterSong = parts.slice(0, parts.length - 1).join(' - '); // Rest is titel
            } else if (type === 'artist') {
                filterArtist = name;
            }

            if (start && end) {
                // Correcte song titel doorgeven
                badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(filterArtist)}', '${start}', '${end}', '${escapeStr(filterSong||'')}')" title="Bekijk streak in Kalender"`;
                badgeStyle += ' cursor:pointer; border:1px solid var(--spotify-green); background:rgba(29,185,84,0.15); transition:0.2s;';
            } else {
                badgeAttr = `onclick="event.stopPropagation(); applyCalendarFilter('${escapeStr(filterArtist)}')" title="Bekijk in Kalender"`;
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
                    <span class="point-badge" ${badgeAttr} style="${badgeStyle}" 
                          onmouseover="this.style.background='var(--spotify-green)';this.style.color='black'" 
                          onmouseout="this.style.background='rgba(29,185,84,0.15)';this.style.color='var(--spotify-green)'">
                        ${val}${unit||''}
                    </span>
                </li>`;
    }).join('');
}

function closeModal() {
    modalHistory.pop(); 
    if (modalHistory.length > 0) {
        const prev = modalHistory[modalHistory.length - 1]; 
        
        if (prev.type === 'artist') {
            showArtistDetails(prev.args[0], prev.args[1] || null, prev.args[2] || null, true);
        }
        else if (prev.type === 'album') {
            showAlbumDetails(prev.args[0], prev.args[1], true);
        }
        else if (prev.type === 'song') {
            showSongSpotlight(prev.args[0], prev.args[1] || null, true);
        }
        else if (prev.type === 'list') {
            showTop100(prev.args[0], true);
        }
    } else {
        document.getElementById('modal').classList.add('hidden');
        modalHistory = [];
    }
}

function switchTab(tabName) { 
    document.getElementById('view-calendar').classList.toggle('hidden', tabName !== 'calendar'); 
    document.getElementById('view-stats').classList.toggle('hidden', tabName !== 'stats'); 
    document.getElementById('view-graphs').classList.toggle('hidden', tabName !== 'graphs'); 
    document.getElementById('view-recap').classList.toggle('hidden', tabName !== 'recap'); 
    
    document.getElementById('btn-calendar').classList.toggle('active', tabName === 'calendar'); 
    document.getElementById('btn-stats').classList.toggle('active', tabName === 'stats'); 
    document.getElementById('btn-graphs').classList.toggle('active', tabName === 'graphs'); 
    document.getElementById('btn-recap').classList.toggle('active', tabName === 'recap'); 
    
    if (tabName !== 'calendar') focusStreakRange = null;

    if (tabName === 'calendar') renderCalendar(); 
    else if (tabName === 'stats') { renderStatsDashboard(); }
    else if (tabName === 'graphs') { renderCharts(); updateComparisonChart(); }
    else if (tabName === 'recap') { renderRecapSelector(); }
}