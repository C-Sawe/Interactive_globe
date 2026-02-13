import json
import os

# 1. SETUP
SOURCE_FILE = "public/kenya-counties.geojson"
OUTPUT_DIR = "public"
TARGET_COUNTIES = ["KWALE", "KILIFI", "KISUMU", "MACHAKOS", "LAMU"]

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def normalize_name(name):
    """Helper to handle case sensitivity (e.g. 'Kisumu' vs 'KISUMU')"""
    return name.strip().upper() if name else ""

# 2. LOAD DATA
print(f"📂 Loading {SOURCE_FILE}...")
try:
    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
except FileNotFoundError:
    print(f"❌ Error: Could not find {SOURCE_FILE}")
    exit()

# 3. SEARCH AND EXTRACT
found_count = 0
print(f"🔍 Searching for: {', '.join(TARGET_COUNTIES)}...")

for feature in data.get('features', []):
    props = feature.get('properties', {})
    
    # Check common keys for the county name
    # (Data sources vary: some use 'COUNTY', 'name', 'COUNTY_NAM', 'Name', etc.)
    raw_name = props.get('COUNTY') or props.get('name') or props.get('COUNTY_NAM') or props.get('Name')
    
    if not raw_name:
        continue
        
    name_upper = normalize_name(str(raw_name))

    if name_upper in TARGET_COUNTIES:
        # We found a match!
        print(f"   ✅ Found {name_upper}!")
        
        # Create a single-feature GeoJSON for this county
        county_geojson = {
            "type": "FeatureCollection",
            "features": [feature]
        }
        
        # Save it
        filename = f"{name_upper}.geojson"
        output_path = os.path.join(OUTPUT_DIR, filename)
        
        with open(output_path, 'w', encoding='utf-8') as out_f:
            json.dump(county_geojson, out_f)
            
        print(f"      💾 Saved to {output_path}")
        found_count += 1

# 4. SUMMARY
print("-" * 30)
if found_count == len(TARGET_COUNTIES):
    print("🎉 Success! All counties extracted.")
else:
    print(f"⚠️ Done, but only found {found_count} out of {len(TARGET_COUNTIES)} counties.")
    print("If some are missing, check the spelling in your source file.")