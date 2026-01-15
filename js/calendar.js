// ==========================================
// 7. CALENDAR & FILTERING
// ==========================================

function renderCalendar() {
    const grid = document.getElementById('calendarGrid'), monthDisplay = document.getElementById('monthDisplay');
    if (!grid) return; grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    const firstDay = new Date(year, month, 1).getDay(), offset = firstDay === 0 ? 6 : firstDay - 1;
    
    for (let i = 0; i < offset; i++) { grid.appendChild(document.createElement('div')); }
    
    const checkDateHasListen = (y, m, d) => {
        if (!activeFilter) return false;
        const checkStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const entry = calendarIndex[checkStr] && calendarIndex[checkStr][activeFilter];
        if (!entry) return false;
        
        if (activeSongFilter) {
            return entry.songs.some(s => (typeof s === 'object' ? s.titel : s) === activeSongFilter);
        }
        return true;
    };

    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div'); cell.className = 'calendar-day';
        let hasListen = false;
        let poster = "";
        let clickData = [];

        if (activeFilter) {
            if (calendarIndex[dateStr] && calendarIndex[dateStr][activeFilter]) {
                const entry = calendarIndex[dateStr][activeFilter];
                poster = entry.poster;
                
                let allSongs = entry.songs.map(songObj => {
                    if (typeof songObj === 'object' && songObj !== null) {
                        return { titel: songObj.titel, artiest: activeFilter, poster: songObj.poster || poster };
                    } 
                    return { titel: String(songObj), artiest: activeFilter, poster: poster };
                });

                if (activeSongFilter) {
                    const specificSong = allSongs.find(s => s.titel === activeSongFilter);
                    if (specificSong) {
                        hasListen = true;
                        poster = specificSong.poster; 
                        clickData = [specificSong];
                    } else {
                        hasListen = false; 
                    }
                } else {
                    hasListen = true;
                    clickData = allSongs;
                }

                if (hasListen) {
                    const yesterday = new Date(year, month, day - 1);
                    const tomorrow = new Date(year, month, day + 1);
                    const hadYesterday = checkDateHasListen(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
                    const hasTomorrow = checkDateHasListen(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

                    let isFocus = false;
                    if (focusStreakRange) {
                        const d = new Date(dateStr); d.setHours(0,0,0,0);
                        const s = new Date(focusStreakRange.start); s.setHours(0,0,0,0);
                        const e = new Date(focusStreakRange.end); e.setHours(0,0,0,0);
                        if (d >= s && d <= e) isFocus = true;
                    }

                    if (hadYesterday && hasTomorrow) cell.classList.add('streak-middle');
                    else if (hasTomorrow) cell.classList.add('streak-start');
                    else if (hadYesterday) cell.classList.add('streak-end');

                    if (isFocus) cell.classList.add('streak-focus');
                }
            }
        } else {
            let songs = musicData.filter(d => d.datum === dateStr);
            if (songs.length > 0) {
                hasListen = true;
                poster = songs[0].poster;
                clickData = songs;
            }
        }

        if (hasListen) { 
            cell.classList.add('has-data'); 
            cell.innerHTML = `<span class="day-number">${day}</span><img src="${poster}">`; 
            cell.onclick = () => openDagDetails(dateStr, clickData); 
        } else { 
            if (activeFilter) cell.style.opacity = "0.2"; 
            cell.innerHTML = `<span class="day-number">${day}</span>`;
        }
        grid.appendChild(cell);
    }
}

function openDagDetails(date, songs) { const container = document.getElementById('day-top-three-container'); document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }); container.innerHTML = songs.slice(0, 5).map((s, i) => `<div class="search-item" onclick="showSongSpotlight('${escapeStr(s.titel)} - ${escapeStr(s.artiest)}') " style="display:flex; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px; cursor:pointer;"><span style="font-weight:800; color:var(--spotify-green); margin-right:15px; width:15px;">${i+1}</span><img src="${s.poster}" style="width:45px; height:45px; border-radius:8px; margin-right:15px;"><div class="search-item-info"><b>${s.titel}</b><br><small style="color:var(--text-muted);">${s.artiest}</small></div></div>`).join(''); document.getElementById('modal').classList.remove('hidden'); }

function applyCalendarFilter(artist, startDate, endDate, songTitle = null) { 
    console.log(`[DEBUG] Filter: ${artist}, Song: ${songTitle}, Start: ${startDate}`);
    
    activeFilter = artist; 
    activeSongFilter = songTitle; 

    if (startDate && endDate) {
        focusStreakRange = { start: startDate, end: endDate };
        currentViewDate = new Date(startDate);
        currentViewDate.setDate(1); 
    } else {
        focusStreakRange = null;
        const allDates = Object.keys(calendarIndex).sort().reverse();
        const lastListenDate = allDates.find(date => calendarIndex[date][artist]);
        if (lastListenDate) {
            currentViewDate = new Date(lastListenDate);
            currentViewDate.setDate(1); 
        }
    }

    document.getElementById('modal').classList.add('hidden'); 
    switchTab('calendar'); 
    document.getElementById('resetFilter').classList.remove('hidden'); 
    renderCalendar(); 
}