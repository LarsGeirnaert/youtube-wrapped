// ==========================================
// 3. BASE UI COMPONENTS
// ==========================================

function renderList(id, items, unit, type) {
    const el = document.getElementById(id); if (!el) return;
    
    el.innerHTML = items.map(([name, val, poster, extraInfo, period, start, end], index) => {
        const escapedName = escapeStr(name);
        const elementId = `${id}-${index}`;
        const clickAction = `handleListClick('${escapedName}', '${type}', '${poster}', '${escapeStr(extraInfo||'')}', '${elementId}')`;
        const img = poster ? `<img src="${poster}" style="width:30px; height:30px; border-radius:${type === 'artist' ? '50%' : '5px'}; margin-right:10px; flex-shrink:0; object-fit:cover;">` : '';
        const sub = period ? `<br><small style="font-size:0.6rem; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${period}</small>` : '';
        
        return `<li id="${elementId}" onclick="${clickAction}" style="display:flex; align-items:center; padding: 12px 15px; overflow:hidden;">
                    <span style="width: 25px; flex-shrink:0; font-size: 0.75rem; font-weight: 800; color: var(--spotify-green); opacity: 0.5;">${index + 1}</span>
                    ${img}
                    <div style="flex-grow:1; min-width:0; overflow:hidden; margin-right:10px;">
                        <span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${name}</span>
                        ${sub}
                    </div>
                    <span class="point-badge">
                        ${val}${unit||''}
                    </span>
                </li>`;
    }).join('');
}

/**
 * Sluit de modal VOLLEDIG, ongeacht hoe diep de geschiedenis is.
 */
function closeEverything() {
    const modal = document.getElementById('modal');
    modal.classList.add('hidden');
    
    // Herstel scroll positie
    if (typeof lastScrollPos !== 'undefined') {
        window.scrollTo({ top: lastScrollPos, behavior: 'instant' });
    }
    
    modalHistory = []; // Wis alle geschiedenis
}

/**
 * Gaat één stap terug in de geschiedenis.
 */
function closeModal() {
    modalHistory.pop(); 

    if (modalHistory.length > 0) {
        const prev = modalHistory[modalHistory.length - 1]; 
        
        // Herlaad de vorige weergave zonder een nieuwe stap toe te voegen (isBack = true)
        if (prev.type === 'artist') {
            showArtistDetails(prev.args[0], prev.args[1], prev.args[2], true);
        }
        else if (prev.type === 'album') {
            showAlbumDetails(prev.args[0], prev.args[1], true);
        }
        else if (prev.type === 'song') {
            showSongSpotlight(prev.args[0], prev.args[1], true);
        }
        else if (prev.type === 'list') {
            showTop100(prev.args[0], true);
        }
    } else {
        closeEverything();
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