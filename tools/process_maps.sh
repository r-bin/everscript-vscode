#!/bin/bash
SRC_BASE="/Users/v/Documents/evermore/research/maps"
TARGET_BASE="/Users/v/Documents/assets"
PYTHON="/Users/v/Documents/GitHub/everscript/.venv/bin/python"
SLICER="/Users/v/Documents/GitHub/everscript-vscode/tools/slice_montage.py"

find "$SRC_BASE" -maxdepth 1 -type d -name "act *" | while read -r act_dir; do
    act_name=$(basename "$act_dir")
    target_dir="$TARGET_BASE/$act_name"
    mkdir -p "$target_dir"
    
    find "$act_dir" -maxdepth 1 -name "*.png" | while read -r img_path; do
        img_name=$(basename "$img_path" .png)
        echo "Processing $img_path -> $target_dir"
        $PYTHON "$SLICER" "$img_path" -o "$target_dir" --prefix "${img_name}_"
    done
done
