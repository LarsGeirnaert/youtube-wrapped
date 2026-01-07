import json
import os
import re
from collections import Counter
from datetime import datetime, timedelta

def clean_music_data(artist, title):
    # 1. Verwijder backslashes
    title = title.replace('\\', '')
    artist = artist.replace('\\', '')

    # 2. Verwijder alles na //
    title = re.sub(r'\s*//.*', '', title)

    # 3. Basis opschoning
    title = re.sub(r'^Je hebt naar\s+', '', title)
    title = re.sub(r'\s+gekeken$', '', title)
    title = re.sub(r'^Watched\s+', '', title)
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)

    # 4. Splits Artist - Title
    if " - " in title:
        parts = title.split(" - ", 1)
        artist_cand, title_cand = parts[0].strip(), parts[1].strip()
        if artist_cand and title_cand:
            artist, title = artist_cand, title_cand

    # 5. Verwijder junk woorden
    junk = ['VEVO', '- Topic', 'Official', 'Records', 'Music', 'Channel', '!K7', 'Lyrics', 'Audio', 'Video']
    for word in junk:
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        artist = pattern.sub('', artist).strip()
        title = pattern.sub('', title).strip()

    # 6. Standaardiseer hoofdletters (Title Case)
    artist = artist.strip().title()
    if title:
        title = title.strip()
        title = title.title()

    return artist, title

