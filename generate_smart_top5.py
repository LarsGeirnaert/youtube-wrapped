import json
import os
import re
from collections import Counter
from datetime import datetime, timedelta

def clean_music_data(artist, title):
    # Basis opschoning
    title = re.sub(r'^Je hebt naar\s+', '', title)
    title = re.sub(r'\s+gekeken$', '', title)
    title = re.sub(r'^Watched\s+', '', title)
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)
    
    if " - " in title:
        parts = title.split(" - ", 1)
        artist, title = parts[0].strip(), parts[1].strip()
        
    junk = ['VEVO', '- Topic', 'Official', 'Records', 'Music', 'Channel', '!K7', 'Lyrics', 'Audio']
    for word in junk:
        artist = artist.replace(word, '').strip()
        title = title.replace(word, '').strip()
        
    return artist.strip(), title.strip()

def generate_smart_top5():
    # 1. Poster cache laden (zodat we plaatjes behouden)
    poster_cache = {}
    if os.path.exists('stats.json'):
        with open('stats.json', 'r', encoding='utf-8') as f:
            try:
                for entry in json.load(f):
                    if isinstance(entry, dict) and entry.get('poster') and entry['poster'] != "img/placeholder.png":
                        poster_cache[(entry['artiest'].lower().strip(), entry['titel'].lower().strip())] = entry['poster']
            except: pass

    if not os.path.exists('kijkgeschiedenis.json'): 
        print("Fout: kijkgeschiedenis.json niet gevonden")
        return
        
    with open('kijkgeschiedenis.json', 'r', encoding='utf-8') as f:
        history = json.load(f)

    days_dict, all_listens, monthly_stats = {}, Counter(), {}
    song_history_dates = {} # Nodig voor Momentum & Comebacks
    monthly_counts = Counter()
    all_dates_found = set()

    print("🚀 Data verwerken (Momentum Methode, zonder correcties)...")

    for entry in history:
        is_music = entry.get('header') == "YouTube Music" or "music.youtube.com" in entry.get('titleUrl', '')
        if not is_music or 'title' not in entry: continue
        
        datum_str = entry['time'][:10]
        m_key = datum_str[:7]
        raw_artist = entry.get('subtitles', [{'name': 'Onbekend'}])[0]['name']
        
        a, t = clean_music_data(raw_artist, entry['title'])
        if not t or t.startswith('http'): continue
        
        all_dates_found.add(datum_str)
        song_key = (a, t)
        
        # Datums opslaan voor berekeningen
        if song_key not in song_history_dates: song_history_dates[song_key] = []
        song_history_dates[song_key].append(datetime.strptime(datum_str, "%Y-%m-%d"))

        # Basis tellers
        if datum_str not in days_dict: days_dict[datum_str] = []
        days_dict[datum_str].append(song_key)
        all_listens[song_key] += 1
        monthly_counts[m_key] += 1

        # Maand stats
        if m_key not in monthly_stats:
            monthly_stats[m_key] = {"songs": Counter(), "artists": Counter(), "artist_song_details": {}}
        monthly_stats[m_key]["songs"][song_key] += 1
        monthly_stats[m_key]["artists"][a] += 1
        if a not in monthly_stats[m_key]["artist_song_details"]:
            monthly_stats[m_key]["artist_song_details"][a] = Counter()
        monthly_stats[m_key]["artist_song_details"][a][t] += 1

    # --- COMEBACK LOGICA (10x -> 30d -> 10x) ---
    comebacks = []
    for song, dates in song_history_dates.items():
        sorted_dates = sorted(dates)
        if len(sorted_dates) < 20: continue
        
        for i in range(len(sorted_dates) - 1):
            gap = (sorted_dates[i+1] - sorted_dates[i]).days
            if gap >= 30: # 30 Dagen gap
                before = len([d for d in sorted_dates if d <= sorted_dates[i]])
                after = len([d for d in sorted_dates if d >= sorted_dates[i+1]])
                
                if before >= 10 and after >= 10:
                    comebacks.append({
                        "artiest": song[0],
                        "titel": song[1],
                        "gap": gap,
                        "poster": poster_cache.get((song[0].lower(), song[1].lower()), "img/placeholder.png"),
                        "periode": f"{sorted_dates[i].year} ➔ {sorted_dates[i+1].year}"
                    })
                    break 

    with open('comebacks.json', 'w', encoding='utf-8') as f:
        json.dump(sorted(comebacks, key=lambda x: x['gap'], reverse=True), f, indent=2, ensure_ascii=False)

    # --- GRAFIEK DATA ---
    chart_data = {"labels": sorted(monthly_counts.keys()), "values": [monthly_counts[m] for m in sorted(monthly_counts.keys())]}
    with open('chart_data.json', 'w', encoding='utf-8') as f: json.dump(chart_data, f, indent=2)

    # --- STREAK BEREKENING ---
    if not all_dates_found: return
    last_data_date = max([datetime.strptime(d, "%Y-%m-%d") for d in all_dates_found])

    song_dates_set, artist_dates_set = {}, {}
    for d, songs in days_dict.items():
        for s in songs:
            if s not in song_dates_set: song_dates_set[s] = set()
            song_dates_set[s].add(d)
            if s[0] not in artist_dates_set: artist_dates_set[s[0]] = set()
            artist_dates_set[s[0]].add(d)

    def get_streak_info(date_set, reference_date):
        sorted_dates = sorted([datetime.strptime(d, "%Y-%m-%d") for d in date_set])
        max_s, curr_s = 1, 1
        max_start = max_end = curr_start = sorted_dates[0]
        for i in range(1, len(sorted_dates)):
            if sorted_dates[i] == sorted_dates[i-1] + timedelta(days=1):
                curr_s += 1
            else:
                if curr_s > max_s: max_s, max_start, max_end = curr_s, curr_start, sorted_dates[i-1]
                curr_s, curr_start = 1, sorted_dates[i]
        if curr_s > max_s: max_s, max_start, max_end = curr_s, curr_start, sorted_dates[-1]
        is_current = sorted_dates[-1] == reference_date
        return {
            "max": max_s, "max_period": f"{max_start.strftime('%d/%m/%y')} - {max_end.strftime('%d/%m/%y')}",
            "current": curr_s if is_current else 0, "current_period": f"sinds {curr_start.strftime('%d/%m/%y')}" if is_current else ""
        }

    s_top, s_curr, a_top, a_curr = [], [], [], []
    for k, v in song_dates_set.items():
        res = get_streak_info(v, last_data_date)
        if res["max"] > 1: s_top.append({"artiest": k[0], "titel": k[1], "streak": res["max"], "period": res["max_period"]})
        if res["current"] > 1: s_curr.append({"artiest": k[0], "titel": k[1], "streak": res["current"], "period": res["current_period"]})
    for k, v in artist_dates_set.items():
        res = get_streak_info(v, last_data_date)
        if res["max"] > 1: a_top.append({"naam": k, "streak": res["max"], "period": res["max_period"]})
        if res["current"] > 1: a_curr.append({"naam": k, "streak": res["current"], "period": res["current_period"]})

    with open('streaks.json', 'w', encoding='utf-8') as f:
        json.dump({"songs_top": sorted(s_top, key=lambda x: x['streak'], reverse=True)[:100], "songs_current": sorted(s_curr, key=lambda x: x['streak'], reverse=True)[:100], "artists_top": sorted(a_top, key=lambda x: x['streak'], reverse=True)[:100], "artists_current": sorted(a_curr, key=lambda x: x['streak'], reverse=True)[:100]}, f, indent=2, ensure_ascii=False)

    # --- OPSLAAN REST ---
    json_monthly = {}
    for m, d in monthly_stats.items():
        json_monthly[m] = {
            "top_songs": [[s[0], s[1], count] for s, count in d["songs"].most_common(100)],
            "top_artists": d["artists"].most_common(100),
            "artist_details": {a: s.most_common() for a, s in d["artist_song_details"].items()},
            "total_listens": sum(d["artists"].values())
        }
    with open('monthly_stats.json', 'w', encoding='utf-8') as f: json.dump(json_monthly, f, indent=2, ensure_ascii=False)

    stats_out = [{"artiest": a, "titel": t, "count": c, "poster": poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")} for (a, t), c in all_listens.items()]
    with open('stats.json', 'w', encoding='utf-8') as f: json.dump(stats_out, f, indent=2, ensure_ascii=False)
    
    # --- NIEUWE TOP 5 LOGICA (MOMENTUM) ---
    final_data = []
    sorted_days = sorted(days_dict.keys(), reverse=True)
    
    for d in sorted_days:
        current_date_obj = datetime.strptime(d, "%Y-%m-%d")
        # 30 dagen terug vanaf deze dag
        month_ago_date_obj = current_date_obj - timedelta(days=30)
        
        today_counter = Counter(days_dict[d])
        
        # Functie om te tellen hoe vaak een liedje in de 30 dagen hieraan voorafgaand is geluisterd
        def get_momentum_score(song_key):
            dates = song_history_dates.get(song_key, [])
            score = 0
            for listen_date in dates:
                if month_ago_date_obj <= listen_date <= current_date_obj:
                    score += 1
            return score

        unique_songs_today = list(today_counter.keys())
        
        # Sorteer eerst op aantal plays vandaag, dan op momentum (30 dagen)
        unique_songs_today.sort(key=lambda s: (today_counter[s], get_momentum_score(s)), reverse=True)
        
        # Pak de top 5
        for song_key in unique_songs_today[:5]:
            artiest, titel = song_key
            poster = poster_cache.get((artiest.lower(), titel.lower()), "img/placeholder.png")
            final_data.append({
                "datum": d,
                "titel": titel,
                "artiest": artiest,
                "poster": poster
            })

    with open('data.json', 'w', encoding='utf-8') as f: json.dump(final_data, f, indent=2, ensure_ascii=False)

    print("✅ Klaar! Top 5 berekend op basis van Momentum (laatste 30 dagen).")

if __name__ == "__main__":
    generate_smart_top5()