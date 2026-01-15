import json
import os
import re
from collections import Counter
from datetime import datetime, timedelta

def clean_music_data(artist, title):
    title = title.replace('\\', '')
    artist = artist.replace('\\', '')
    title = re.sub(r'\s*//.*', '', title)
    title = re.sub(r'^Je hebt naar\s+', '', title)
    title = re.sub(r'\s+gekeken$', '', title)
    title = re.sub(r'^Watched\s+', '', title)
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)

    if " - " in title:
        parts = title.split(" - ", 1)
        artist_cand, title_cand = parts[0].strip(), parts[1].strip()
        if artist_cand and title_cand:
            artist, title = artist_cand, title_cand
    
    junk = ['VEVO', '- Topic', 'Official', 'Records', 'Music', 'Channel', '!K7', 'Lyrics', 'Audio', 'Video']
    for word in junk:
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        artist = pattern.sub('', artist).strip()
        title = pattern.sub('', title).strip()

    artist = artist.strip().title() 
    if title:
        title = title.strip()
        title = title.title()

    return artist, title

def generate_smart_top5():
    # --- CONFIGURATIE ---
    MIN_DURATION_SECONDS = 15 

    ignored_set = set()
    if os.path.exists('ignored.json'):
        try:
            with open('ignored.json', 'r', encoding='utf-8') as f:
                ignored_list = json.load(f)
                for item in ignored_list:
                    key = f"{item['artiest'].lower().strip()}|{item['titel'].lower().strip()}"
                    ignored_set.add(key)
            print(f"🚫 {len(ignored_set)} verborgen nummers geladen.")
        except: pass

    poster_cache = {}
    if os.path.exists('stats.json'):
        with open('stats.json', 'r', encoding='utf-8') as f:
            try:
                for entry in json.load(f):
                    if isinstance(entry, dict) and entry.get('poster') and entry['poster'] != "img/placeholder.png":
                        poster_cache[(entry['artiest'].lower().strip(), entry['titel'].lower().strip())] = entry['poster']
            except: pass

    corrections = {}
    if os.path.exists('corrections.json'):
        try:
            with open('corrections.json', 'r', encoding='utf-8') as f:
                corrections_list = json.load(f)
                for c in corrections_list:
                    orig_a, orig_t = clean_music_data(c['original']['artiest'], c['original']['titel'])
                    key = f"{orig_a.lower()}|{orig_t.lower()}"
                    corrections[key] = c['target']
            print(f"📦 {len(corrections)} correctieregels geladen.")
        except Exception as e: 
            print(f"⚠️ Fout bij laden corrections.json: {e}")

    if not os.path.exists('kijkgeschiedenis.json'):
        print("Fout: kijkgeschiedenis.json niet gevonden")
        return

    with open('kijkgeschiedenis.json', 'r', encoding='utf-8') as f:
        history = json.load(f)

    # --- STAP 1: DATA VERWERKEN ---
    print(f"🚀 Data analyseren...")
    
    raw_candidates = []

    for entry in history:
        is_music = entry.get('header') == "YouTube Music" or "music.youtube.com" in entry.get('titleUrl', '')
        if not is_music or 'title' not in entry: continue

        time_str = entry['time']
        try:
            dt_obj = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        except:
            continue

        raw_artist = entry.get('subtitles', [{'name': 'Onbekend'}])[0]['name']
        a, t = clean_music_data(raw_artist, entry['title'])
        if not t or t.startswith('http'): continue

        ignore_key = f"{a.lower().strip()}|{t.lower().strip()}"
        if ignore_key in ignored_set: continue

        forced_poster = None
        check_key = f"{a.lower()}|{t.lower()}"
        if check_key in corrections:
            target = corrections[check_key]
            a = target['artiest']
            t = target['titel']
            if 'poster' in target: forced_poster = target['poster']

        raw_candidates.append({ 'dt': dt_obj, 'artiest': a, 'titel': t, 'forced_poster': forced_poster })

    raw_candidates.sort(key=lambda x: x['dt'])

    filtered_history = []
    skipped_count = 0

    for i in range(len(raw_candidates)):
        current_item = raw_candidates[i]
        if i < len(raw_candidates) - 1:
            next_item = raw_candidates[i+1]
            duration = (next_item['dt'] - current_item['dt']).total_seconds()
            if duration < MIN_DURATION_SECONDS:
                skipped_count += 1
                continue 
        filtered_history.append(current_item)

    print(f"✂️ {skipped_count} geskipte nummers verwijderd.")
    print(f"✅ {len(filtered_history)} geldige luisterbeurten over.")

    # --- STAP 2: STATS ---
    days_dict, all_listens, monthly_stats = {}, Counter(), {}
    song_history_dates = {} 
    monthly_counts = Counter()
    all_dates_found = set()
    temp_calendar_data = {} 
    hourly_counts = Counter()
    weekday_counts = Counter()
    artist_counts = Counter()
    daily_total_plays = Counter()
    full_history_export = []

    for item in filtered_history:
        dt_obj = item['dt']
        a = item['artiest']
        t = item['titel']
        datum_str = dt_obj.strftime("%Y-%m-%d")
        m_key = dt_obj.strftime("%Y-%m")
        
        hourly_counts[dt_obj.hour] += 1
        weekday_counts[dt_obj.weekday()] += 1
        all_dates_found.add(datum_str)
        song_key = (a, t)

        if item['forced_poster']:
            poster = item['forced_poster']
            poster_cache[(a.lower(), t.lower())] = poster
        else:
            poster = poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")

        if (a.lower(), t.lower()) not in poster_cache and poster != "img/placeholder.png":
             poster_cache[(a.lower(), t.lower())] = poster

        if datum_str not in temp_calendar_data: temp_calendar_data[datum_str] = {}
        if a not in temp_calendar_data[datum_str]: temp_calendar_data[datum_str][a] = Counter()
        temp_calendar_data[datum_str][a][t] += 1

        if song_key not in song_history_dates: song_history_dates[song_key] = []
        song_history_dates[song_key].append(dt_obj)

        if datum_str not in days_dict: days_dict[datum_str] = []
        days_dict[datum_str].append(song_key)
        
        all_listens[song_key] += 1
        monthly_counts[m_key] += 1
        artist_counts[a] += 1
        daily_total_plays[datum_str] += 1

        if m_key not in monthly_stats:
            monthly_stats[m_key] = {"songs": Counter(), "artists": Counter(), "artist_song_details": {}}
        monthly_stats[m_key]["songs"][song_key] += 1
        monthly_stats[m_key]["artists"][a] += 1
        if a not in monthly_stats[m_key]["artist_song_details"]:
            monthly_stats[m_key]["artist_song_details"][a] = Counter()
        monthly_stats[m_key]["artist_song_details"][a][t] += 1

        full_history_export.append({"datum": datum_str, "titel": t, "artiest": a})

    # --- EXPORTS ---
    with open('full_history.json', 'w', encoding='utf-8') as f:
        json.dump(full_history_export, f, indent=2, ensure_ascii=False)

    calendar_index = {}
    for dag, artiesten in temp_calendar_data.items():
        calendar_index[dag] = {}
        for artiest, songs_counter in artiesten.items():
            most_played_song = songs_counter.most_common(1)[0][0]
            main_poster = poster_cache.get((artiest.lower(), most_played_song.lower()), "img/placeholder.png")
            top_songs_list = []
            for s_tuple in songs_counter.most_common(5):
                s_title = s_tuple[0]
                s_poster = poster_cache.get((artiest.lower(), s_title.lower()), "img/placeholder.png")
                if s_poster == "img/placeholder.png": continue
                top_songs_list.append({ "titel": s_title, "poster": s_poster })
            if top_songs_list:
                calendar_index[dag][artiest] = { "poster": main_poster, "songs": top_songs_list }

    with open('calendar_index.json', 'w', encoding='utf-8') as f:
        json.dump(calendar_index, f, indent=2, ensure_ascii=False)

    comebacks = []
    old_favorites = []
    if all_dates_found:
        last_data_date = max([datetime.strptime(d, "%Y-%m-%d") for d in all_dates_found])
    else:
        last_data_date = datetime.now()

    for song, dates in song_history_dates.items():
        p_check = poster_cache.get((song[0].lower(), song[1].lower()), "img/placeholder.png")
        if p_check == "img/placeholder.png": continue
        sorted_dates = sorted(dates)
        if len(sorted_dates) < 15: continue 

        for i in range(len(sorted_dates) - 1):
            gap = (sorted_dates[i+1] - sorted_dates[i]).days
            if gap >= 30: 
                before = len([d for d in sorted_dates if d <= sorted_dates[i]])
                after = len([d for d in sorted_dates if d >= sorted_dates[i+1]])
                if before >= 10 and after >= 10:
                    comebacks.append({
                        "artiest": song[0], "titel": song[1], "gap": gap, "poster": p_check,
                        "periode": f"{sorted_dates[i].year} ➔ {sorted_dates[i+1].year}"
                    })
                    break 
        
        last_listen = sorted_dates[-1]
        days_silent = (last_data_date - last_listen.replace(tzinfo=None)).days
        if days_silent > 90:
            old_favorites.append({
                "artiest": song[0], "titel": song[1], "days_silent": days_silent,
                "poster": p_check, "last_played": last_listen.strftime("%Y-%m-%d")
            })

    with open('comebacks.json', 'w', encoding='utf-8') as f:
        json.dump(sorted(comebacks, key=lambda x: x['gap'], reverse=True), f, indent=2, ensure_ascii=False)
    with open('old_favorites.json', 'w', encoding='utf-8') as f:
        json.dump(sorted(old_favorites, key=lambda x: x['days_silent'], reverse=True), f, indent=2, ensure_ascii=False)

    busiest_day_date = daily_total_plays.most_common(1)[0] if daily_total_plays else ("-", 0)
    total_tracks = sum(all_listens.values())
    
    discovery_rates = {}
    seen_artists = set()
    for m in sorted(monthly_stats.keys()):
        month_artists = set(monthly_stats[m]["artists"].keys())
        new_artists = month_artists - seen_artists
        discovery_rates[m] = len(new_artists)
        seen_artists.update(month_artists)
    avg_discovery = sum(discovery_rates.values()) / len(discovery_rates) if discovery_rates else 0

    fun_stats = {
        "busiest_day": { "date": busiest_day_date[0], "count": busiest_day_date[1] },
        "total_time_hours": int(total_tracks * 3.5 / 60),
        "total_time_days": round(total_tracks * 3.5 / 60 / 24, 1),
        "avg_discovery": int(avg_discovery),
        "total_unique_artists": len(artist_counts),
        "unique_songs": len(all_listens)
    }

    top_10_songs_keys = [k for k, v in all_listens.most_common(10)]
    song_growth_data = {f"{k[1]} - {k[0]}": [] for k in top_10_songs_keys}
    song_running_totals = {k: 0 for k in top_10_songs_keys}
    top_10_artists_keys = [k for k, v in artist_counts.most_common(10)]
    artist_growth_data = {k: [] for k in top_10_artists_keys}
    artist_running_totals = {k: 0 for k in top_10_artists_keys}
    sorted_months = sorted(monthly_counts.keys())

    for m in sorted_months:
        for s_key in top_10_songs_keys:
            count = monthly_stats.get(m, {}).get('songs', {}).get(s_key, 0)
            song_running_totals[s_key] += count
            song_growth_data[f"{s_key[1]} - {s_key[0]}"].append(song_running_totals[s_key])
        for a_key in top_10_artists_keys:
            count = monthly_stats.get(m, {}).get('artists', {}).get(a_key, 0)
            artist_running_totals[a_key] += count
            artist_growth_data[a_key].append(artist_running_totals[a_key])

    top_10_artists_chart = artist_counts.most_common(10)
    artist_chart_data = { "labels": [x[0] for x in top_10_artists_chart], "values": [x[1] for x in top_10_artists_chart] }
    top_10_songs_chart = all_listens.most_common(10)
    song_chart_data = { "labels": [f"{x[0][1]} - {x[0][0]}" for x in top_10_songs_chart], "values": [x[1] for x in top_10_songs_chart] }

    chart_data = {
        "history": { "labels": sorted(monthly_counts.keys()), "values": [monthly_counts[m] for m in sorted(monthly_counts.keys())] },
        "hours": { "labels": [f"{i}:00" for i in range(24)], "values": [hourly_counts[i] for i in range(24)] },
        "weekdays": { "labels": ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"], "values": [weekday_counts[i] for i in range(7)] },
        "artists": artist_chart_data, "songs": song_chart_data, "fun_stats": fun_stats,
        "growth": { "labels": sorted_months, "songs": song_growth_data, "artists": artist_growth_data }
    }
    with open('chart_data.json', 'w', encoding='utf-8') as f: json.dump(chart_data, f, indent=2, ensure_ascii=False)

    json_monthly = {}
    for m, d in monthly_stats.items():
        json_monthly[m] = {
            "top_songs": [[s[0], s[1], count] for s, count in d["songs"].most_common(100)],
            "top_artists": d["artists"].most_common(100),
            "artist_details": {a: s.most_common() for a, s in d["artist_song_details"].items()},
            "total_listens": sum(d["artists"].values()),
            "unique_artists": len(d["artists"]),
            "unique_songs": len(d["songs"]),
            "artist_counts": dict(d["artists"]),
            "song_counts": {f"{s[1]}|{s[0]}": count for s, count in d["songs"].items()} 
        }
    with open('monthly_stats.json', 'w', encoding='utf-8') as f: json.dump(json_monthly, f, indent=2, ensure_ascii=False)

    stats_out = []
    for (a, t), c in all_listens.items():
        poster = poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")
        if poster != "img/placeholder.png":
            stats_out.append({"artiest": a, "titel": t, "count": c, "poster": poster})
    with open('stats.json', 'w', encoding='utf-8') as f: json.dump(stats_out, f, indent=2, ensure_ascii=False)

    final_data = []
    sorted_days = sorted(days_dict.keys(), reverse=True)
    for d in sorted_days:
        current_date_obj = datetime.strptime(d, "%Y-%m-%d")
        month_ago_date_obj = current_date_obj - timedelta(days=7) 
        today_counter = Counter(days_dict[d])
        
        def get_momentum_score(song_key):
            dates = song_history_dates.get(song_key, [])
            score = 0
            for listen_date in dates:
                if month_ago_date_obj <= listen_date.replace(tzinfo=None) <= current_date_obj: score += 1
            return score
            
        unique_songs_today = list(today_counter.keys())
        unique_songs_today.sort(key=lambda s: (today_counter[s], get_momentum_score(s)), reverse=True)
        for song_key in unique_songs_today[:5]:
            artiest, titel = song_key
            poster = poster_cache.get((artiest.lower(), titel.lower()), "img/placeholder.png")
            if poster == "img/placeholder.png": continue 
            final_data.append({ "datum": d, "titel": titel, "artiest": artiest, "poster": poster })
    with open('data.json', 'w', encoding='utf-8') as f: json.dump(final_data, f, indent=2, ensure_ascii=False)

# 8. Streaks (All-time top, gebaseerd op de volledige lijst)
    if not all_dates_found: 
        print("✅ Klaar! (Geen streaks)")
        return
    
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
        if not sorted_dates: return {"max": 0, "period": "-", "current": 0, "current_period": "-", "start_date": None, "end_date": None, "curr_start": None, "curr_end": None}

        max_s, curr_s = 1, 1
        max_start = sorted_dates[0]
        max_end = sorted_dates[0]
        curr_start = sorted_dates[0]

        for i in range(1, len(sorted_dates)):
            if sorted_dates[i] == sorted_dates[i-1] + timedelta(days=1):
                curr_s += 1
            else:
                if curr_s > max_s:
                    max_s = curr_s
                    max_start = curr_start
                    max_end = sorted_dates[i-1]
                curr_s = 1
                curr_start = sorted_dates[i]
        
        if curr_s > max_s:
            max_s = curr_s
            max_start = curr_start
            max_end = sorted_dates[-1]

        is_current = sorted_dates[-1] >= reference_date - timedelta(days=1)
        
        # Datums voor de huidige streak berekenen
        current_start_date = None
        current_end_date = None
        if is_current:
            current_end_date = sorted_dates[-1]
            # De start is het einde min de lengte van de streak (+1 dag correctie)
            current_start_date = sorted_dates[-curr_s]

        return { 
            "max": max_s, 
            "period": f"{max_start.strftime('%d %b %Y')} - {max_end.strftime('%d %b %Y')}",
            "current": curr_s if is_current else 0,
            "current_period": "-",
            "start_date": max_start.strftime("%Y-%m-%d"),
            "end_date": max_end.strftime("%Y-%m-%d"),
            "curr_start": current_start_date.strftime("%Y-%m-%d") if current_start_date else None,
            "curr_end": current_end_date.strftime("%Y-%m-%d") if current_end_date else None
        }

    s_top, s_curr, a_top, a_curr = [], [], [], []
    for k, v in song_dates_set.items():
        if poster_cache.get((k[0].lower(), k[1].lower()), "img/placeholder.png") == "img/placeholder.png": continue
        res = get_streak_info(v, last_data_date)
        
        if res["max"] > 1: 
            s_top.append({"artiest": k[0], "titel": k[1], "streak": res["max"], "period": res["period"], "start": res["start_date"], "end": res["end_date"]})
        if res["current"] > 1: 
            s_curr.append({"artiest": k[0], "titel": k[1], "streak": res["current"], "period": res["current_period"], "start": res["curr_start"], "end": res["curr_end"]})
    
    for k, v in artist_dates_set.items():
        res = get_streak_info(v, last_data_date)
        if res["max"] > 1: 
            a_top.append({"naam": k, "streak": res["max"], "period": res["period"], "start": res["start_date"], "end": res["end_date"]})
        if res["current"] > 1: 
            a_curr.append({"naam": k, "streak": res["current"], "period": res["current_period"], "start": res["curr_start"], "end": res["curr_end"]})

    with open('streaks.json', 'w', encoding='utf-8') as f:
        json.dump({"songs_top": sorted(s_top, key=lambda x: x['streak'], reverse=True)[:100], "songs_current": sorted(s_curr, key=lambda x: x['streak'], reverse=True)[:100], "artists_top": sorted(a_top, key=lambda x: x['streak'], reverse=True)[:100], "artists_current": sorted(a_curr, key=lambda x: x['streak'], reverse=True)[:100]}, f, indent=2, ensure_ascii=False)

    print("✅ Klaar! Volledige export & Indexen gegenereerd.")

if __name__ == "__main__":
    generate_smart_top5()