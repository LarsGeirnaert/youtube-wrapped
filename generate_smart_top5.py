import json
import os
import re
from collections import Counter
from datetime import datetime, timedelta

def clean_music_data(artist, title):
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
    song_history_dates = {} # {(artist, title): [datetime objects]}
    monthly_counts = Counter()
    all_dates_found = set()

    print("🚀 Data verwerken (Comebacks: 10x -> 30 dagen stilte -> 10x)...")

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

        # Comeback data (alle datums opslaan)
        if song_key not in song_history_dates: song_history_dates[song_key] = []
        song_history_dates[song_key].append(datetime.strptime(datum_str, "%Y-%m-%d"))

    # --- COMEBACK LOGICA ---
    # Instellingen AANGEPAST VOOR TEST
    MIN_PLAYS_BEFORE = 10
    MIN_PLAYS_AFTER = 10
    MIN_GAP_DAYS = 30  # Test: 1 maand (30 dagen)

    comebacks = []
    
    for song, dates in song_history_dates.items():
        # Sorteer datums chronologisch
        sorted_dates = sorted(dates)
        
        # Als er in totaal minder dan 20 luisterbeurten zijn, kan het wiskundig niet (10+10)
        if len(sorted_dates) < (MIN_PLAYS_BEFORE + MIN_PLAYS_AFTER): 
            continue
        
        # Loop door alle luistermomenten om een gat te vinden
        for i in range(len(sorted_dates) - 1):
            date_current = sorted_dates[i]
            date_next = sorted_dates[i+1]
            gap = (date_next - date_current).days
            
            if gap >= MIN_GAP_DAYS:
                # We hebben een gat! Nu tellen we de periodes.
                
                # Tel alles t/m het begin van het gat
                # Omdat sorted_dates gesorteerd is, is de index i het aantal items ervoor + 1 (0-based)
                count_before = i + 1
                
                # Tel alles vanaf het einde van het gat
                # De rest van de lijst vanaf i+1
                count_after = len(sorted_dates) - (i + 1)

                if count_before >= MIN_PLAYS_BEFORE and count_after >= MIN_PLAYS_AFTER:
                    comebacks.append({
                        "artiest": song[0],
                        "titel": song[1],
                        "gap": gap,
                        "poster": poster_cache.get((song[0].lower(), song[1].lower()), "img/placeholder.png"),
                        "periode": f"{date_current.strftime('%d-%m-%Y')} ➔ {date_next.strftime('%d-%m-%Y')}"
                    })
                    print(f"   🔥 Comeback gevonden: {song[1]} - {song[0]} ({gap} dagen stilte)")
                    break # We hebben een comeback voor dit liedje, ga naar het volgende liedje

    with open('comebacks.json', 'w', encoding='utf-8') as f:
        json.dump(sorted(comebacks, key=lambda x: x['gap'], reverse=True), f, indent=2, ensure_ascii=False)

    # --- GRAFIEK DATA ---
    sorted_months = sorted(monthly_counts.keys())
    chart_data = {
        "labels": sorted_months,
        "values": [monthly_counts[m] for m in sorted_months]
    }
    with open('chart_data.json', 'w', encoding='utf-8') as f:
        json.dump(chart_data, f, indent=2)

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

    # --- OPSLAAN OVERIGE BESTANDEN ---
    json_monthly = {}
    for m, d in monthly_stats.items():
        json_monthly[m] = {
            "top_songs": [[s[0], s[1], count] for s, count in d["songs"].most_common(100)],
            "top_artists": d["artists"].most_common(100),
            "artist_details": {art: songs.most_common() for art, songs in d["artist_song_details"].items()},
            "total_listens": sum(d["artists"].values())
        }
    with open('monthly_stats.json', 'w', encoding='utf-8') as f: json.dump(json_monthly, f, indent=2, ensure_ascii=False)

    stats_out = [{"artiest": a, "titel": t, "count": c, "poster": poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")} for (a, t), c in all_listens.items()]
    with open('stats.json', 'w', encoding='utf-8') as f: json.dump(stats_out, f, indent=2, ensure_ascii=False)
    
    final_data = []
    for d in sorted(days_dict.keys(), reverse=True):
        for (a, t), c in Counter(days_dict[d]).most_common(5):
            final_data.append({"datum": d, "titel": t, "artiest": a, "poster": poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")})
    with open('data.json', 'w', encoding='utf-8') as f: json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Klaar! {len(comebacks)} comebacks gevonden met criteria: >10x, >30d gat, >10x.")

if __name__ == "__main__":
    generate_smart_top5()