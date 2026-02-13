import geopandas as gpd
import pandas as pd
import os

print("--- STARTING MAP GENERATION ---")

# --- CONFIGURATION ---
# We map the "official name" found in the GeoJSON to the "Display Name" your React app uses.
# You can add more regions here later if you expand!
TARGET_REGIONS = {
    # File: geoBoundaries-UGA-ADM1.geojson (Uganda)
    "UGA": {
        "file": "public/geoBoundaries-UGA-ADM1.geojson",
        "key": "shapeName", # Column holding the name
        "targets": {
            "Central Region": "KAMPALA" # We use Central Region/Wakiso area as 'KAMPALA' context
        }
    },
    # File: geoBoundaries-RWA-ADM2.geojson (Rwanda Districts)
    "RWA": {
        "file": "public/geoBoundaries-RWA-ADM2.geojson",
        "key": "shapeName",
        "targets": {
            "Nyarugenge": "KIGALI", # We combine these 3 into 'KIGALI'
            "Gasabo": "KIGALI",
            "Kicukiro": "KIGALI"
        }
    },
    # File: geoBoundaries-COD-ADM1.geojson (DRC Provinces)
    "COD": {
        "file": "public/geoBoundaries-COD-ADM1.geojson",
        "key": "shapeName",
        "targets": {
            "North Kivu": "GOMA" # North Kivu province represents Goma area
        }
    }
}

# 1. LOAD KENYA DATA
print("1. Loading Kenya Counties...")
try:
    kenya_data = gpd.read_file("public/kenya-counties.geojson") 
    
    # Standardize Kenya Data
    if 'COUNTY_NAM' in kenya_data.columns:
        kenya_counties = kenya_data.dissolve(by='COUNTY_NAM', as_index=False)
        kenya_counties['name'] = kenya_counties['COUNTY_NAM']
    else:
        kenya_counties = kenya_data
        if 'name' not in kenya_counties.columns:
             # Fallback if your file has different headers
            kenya_counties['name'] = kenya_counties.get('COUNTY', 'Unknown') 

    kenya_counties['boundary_type'] = 'county'
    kenya_counties = kenya_counties[['name', 'boundary_type', 'geometry']]
    print(f"   Loaded {len(kenya_counties)} Kenya counties.")
except Exception as e:
    print(f"   Error loading Kenya data: {e}")
    kenya_counties = gpd.GeoDataFrame()

# 2. PROCESS NEW FILES (Uganda, Rwanda, DRC)
print("2. Processing Expansion Files...")
expansion_frames = []

for country_code, config in TARGET_REGIONS.items():
    filepath = config["file"]
    if os.path.exists(filepath):
        print(f"   Processing {country_code} from {filepath}...")
        try:
            gdf = gpd.read_file(filepath)
            
            # Filter for only the regions we want
            target_names = list(config["targets"].keys())
            name_col = config["key"]
            
            # Filter: Keep rows where name_col is in our target list
            filtered_gdf = gdf[gdf[name_col].isin(target_names)].copy()
            
            if not filtered_gdf.empty:
                # Rename to React Display Name (e.g. "Nord-Kivu" -> "GOMA")
                filtered_gdf['name'] = filtered_gdf[name_col].map(config["targets"])
                
                # If multiple shapes map to one name (like Kigali districts), merge them!
                dissolved_gdf = filtered_gdf.dissolve(by='name', as_index=False)
                
                dissolved_gdf['boundary_type'] = 'expansion_city'
                dissolved_gdf = dissolved_gdf[['name', 'boundary_type', 'geometry']]
                
                expansion_frames.append(dissolved_gdf)
                print(f"     -> Added {len(dissolved_gdf)} regions.")
            else:
                print(f"     -> Found 0 matching regions. Check spelling: {target_names}")
                
        except Exception as e:
            print(f"     -> Error processing {filepath}: {e}")
    else:
        print(f"   ⚠️ File not found: {filepath}")

if expansion_frames:
    expansion_gdf = pd.concat(expansion_frames, ignore_index=True)
else:
    expansion_gdf = gpd.GeoDataFrame()

# 3. LOAD WORLD MAP
print("3. Loading World Map...")
try:
    world_url = "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson"
    world_countries = gpd.read_file(world_url)
    
    # Remove Kenya (KEN) to avoid overlap
    world_minus_kenya = world_countries[world_countries['ADM0_A3'] != 'KEN']
    world_minus_kenya['boundary_type'] = 'country'
    world_minus_kenya = world_minus_kenya[['NAME', 'boundary_type', 'geometry']].rename(columns={'NAME': 'name'})
except Exception as e:
    print(f"   Error loading World Map: {e}")
    exit()

# 4. MERGE & SAVE
print("4. Merging and Saving...")
layers = [world_minus_kenya]
if not kenya_counties.empty: layers.append(kenya_counties)
if not expansion_gdf.empty: layers.append(expansion_gdf)

hybrid_map = pd.concat(layers, ignore_index=True)

# Ensure correct CRS (WGS84)
if hybrid_map.crs is None:
    hybrid_map.set_crs(epsg=4326, inplace=True)
else:
    hybrid_map = hybrid_map.to_crs(epsg=4326)

# Simplify slightly for performance
hybrid_map['geometry'] = hybrid_map.simplify(tolerance=0.005, preserve_topology=True)

output_path = "public/countries.geo.json"
hybrid_map.to_file(output_path, driver='GeoJSON')

print(f"🎉 Success! Hybrid map saved to {output_path}")