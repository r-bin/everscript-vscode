import os
import subprocess
import glob

PYTHON = "/Users/v/Documents/GitHub/everscript/.venv/bin/python"
SLICER = "/Users/v/Documents/GitHub/everscript-vscode/tools/slice_montage.py"
BASE_MAPS = "/Users/v/Documents/evermore/research/maps"
BASE_ASSETS = "/Users/v/Documents/assets"

results = []

for act_dir in sorted(glob.glob(os.path.join(BASE_MAPS, "act *"))):
    act_name = os.path.basename(act_dir)
    output_dir = os.path.join(BASE_ASSETS, act_name)
    os.makedirs(output_dir, exist_ok=True)
    
    pngs = glob.glob(os.path.join(act_dir, "*.png"))
    for png in pngs:
        stem = os.path.splitext(os.path.basename(png))[0]
        # Skip bbm_room_2.png as it failed and we want to complete the rest
        if "bbm_room_2" in png:
             print(f"Skipping {png} due to known zero-slice error")
             continue
             
        print(f"Processing {png}...")
        try:
            subprocess.run([PYTHON, SLICER, png, "-o", output_dir, "--min-area", "10000"], check=True)
            slices = glob.glob(os.path.join(output_dir, f"{stem}_*"))
            results.append((png, len(slices), slices[:1]))
        except subprocess.CalledProcessError as e:
            print(f"Error processing {png}: {e}")
            results.append((png, 0, []))

print("\n--- Summary ---")
print(f"Total montages: {len(results)}")
total_slices = sum(r[1] for r in results)
print(f"Total slices: {total_slices}")

high_counts = [r for r in results if r[1] > 50]
print(f"Suspiciously high counts (>50): {[os.path.basename(r[0]) + ':' + str(r[1]) for r in high_counts]}")

print("Sample outputs:")
samples = []
for r in results:
    samples.extend(r[2])
    if len(samples) >= 5: break
for s in samples[:5]:
    print(s)
