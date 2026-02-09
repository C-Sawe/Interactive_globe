import geopandas as gpd
import pandas as pd

# 1. LOAD DATA
print("Loading Kenya Data...")
# Load the file you verified
kenya_data = gpd.read_file("public/kenya-counties.geojson")

print("Loading World Map...")
world_url = "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson"
world_countries = gpd.read_file(world_url)

# 2. DISSOLVE CONSTITUENCIES INTO COUNTIES
# Your file has 'COUNTY_NAM' and 'CONSTITUEN'. We merge by 'COUNTY_NAM' 
# to get 47 clean county shapes instead of hundreds of constituencies.
print("Merging constituencies into clean County boundaries...")
kenya_counties = kenya_data.dissolve(by='COUNTY_NAM', as_index=False)

# 3. STANDARDIZE COLUMNS
# Rename 'COUNTY_NAM' to 'name' so Deck.gl can read it easily
kenya_counties['name'] = kenya_counties['COUNTY_NAM']
kenya_counties['boundary_type'] = 'county'

# Keep only necessary columns to keep file size small
kenya_counties = kenya_counties[['name', 'boundary_type', 'geometry']]

# 4. PREPARE WORLD MAP
print("Removing generic Kenya from World Map...")
# Remove the old 'Kenya' shape so it doesn't overlap
world_minus_kenya = world_countries[world_countries['ADM0_A3'] != 'KEN']
world_minus_kenya['boundary_type'] = 'country'
world_minus_kenya = world_minus_kenya[['NAME', 'boundary_type', 'geometry']].rename(columns={'NAME': 'name'})

# 5. MERGE & SAVE
print("Combining World + Kenya Counties...")
hybrid_map = pd.concat([world_minus_kenya, kenya_counties], ignore_index=True)

print("Saving to public/countries.geo.json...")
# Simplify slightly to reduce file size (0.005 is good for web globes)
hybrid_map['geometry'] = hybrid_map.simplify(tolerance=0.005, preserve_topology=True)

hybrid_map.to_file("public/countries.geo.json", driver='GeoJSON')

print("🎉 Success! Your hybrid map is ready.")