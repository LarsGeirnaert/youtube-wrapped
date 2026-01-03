import json
import os
import re
from collections import Counter

def clean_music_data(artist, title):
    # 1. Verwijder de specifieke Nederlandse YouTube zin: "Je hebt naar ... gekeken"
    # We gebruiken een regex die alles tussen 'Je hebt naar ' en ' gekeken' pakt
    title = re.sub(r'^Je hebt naar\s+', '', title)
    title = re.sub(r'\s+gekeken$', '', title)
    
    # 2. Doe hetzelfde voor de Engelse variant voor de zekerheid
    title = re.sub(r'^Watched\s+', '', title)

    # 3. Haal tekst tussen haakjes/blokhaken weg (Official Video, etc.)
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)
    
    # 4. SPLIT-FIX: Als de titel nu "Artiest - Nummer" bevat (zoals Goose - Synrise)
    # We doen dit pas NADAT de "Je hebt naar" tekst weg is.
    if " - " in title:
        parts = title.split(" - ", 1)
        artist = parts[0].strip()
        title = parts[1].strip()

    # 5. Verwijder YouTube-kanaal rommel uit de artiestennaam
    junk = ['VEVO', '- Topic', 'Official', 'Records', 'Music', 'Channel', '!K7']
    for word in junk:
        artist = artist.replace(word, '').strip()

    return artist.strip(), title.strip()

def generate_smart_top5():
    # --- STAP 1: SUPER-CACHE BOUWEN ---
    # We laden de posters uit de huidige data.json voordat we deze overschrijven
    poster_cache = {}
    if os.path.exists('data.json'):
        with open('data.json', 'r', encoding='utf-8') as f:
            try:
                current_data = json.load(f)
                for entry in current_data:
                    if entry['poster'] != "img/placeholder.png":
                        # Belangrijk: we slaan de poster op onder de 'schoongemaakte' naam
                        # zodat we altijd een match vinden, ongeacht de bron-tekst
                        a_clean, t_clean = clean_music_data(entry['artiest'], entry['titel'])
                        key = (a_clean.lower(), t_clean.lower())
                        poster_cache[key] = entry['poster']
            except Exception as e:
                print(f"⚠️ Kon posters niet laden uit data.json: {e}")

    # --- STAP 2: BRON INLEZEN ---
    if not os.path.exists('kijkgeschiedenis.json'):
        print("❌ Fout: kijkgeschiedenis.json niet gevonden!")
        return

    with open('kijkgeschiedenis.json', 'r', encoding='utf-8') as f:
        history = json.load(f)

    # --- STAP 3: FILTEREN OP MUZIEK ---
    days_dict = {}
    for entry in history:
        # Filter op YouTube Music of items met subtitles (artiesten)
        is_music = entry.get('header') == "YouTube Music" or "music.youtube.com" in entry.get('titleUrl', '')
        if not is_music or 'title' not in entry:
            continue
        
        time_str = entry['time']
        if not (time_str.startswith('2025') or time_str.startswith('2026')):
            continue
        
        datum = time_str[:10]
        raw_artiest = entry['subtitles'][0]['name'] if 'subtitles' in entry else "Onbekend"
        raw_titel = entry['title']
        
        artiest, titel = clean_music_data(raw_artiest, raw_titel)
        
        # Skip lege titels of URL's
        if not titel or titel.startswith('http'): continue

        if datum not in days_dict:
            days_dict[datum] = []
        days_dict[datum].append((artiest, titel))

    # --- STAP 4: TOP 5 OPBOUWEN EN POSTERS MATCHEN ---
    final_output = []
    # Sorteer datums van nieuw naar oud
    for datum in sorted(days_dict.keys(), reverse=True):
        counts = Counter(days_dict[datum])
        top_5 = counts.most_common(5)
        
        for (artiest, titel), count in top_5:
            # We zoeken in de cache met de schoongemaakte namen
            key = (artiest.lower(), titel.lower())
            poster = poster_cache.get(key, "img/placeholder.png")
            
            final_output.append({
                "datum": datum,
                "titel": titel,
                "artiest": artiest,
                "poster": poster
            })

    # --- STAP 5: OPSLAAN ---
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    print(f"✅ Synchronisatie klaar. De posters zijn behouden en de teksten zijn schoon!")

if __name__ == "__main__":
    generate_smart_top5()