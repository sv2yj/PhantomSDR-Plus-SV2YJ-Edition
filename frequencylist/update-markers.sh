#!/bin/bash

#enter here the full path to your 'frequencylist' folder
cd /home/sv1btl/PhantomSDR-Plus/frequencylist/

#is the last HFCC DB downloaded?
curl https://new.hfcc.org/data/ > ./curl-output.txt
#scan the page and keep the last update at $lastUpdateLine
while IFS= read -r line; do
	if echo "$line" | grep -q "Last updated on "; then
		echo "matched --> $line";
		lastUpdateLine=$line
	fi
done < ./curl-output.txt
echo "Last Update: $lastUpdateLine"

#get the currently used release by the stored file
currentUpdateLine=$(<./currentUpdateFile.txt)

#check if a new release exist
#delete all NL, tabs and CR at booth var
lastUpdateLine=$(echo $lastUpdateLine|tr -d '\n\t\r ')
currentUpdateLine=$(echo $currentUpdateLine|tr -d '\n\t\r ')

if [[ "$lastUpdateLine" == "$currentUpdateLine" ]]; then
	echo "match --> no download needed"
else
	echo "new download needed"
	echo "old release: $currentUpdateLine"
	echo "new release: $lastUpdateLine"
	echo $lastUpdateLine > ./currentUpdateFile.txt
	rm ./*0.TXT
	rm ./*.zip
	
	#extract the zip archive name
	zipArchive=$(echo "$lastUpdateLine"| cut -d'"' -f 2)
	url="https://new.hfcc.org/data/"
	url+=$zipArchive
	zipArchive=$(echo "$zipArchive"| cut -d'/' -f 2)

	#download the new release of DB
	curl $url --output ./$zipArchive
	
	#extract zip
	unzip -o $zipArchive
	
	#rename
	dbFilename=${zipArchive:0:3}
	dbFilename=${dbFilename^^}
	dbFilename+='all00.TXT'
	mv $dbFilename ./0.TXT
fi

##############################################################
# Generate current shortwave stations
python3 generate-current-shortwave.py

##############################################################
# Combine marker files using Python
# Priority: mymarkers.json first, then shortwavestations.json
# Duplicates removed by FREQUENCY ONLY (mymarkers.json version kept)

echo ""
echo "Combining marker files..."
echo "========================================" 

python3 << 'PYTHON_EOF'
import json
import sys

# Initialize markers array
markers = []

# 1. Load mymarkers.json first (YOUR CUSTOM MARKERS - PRIORITY)
print("Loading mymarkers.json...")
my_markers = []
try:
    with open('mymarkers.json', 'r') as f:
        my_markers = json.load(f)
        print(f"  ✓ Loaded {len(my_markers)} custom markers")
except FileNotFoundError:
    print("  ⚠ File not found, skipping")
except json.JSONDecodeError as e:
    print(f"  ✗ JSON error: {e}")
    sys.exit(1)

# 2. Load shortwavestations.json (auto-generated)
print("Loading shortwavestations.json...")
shortwave_markers = []
try:
    with open('shortwavestations.json', 'r') as f:
        shortwave_markers = json.load(f)
        print(f"  ✓ Loaded {len(shortwave_markers)} shortwave markers")
except FileNotFoundError:
    print("  ⚠ File not found, skipping")
except json.JSONDecodeError as e:
    print(f"  ✗ JSON error: {e}")
    sys.exit(1)

# 3. Remove duplicates - keep mymarkers.json version
# IMPORTANT: Check by FREQUENCY ONLY (not frequency + name)
print("\nRemoving duplicates by frequency (keeping your custom markers)...")

# Create a set of frequencies from mymarkers for fast lookup
my_frequencies = set(m['frequency'] for m in my_markers)

# Filter shortwave markers - remove any with same frequency as mymarkers
filtered_shortwave = []
duplicates_removed = 0
removed_details = []

for sw in shortwave_markers:
    if sw['frequency'] not in my_frequencies:
        filtered_shortwave.append(sw)
    else:
        duplicates_removed += 1
        # Find the corresponding mymarker
        my_marker = next((m for m in my_markers if m['frequency'] == sw['frequency']), None)
        if my_marker:
            removed_details.append({
                'frequency': sw['frequency'],
                'removed': sw['name'],
                'kept': my_marker['name']
            })

if duplicates_removed > 0:
    print(f"  ✓ Removed {duplicates_removed} duplicate(s) from shortwave")
    print(f"  ✓ Kept {len(filtered_shortwave)} unique shortwave markers")
    
    # Show details of removed duplicates
    if removed_details:
        print(f"\n  Duplicates removed (same frequency):")
        for dup in removed_details[:5]:  # Show first 5
            freq_mhz = dup['frequency'] / 1e6
            print(f"    {freq_mhz:>7.3f} MHz: Removed '{dup['removed']}', kept '{dup['kept']}'")
        if len(removed_details) > 5:
            print(f"    ... and {len(removed_details) - 5} more")
else:
    print(f"  ✓ No duplicates found")

# 4. Combine: YOUR MARKERS FIRST, then filtered shortwave
markers.extend(my_markers)
markers.extend(filtered_shortwave)

# Create final structure
output = {
    "markers": markers
}

# Write to markers.json in parent directory
try:
    with open('../markers.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print("")
    print("========================================")
    print(f"✓ Created markers.json successfully!")
    print(f"  Your custom markers: {len(my_markers)} (first)")
    print(f"  Shortwave markers:   {len(filtered_shortwave)} (after)")
    print(f"  Total markers:       {len(markers)}")
    print("========================================")
    
except Exception as e:
    print(f"✗ Error writing markers.json: {e}")
    sys.exit(1)

PYTHON_EOF

# Check if Python script succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo "Done! markers.json has been updated."
else
    echo ""
    echo "ERROR: Failed to create markers.json"
    exit 1
fi
