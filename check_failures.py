import json
import os

def check_failures():
    files = {
        'data.json': 'Kalender (Top 5)',
        'stats.json': 'Volledige Statistieken',
        'monthly_stats.json': 'Maand Highlights'
    }
    
    total_items = 0
    total_placeholders = 0
    report = []

    print("=" * 40)
    print("📊 MUZIEK DAGBOEK INTEGRITEITS-CHECK")
    print("=" * 40)

    for file_name, description in files.items():
        if not os.path.exists(file_name):
            print(f"⚠️  Bestand niet gevonden: {file_name}")
            continue

        with open(file_name, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # monthly_stats is een dict, de rest een lijst
            entries = data.values() if isinstance(data, dict) else data
            
            file_total = 0
            file_placeholders = 0
            missing_titles = []

            for entry in entries:
                if isinstance(entry, dict):
                    file_total += 1
                    total_items += 1
                    
                    if entry.get('poster') == "img/placeholder.png":
                        file_placeholders += 1
                        total_placeholders += 1
                        # Sla de eerste 3 missende op per bestand voor het rapport
                        if len(missing_titles) < 3:
                            missing_titles.append(f"{entry['artiest']} - {entry['titel']}")

            print(f"{'✅' if file_placeholders == 0 else '❌'} {file_name} ({description}):")
            print(f"   Totaal items: {file_total}")
            print(f"   Zonder cover: {file_placeholders}")
            if file_placeholders > 0:
                print(f"   Voorbeelden: {', '.join(missing_titles)}...")
            print("-" * 40)

    print("\n" + "=" * 40)
    if total_placeholders == 0:
        print("✨ GEWELDIG! Je volledige archief is 100% compleet.")
    else:
        print(f"⚠️  STATUS: NIET COMPLEET")
        print(f"❌ Totaal aantal missende covers: {total_placeholders}")
        print(f"💡 Tip: Draai python3 fetch_posters.py om deze aan te vullen.")
    print("=" * 40)

if __name__ == "__main__":
    check_failures()