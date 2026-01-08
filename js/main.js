function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse(); 
    if (dates.length === 0) {
        document.getElementById('streak-count').innerText = 0;
        return;
    }
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastListenDate = dates[0];
    if (lastListenDate !== todayStr && lastListenDate !== yesterdayStr) {
        document.getElementById('streak-count').innerText = 0;
        return;
    }
    let streak = 1;
    for (let i = 0; i < dates.length - 1; i++) { 
        const current = new Date(dates[i]);
        const previous = new Date(dates[i+1]);
        const diffTime = Math.abs(current - previous);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) streak++;
        else break;
    }
    document.getElementById('streak-count').innerText = streak;
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
    
    if (tabName === 'calendar') renderCalendar(); 
    else if (tabName === 'stats') renderStatsDashboard();
    else if (tabName === 'graphs') {
        renderCharts();
        updateComparisonChart(); 
    }
    else if (tabName === 'recap') {
        renderRecapSelector();
    }
}

function applyCalendarFilter(artist) { activeFilter = artist; document.getElementById('modal').classList.add('hidden'); switchTab('calendar'); document.getElementById('resetFilter').classList.remove('hidden'); renderCalendar(); }

// Event Listeners
document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => closeModal();
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

// Start de applicatie
loadMusic();