def generate_smart_top5():
    # 1. Poster cache laden
    poster_cache = {}
    if os.path.exists('stats.json'):
        with open('stats.json', 'r', encoding='utf-8') as f:
            try:
                for entry in json.load(f):
                    if isinstance(entry, dict) and entry.get('poster') and entry['poster'] != "img/placeholder.png":
                        poster_cache[(entry['artiest'].lower().strip(), entry['titel'].lower().strip())] = entry['poster']
            except: pass

    # 2. Correcties laden
    corrections = {}
    if os.path.exists('corrections.json'):
        try:
            with open('corrections.json', 'r', encoding='utf-8') as f:
                corrections_list = json.load(f)
                for c in corrections_list:
                    orig_a, orig_t = clean_music_data(c['original']['artiest'], c['original']['titel'])
                    key = f"{orig_a.lower()}|{orig_t.lower()}"
                    corrections[key] = c['target']
            print(f"🔧 {len(corrections)} correctieregels geladen.")
        except Exception as e:
            print(f"⚠️ Fout bij laden corrections.json: {e}")

    if not os.path.exists('kijkgeschiedenis.json'):
        print("Fout: kijkgeschiedenis.json niet gevonden")
        return

    with open('kijkgeschiedenis.json', 'r', encoding='utf-8') as f:
        history = json.load(f)

    days_dict, all_listens, monthly_stats = {}, Counter(), {}
    song_history_dates = {}
    monthly_counts = Counter()
    all_dates_found = set()

    # Tellers voor grafieken
    hourly_counts = Counter()
    weekday_counts = Counter()
    artist_counts = Counter()
    daily_total_plays = Counter()

    print("🚀 Data verwerken (Momentum Methode)...")

    for entry in history:
        is_music = entry.get('header') == "YouTube Music" or "music.youtube.com" in entry.get('titleUrl', '')
        if not is_music or 'title' not in entry: continue

        time_str = entry['time']
        datum_str = time_str[:10]
        m_key = datum_str[:7]

        try:
            dt_obj = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
            hourly_counts[dt_obj.hour] += 1
            weekday_counts[dt_obj.weekday()] += 1
        except: pass

        raw_artist = entry.get('subtitles', [{'name': 'Onbekend'}])[0]['name']
        a, t = clean_music_data(raw_artist, entry['title'])
        if not t or t.startswith('http'): continue

        # Correcties
        check_key = f"{a.lower()}|{t.lower()}"
        if check_key in corrections:
            target = corrections[check_key]
            a = target['artiest']
            t = target['titel']

        all_dates_found.add(datum_str)
        song_key = (a, t)

        if song_key not in song_history_dates: song_history_dates[song_key] = []
        song_history_dates[song_key].append(datetime.strptime(datum_str, "%Y-%m-%d"))

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

    # --- WEGSCHRIJVEN DATA ---

    # 1. Comebacks
    comebacks = []
    for song, dates in song_history_dates.items():
        sorted_dates = sorted(dates)
        if len(sorted_dates) < 20: continue
        for i in range(len(sorted_dates) - 1):
            gap = (sorted_dates[i+1] - sorted_dates[i]).days
            if gap >= 30:
                before = len([d for d in sorted_dates if d <= sorted_dates[i]])
                after = len([d for d in sorted_dates if d >= sorted_dates[i+1]])
                if before >= 10 and after >= 10:
                    comebacks.append({
                        "artiest": song[0], "titel": song[1], "gap": gap,
                        "poster": poster_cache.get((song[0].lower(), song[1].lower()), "img/placeholder.png"),
                        "periode": f"{sorted_dates[i].year} ➔ {sorted_dates[i+1].year}"
                    })
                    break
    with open('comebacks.json', 'w', encoding='utf-8') as f:
        json.dump(sorted(comebacks, key=lambda x: x['gap'], reverse=True), f, indent=2, ensure_ascii=False)

    # 2. FUN STATS
    busiest_day_date = daily_total_plays.most_common(1)[0] if daily_total_plays else ("-", 0)
    total_tracks = sum(all_listens.values())
    estimated_minutes = total_tracks * 3.5

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
        "total_time_hours": int(estimated_minutes / 60),
        "total_time_days": round(estimated_minutes / 60 / 24, 1),
        "avg_discovery": int(avg_discovery),
        "total_unique_artists": len(artist_counts),
        "unique_songs": len(all_listens)
    }

    # 3. Chart Data (AANGEPAST: Top 9)
    top_9_songs_keys = [k for k, v in all_listens.most_common(9)]
    song_growth_data = {f"{k[1]} - {k[0]}": [] for k in top_9_songs_keys}
    song_running_totals = {k: 0 for k in top_9_songs_keys}

    top_9_artists_keys = [k for k, v in artist_counts.most_common(9)]
    artist_growth_data = {k: [] for k in top_9_artists_keys}
    artist_running_totals = {k: 0 for k in top_9_artists_keys}

    sorted_months = sorted(monthly_counts.keys())

    for m in sorted_months:
        for s_key in top_9_songs_keys:
            count = monthly_stats.get(m, {}).get('songs', {}).get(s_key, 0)
            song_running_totals[s_key] += count
            song_growth_data[f"{s_key[1]} - {s_key[0]}"].append(song_running_totals[s_key])

        for a_key in top_9_artists_keys:
            count = monthly_stats.get(m, {}).get('artists', {}).get(a_key, 0)
            artist_running_totals[a_key] += count
            artist_growth_data[a_key].append(artist_running_totals[a_key])

    # NIEUW: Top 9 verdeling voor Pie Chart
    top_9_artists_chart = artist_counts.most_common(9)
    artist_chart_data = {
        "labels": [x[0] for x in top_9_artists_chart],
        "values": [x[1] for x in top_9_artists_chart]
    }

    chart_data = {
        "history": {
            "labels": sorted(monthly_counts.keys()),
            "values": [monthly_counts[m] for m in sorted(monthly_counts.keys())]
        },
        "hours": {
            "labels": [f"{i}:00" for i in range(24)],
            "values": [hourly_counts[i] for i in range(24)]
        },
        "weekdays": {
            "labels": ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
            "values": [weekday_counts[i] for i in range(7)]
        },
        "artists": artist_chart_data,
        "fun_stats": fun_stats,
        "growth": {
            "labels": sorted_months,
            "songs": song_growth_data,
            "artists": artist_growth_data
        }
    }
    with open('chart_data.json', 'w', encoding='utf-8') as f: json.dump(chart_data, f, indent=2, ensure_ascii=False)

    # 4. Monthly & Overall Stats
    json_monthly = {}
    for m, d in monthly_stats.items():
        json_monthly[m] = {
            "top_songs": [[s[0], s[1], count] for s, count in d["songs"].most_common(100)],
            "top_artists": d["artists"].most_common(100),
            "artist_details": {a: s.most_common() for a, s in d["artist_song_details"].items()},
            "total_listens": sum(d["artists"].values()),
            "artist_counts": dict(d["artists"]),
            "song_counts": {f"{s[1]}|{s[0]}": count for s, count in d["songs"].items()},
            "unique_artists": len(d["artists"]),
            "unique_songs": len(d["songs"])
        }
    with open('monthly_stats.json', 'w', encoding='utf-8') as f: json.dump(json_monthly, f, indent=2, ensure_ascii=False)

    stats_out = [{"artiest": a, "titel": t, "count": c, "poster": poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")} for (a, t), c in all_listens.items()]
    with open('stats.json', 'w', encoding='utf-8') as f: json.dump(stats_out, f, indent=2, ensure_ascii=False)

    # 5. Momentum Top 5
    final_data = []
    sorted_days = sorted(days_dict.keys(), reverse=True)

    for d in sorted_days:
        current_date_obj = datetime.strptime(d, "%Y-%m-%d")
        month_ago_date_obj = current_date_obj - timedelta(days=7) # AANGEPAST NAAR 7 DAGEN
        today_counter = Counter(days_dict[d])

        def get_momentum_score(song_key):
            dates = song_history_dates.get(song_key, [])
            score = 0
            for listen_date in dates:
                if month_ago_date_obj <= listen_date <= current_date_obj:
                    score += 1
            return score

        unique_songs_today = list(today_counter.keys())
        unique_songs_today.sort(key=lambda s: (today_counter[s], get_momentum_score(s)), reverse=True)

        for song_key in unique_songs_today[:5]:
            artiest, titel = song_key
            poster = poster_cache.get((artiest.lower(), titel.lower()), "img/placeholder.png")
            final_data.append({
                "datum": d, "titel": titel, "artiest": artiest, "poster": poster
            })

    with open('data.json', 'w', encoding='utf-8') as f: json.dump(final_data, f, indent=2, ensure_ascii=False)

    print("✅ Klaar! Top 9 berekend.")

if __name__ == "__main__":
    generate_smart_top5()