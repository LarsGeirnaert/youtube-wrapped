import json
import os
import re
from collections import Counter

def clean_music_data(artist, title):
    # 1. Verwijder de specifieke Nederlandse YouTube zin: "Je hebt naar ... gekeken"
    title = re.sub(r'^Je hebt naar\s+', '', title)
    title = re.sub(r'\s+gekeken$', '', title)
    title = re.sub(r'^Watched\s+', '', title)

    # 2. Haal tekst tussen haakjes/blokhaken weg
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)
    
    # 3. SPLIT-FIX: Voor "Goose - Synrise" gevallen
    if " - " in title:
        parts = title.split(" - ", 1)
        artist = parts[0].strip()
        title = parts[1].strip()

    # 4. Verwijder kanaal-rommel
    junk = ['VEVO', '- Topic', 'Official', 'Records', 'Music', 'Channel', '!K7']
    for word in junk:
        artist = artist.replace(word, '').strip()

    return artist.strip(), title.strip()

def generate_smart_top5():
    # --- STAP 1: POSTER CACHE LADEN ---
    poster_cache = {}
    if os.path.exists('data.json'):
        with open('data.json', 'r', encoding='utf-8') as f:
            try:
                current_data = json.load(f)
                for entry in current_data:
                    if entry['poster'] != "img/placeholder.png":
                        a_clean, t_clean = clean_music_data(entry['artiest'], entry['titel'])
                        key = (a_clean.lower(), t_clean.lower())
                        poster_cache[key] = entry['poster']
            except: pass

    # --- STAP 2: BRON INLEZEN ---
    if not os.path.exists('kijkgeschiedenis.json'):
        print("❌ Fout: kijkgeschiedenis.json niet gevonden!")
        return

    with open('kijkgeschiedenis.json', 'r', encoding='utf-8') as f:
        history = json.load(f)

    # --- STAP 3: FILTEREN EN GROEPEREN ---
    days_dict = {}
    for entry in history:
        is_music = entry.get('header') == "YouTube Music" or "music.youtube.com" in entry.get('titleUrl', '')
        if not is_music or 'title' not in entry:
            continue
        
        time_str = entry['time']
        # Aangepast: We nemen nu ook 2024 mee in de check
        if not (time_str.startswith('2024') or time_str.startswith('2025') or time_str.startswith('2026')):
            continue
        
        datum = time_str[:10]
        raw_artiest = entry['subtitles'][0]['name'] if 'subtitles' in entry else "Onbekend"
        raw_titel = entry['title']
        
        artiest, titel = clean_music_data(raw_artiest, raw_titel)
        if not titel or titel.startswith('http'): continue

        if datum not in days_dict:
            days_dict[datum] = []
        days_dict[datum].append((artiest, titel))

    # --- STAP 4: TOP 5 BOUWEN MET MAX 2 PER ARTIEST ---
    final_output = []
    for datum in sorted(days_dict.keys(), reverse=True):
        counts = Counter(days_dict[datum])
        # Sorteer alle nummers van die dag op populariteit
        sorted_songs = counts.most_common()
        
        day_top_5 = []
        artist_counts_per_day = {} # Om bij te houden: artist -> count
        
        for (artiest, titel), count in sorted_songs:
            if len(day_top_5) >= 5:
                break
                
            # Check hoe vaak deze artiest al in de Top 5 van vandaag staat
            current_artist_count = artist_counts_per_day.get(artiest.lower(), 0)
            
            if current_artist_count < 2:
                # Toevoegen aan Top 5
                key = (artiest.lower(), titel.lower())
                poster = poster_cache.get(key, "img/placeholder.png")
                
                day_top_5.append({
                    "datum": datum,
                    "titel": titel,
                    "artiest": artiest,
                    "poster": poster
                })
                
                # Update de teller voor deze artiest
                artist_counts_per_day[artiest.lower()] = current_artist_count + 1
        
        final_output.extend(day_top_5)

    # --- STAP 5: OPSLAAN ---
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    print(f"✅ Synchronisatie klaar! Maximaal 2 liedjes per artiest per dag voor 2024-2026.")
    print(f"🖼️  Bestaande posters zijn veilig overgezet.")

if __name__ == "__main__":
    generate_smart_top5()