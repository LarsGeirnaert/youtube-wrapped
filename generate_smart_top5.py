import json
import os
import re
from collections import Counter

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

    if not os.path.exists('kijkgeschiedenis.json'): return
    with open('kijkgeschiedenis.json', 'r', encoding='utf-8') as f:
        history = json.load(f)

    days_dict, all_listens, monthly_stats = {}, Counter(), {}
    for entry in history:
        is_music = entry.get('header') == "YouTube Music" or "music.youtube.com" in entry.get('titleUrl', '')
        if not is_music or 'title' not in entry: continue
        datum_str = entry['time'][:10]
        m_key = entry['time'][:7]
        a, t = clean_music_data(entry.get('subtitles', [{'name': 'Onbekend'}])[0]['name'], entry['title'])
        if not t or t.startswith('http'): continue
        song_key = (a, t)
        if datum_str not in days_dict: days_dict[datum_str] = []
        days_dict[datum_str].append(song_key)
        all_listens[song_key] += 1
        if m_key not in monthly_stats: monthly_stats[m_key] = {"songs": Counter(), "artists": Counter()}
        monthly_stats[m_key]["songs"][song_key] += 1
        monthly_stats[m_key]["artists"][a] += 1

    final_data = []
    for d in sorted(days_dict.keys(), reverse=True):
        for (a, t), c in Counter(days_dict[d]).most_common(5):
            final_data.append({"datum": d, "titel": t, "artiest": a, "poster": poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")})
    with open('data.json', 'w', encoding='utf-8') as f: json.dump(final_data, f, indent=2, ensure_ascii=False)

    stats_out = [{"artiest": a, "titel": t, "count": c, "poster": poster_cache.get((a.lower(), t.lower()), "img/placeholder.png")} for (a, t), c in all_listens.items()]
    with open('stats.json', 'w', encoding='utf-8') as f: json.dump(stats_out, f, indent=2, ensure_ascii=False)

    json_monthly = {}
    for m, d in monthly_stats.items():
        ts = sorted(d["songs"].items(), key=lambda x: x[1], reverse=True)[0][0]
        json_monthly[m] = {"top_song": f"{ts[1]} - {ts[0]}", "top_artist": sorted(d["artists"].items(), key=lambda x: x[1], reverse=True)[0][0], "total_listens": sum(d["artists"].values())}
    with open('monthly_stats.json', 'w', encoding='utf-8') as f: json.dump(json_monthly, f, indent=2, ensure_ascii=False)
    print("✅ JSON Bestanden bijgewerkt!")

if __name__ == "__main__": generate_smart_top5()