import json
import os

def check_all_failures():
    file_path = 'data.json'
    if not os.path.exists(file_path):
        print("❌ Fout: data.json niet gevonden.")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Gebruik een set voor unieke liedjes die falen
    missing_songs = set()
    total_entries = 0
    missing_entries = 0

    for entry in data:
        # Aangepast: We kijken nu naar 2024, 2025 en 2026
        if entry['datum'].startswith('2024') or entry['datum'].startswith('2025') or entry['datum'].startswith('2026'):
            total_entries += 1
            if entry['poster'] == "img/placeholder.png":
                missing_songs.add(f"{entry['artiest']} - {entry['titel']}")
                missing_entries += 1

    # Bereken succespercentage
    success_rate = 100 - (len(missing_songs) / (total_entries if total_entries > 0 else 1) * 100)

    print("=" * 40)
    print(f"📊 MUZIEK DAGBOEK STATUS (2024 - 2026)")
    print("=" * 40)
    print(f"✅ Totaal aantal geladen items: {total_entries}")
    print(f"❌ Aantal items zonder cover: {missing_entries}")
    
    if missing_songs:
        print(f"\n🔍 Er ontbreken nog {len(missing_songs)} unieke covers:")
        print("-" * 40)
        # Sorteer de lijst voor een netjes overzicht
        for i, song in enumerate(sorted(missing_songs), 1):
            print(f"{i}. {song}")
        print("-" * 40)
        print("\n💡 TIP: Zie je veel namen van uploaders (zoals 'Records' of 'Topic')?")
        print("Pas deze even aan in data.json en draai fetch_posters.py opnieuw.")
    else:
        print("\n✨ GEWELDIG! Je volledige archief is 100% compleet.")
    
    print("=" * 40)

if __name__ == "__main__":
    check_all_failures()