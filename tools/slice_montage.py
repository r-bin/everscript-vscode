#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from collections import Counter
from collections import deque
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SliceBox:
    left: int
    top: int
    right: int
    bottom: int

    @property
    def width(self) -> int:
        return self.right - self.left

    @property
    def height(self) -> int:
        return self.bottom - self.top

    @property
    def area(self) -> int:
        return self.width * self.height


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Slice a montage that sits on a white canvas into separate image files "
            "by finding connected non-white regions."
        )
    )
    parser.add_argument("input", type=Path, help="Input montage image path")
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for exported slices (default: <input-stem>_slices next to input)",
    )
    parser.add_argument(
        "--white-threshold",
        type=int,
        default=245,
        help="Pixels with all RGB channels >= this value count as white background (default: 245)",
    )
    parser.add_argument(
        "--offwhite-threshold",
        type=int,
        default=215,
        help="Bright low-saturation pixels above this average level also count as background-like (default: 215)",
    )
    parser.add_argument(
        "--neutral-delta",
        type=int,
        default=32,
        help="Maximum RGB channel spread for an off-white pixel to count as neutral background-like (default: 32)",
    )
    parser.add_argument(
        "--min-area",
        type=int,
        default=5000,
        help="Ignore connected regions smaller than this bounding-box area (default: 5000)",
    )
    parser.add_argument(
        "--padding",
        type=int,
        default=0,
        help="Extra pixels to keep around each detected slice (default: 0)",
    )
    parser.add_argument(
        "--prefix",
        default=None,
        help="Output filename prefix (default: input file stem)",
    )
    parser.add_argument(
        "--row-tolerance",
        type=int,
        default=24,
        help="Vertical tolerance used to sort slices row-by-row (default: 24)",
    )
    parser.add_argument(
        "--min-gap",
        type=int,
        default=8,
        help="Minimum fully-background gutter thickness used to split panels (default: 8)",
    )
    parser.add_argument(
        "--gap-fraction",
        type=float,
        default=0.01,
        help="Allowed foreground fraction inside a gutter row/column when splitting panels (default: 0.01)",
    )
    parser.add_argument(
        "--open-iterations",
        type=int,
        default=4,
        help="Morphological opening passes used to remove thin signatures/notes/lines from the foreground mask (default: 4)",
    )
    parser.add_argument(
        "--bg-color-tolerance",
        type=int,
        default=22,
        help="RGB distance tolerance used for edge-connected canvas/background colors (default: 22)",
    )
    parser.add_argument(
        "--border-palette-size",
        type=int,
        default=4,
        help="How many dominant border colors to treat as candidate canvas/background colors (default: 4)",
    )
    parser.add_argument(
        "--quantize-step",
        type=int,
        default=16,
        help="Color quantization step used when extracting dominant border colors (default: 16)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print detected slice boxes without writing files",
    )
    return parser.parse_args()


def load_image(input_path: Path):
    try:
        from PIL import Image
    except ImportError as exc:  # pragma: no cover - user-facing dependency message
        raise SystemExit(
            "Pillow is required for this tool. Install it with:\n"
            "  /Users/v/Documents/GitHub/everscript/.venv/bin/python -m pip install Pillow"
        ) from exc

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    image = Image.open(input_path).convert("RGB")
    return image


def is_background_like(
    rgb: tuple[int, int, int],
    white_threshold: int,
    offwhite_threshold: int,
    neutral_delta: int,
) -> bool:
    if all(channel >= white_threshold for channel in rgb):
        return True

    channel_min = min(rgb)
    channel_max = max(rgb)
    avg = sum(rgb) / 3
    return avg >= offwhite_threshold and (channel_max - channel_min) <= neutral_delta


def quantize_rgb(rgb: tuple[int, int, int], quantize_step: int) -> tuple[int, int, int]:
    return tuple((channel // quantize_step) * quantize_step for channel in rgb)


def collect_border_palette(rgb_image, quantize_step: int, palette_size: int) -> list[tuple[int, int, int]]:
    width, height = rgb_image.size
    pixels = rgb_image.load()
    counts: Counter[tuple[int, int, int]] = Counter()

    for x in range(width):
        counts[quantize_rgb(pixels[x, 0], quantize_step)] += 1
        counts[quantize_rgb(pixels[x, height - 1], quantize_step)] += 1
    for y in range(height):
        counts[quantize_rgb(pixels[0, y], quantize_step)] += 1
        counts[quantize_rgb(pixels[width - 1, y], quantize_step)] += 1

    return [color for color, _ in counts.most_common(max(1, palette_size))]


def color_close(a: tuple[int, int, int], b: tuple[int, int, int], tolerance: int) -> bool:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2])) <= tolerance


def build_foreground_mask(
    rgb_image,
    white_threshold: int,
    offwhite_threshold: int,
    neutral_delta: int,
    open_iterations: int,
    bg_color_tolerance: int,
    border_palette_size: int,
    quantize_step: int,
):
    from PIL import Image, ImageFilter

    width, height = rgb_image.size
    src = rgb_image.load()
    # Note: border_palette / bg_color_tolerance are intentionally not used in canvas_like.
    # Using dominant border colors with a tolerance can misidentify map-tile colors as canvas
    # when panels touch the image edge, causing the flood-fill to eat into game content.
    # The is_background_like check (white / bright-neutral) is sufficient for these collages.
    _ = collect_border_palette(rgb_image, quantize_step, border_palette_size)  # unused

    background = Image.new("L", (width, height), 0)
    bg = background.load()
    visited = bytearray(width * height)

    def offset(x: int, y: int) -> int:
        return y * width + x

    def canvas_like(rgb: tuple[int, int, int]) -> bool:
        return is_background_like(rgb, white_threshold, offwhite_threshold, neutral_delta)

    queue = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        x, y = queue.popleft()
        idx = offset(x, y)
        if visited[idx]:
            continue
        visited[idx] = 1
        if not canvas_like(src[x, y]):
            continue
        bg[x, y] = 255
        for dx, dy in neighbors:
            nx = x + dx
            ny = y + dy
            if 0 <= nx < width and 0 <= ny < height:
                nidx = offset(nx, ny)
                if not visited[nidx]:
                    queue.append((nx, ny))

    mask = Image.new("L", (width, height), 0)
    dst = mask.load()
    for y in range(height):
        for x in range(width):
            dst[x, y] = 0 if bg[x, y] else 255

    for _ in range(max(0, open_iterations)):
        mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))

    return mask


def add_padding(box: SliceBox, padding: int, width: int, height: int) -> SliceBox:
    return SliceBox(
        left=max(0, box.left - padding),
        top=max(0, box.top - padding),
        right=min(width, box.right + padding),
        bottom=min(height, box.bottom + padding),
    )


def sort_boxes(boxes: list[SliceBox], row_tolerance: int) -> list[SliceBox]:
    if not boxes:
        return []

    ordered = sorted(boxes, key=lambda box: (box.top, box.left))
    rows: list[list[SliceBox]] = []

    for box in ordered:
        if not rows:
            rows.append([box])
            continue
        row_top = min(existing.top for existing in rows[-1])
        if abs(box.top - row_top) <= row_tolerance:
            rows[-1].append(box)
        else:
            rows.append([box])

    flattened: list[SliceBox] = []
    for row in rows:
        flattened.extend(sorted(row, key=lambda box: box.left))
    return flattened


def trim_box(
    rgb_image,
    box: SliceBox,
    white_threshold: int,
    offwhite_threshold: int,
    neutral_delta: int,
) -> SliceBox:
    pixels = rgb_image.load()
    left, top, right, bottom = box.left, box.top, box.right, box.bottom

    def row_all_background(y: int, x0: int, x1: int) -> bool:
        for x in range(x0, x1):
            if not is_background_like(pixels[x, y], white_threshold, offwhite_threshold, neutral_delta):
                return False
        return True

    def col_all_background(x: int, y0: int, y1: int) -> bool:
        for y in range(y0, y1):
            if not is_background_like(pixels[x, y], white_threshold, offwhite_threshold, neutral_delta):
                return False
        return True

    while top < bottom and row_all_background(top, left, right):
        top += 1
    while bottom > top and row_all_background(bottom - 1, left, right):
        bottom -= 1
    while left < right and col_all_background(left, top, bottom):
        left += 1
    while right > left and col_all_background(right - 1, top, bottom):
        right -= 1

    return SliceBox(left, top, right, bottom)


def trim_mask_box(mask_image, box: SliceBox) -> SliceBox | None:
    pixels = mask_image.load()
    left, top, right, bottom = box.left, box.top, box.right, box.bottom

    def row_empty(y: int, x0: int, x1: int) -> bool:
        for x in range(x0, x1):
            if pixels[x, y] != 0:
                return False
        return True

    def col_empty(x: int, y0: int, y1: int) -> bool:
        for y in range(y0, y1):
            if pixels[x, y] != 0:
                return False
        return True

    while top < bottom and row_empty(top, left, right):
        top += 1
    while bottom > top and row_empty(bottom - 1, left, right):
        bottom -= 1
    while left < right and col_empty(left, top, bottom):
        left += 1
    while right > left and col_empty(right - 1, top, bottom):
        right -= 1

    if left >= right or top >= bottom:
        return None
    return SliceBox(left, top, right, bottom)


def find_split_run(mask_image, box: SliceBox, axis: str, min_gap: int, gap_fraction: float):
    pixels = mask_image.load()
    runs = []
    start = None
    limit = box.height if axis == "row" else box.width
    span = box.width if axis == "row" else box.height
    allowed = max(0, int(span * gap_fraction))

    for i in range(limit):
        count = 0
        if axis == "row":
            y = box.top + i
            for x in range(box.left, box.right):
                if pixels[x, y] != 0:
                    count += 1
        else:
            x = box.left + i
            for y in range(box.top, box.bottom):
                if pixels[x, y] != 0:
                    count += 1

        is_gap = count <= allowed
        if is_gap and start is None:
            start = i
        elif not is_gap and start is not None:
            if i - start >= min_gap:
                runs.append((start, i))
            start = None

    if start is not None and limit - start >= min_gap:
        runs.append((start, limit))

    internal = [run for run in runs if run[0] > 0 and run[1] < limit]
    if not internal:
        return None
    return max(internal, key=lambda run: run[1] - run[0])


def split_panels(mask_image, box: SliceBox, min_gap: int, gap_fraction: float, min_area: int) -> list[SliceBox]:
    trimmed = trim_mask_box(mask_image, box)
    if trimmed is None or trimmed.area < min_area:
        return []

    row_gap = find_split_run(mask_image, trimmed, "row", min_gap, gap_fraction)
    col_gap = find_split_run(mask_image, trimmed, "col", min_gap, gap_fraction)

    best_axis = None
    best_gap = None
    if row_gap and col_gap:
        row_size = row_gap[1] - row_gap[0]
        col_size = col_gap[1] - col_gap[0]
        best_axis, best_gap = ("row", row_gap) if row_size >= col_size else ("col", col_gap)
    elif row_gap:
        best_axis, best_gap = "row", row_gap
    elif col_gap:
        best_axis, best_gap = "col", col_gap

    if best_axis is None:
        return [trimmed]

    if best_axis == "row":
        split_top = trimmed.top + best_gap[0]
        split_bottom = trimmed.top + best_gap[1]
        upper = SliceBox(trimmed.left, trimmed.top, trimmed.right, split_top)
        lower = SliceBox(trimmed.left, split_bottom, trimmed.right, trimmed.bottom)
        return split_panels(mask_image, upper, min_gap, gap_fraction, min_area) + split_panels(mask_image, lower, min_gap, gap_fraction, min_area)

    split_left = trimmed.left + best_gap[0]
    split_right = trimmed.left + best_gap[1]
    left_box = SliceBox(trimmed.left, trimmed.top, split_left, trimmed.bottom)
    right_box = SliceBox(split_right, trimmed.top, trimmed.right, trimmed.bottom)
    return split_panels(mask_image, left_box, min_gap, gap_fraction, min_area) + split_panels(mask_image, right_box, min_gap, gap_fraction, min_area)


def find_connected_regions(mask_image, min_area: int) -> list[SliceBox]:
    width, height = mask_image.size
    pixels = mask_image.load()
    visited = bytearray(width * height)
    regions: list[SliceBox] = []

    def offset(x: int, y: int) -> int:
        return y * width + x

    neighbors = [
        (-1, -1), (0, -1), (1, -1),
        (-1, 0),            (1, 0),
        (-1, 1),  (0, 1),  (1, 1),
    ]

    for y in range(height):
        for x in range(width):
            idx = offset(x, y)
            if visited[idx]:
                continue
            visited[idx] = 1
            if pixels[x, y] == 0:
                continue

            queue = deque([(x, y)])
            left = right = x
            top = bottom = y

            while queue:
                cur_x, cur_y = queue.popleft()
                left = min(left, cur_x)
                right = max(right, cur_x)
                top = min(top, cur_y)
                bottom = max(bottom, cur_y)

                for dx, dy in neighbors:
                    nx = cur_x + dx
                    ny = cur_y + dy
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nidx = offset(nx, ny)
                    if visited[nidx]:
                        continue
                    visited[nidx] = 1
                    if pixels[nx, ny] != 0:
                        queue.append((nx, ny))

            box = SliceBox(left, top, right + 1, bottom + 1)
            if box.area >= min_area:
                regions.append(box)

    return regions


def main() -> int:
    args = parse_args()
    image = load_image(args.input)
    output_dir = args.output_dir or args.input.with_name(f"{args.input.stem}_slices")
    prefix = args.prefix or args.input.stem

    mask = build_foreground_mask(
        image,
        args.white_threshold,
        args.offwhite_threshold,
        args.neutral_delta,
        args.open_iterations,
        args.bg_color_tolerance,
        args.border_palette_size,
        args.quantize_step,
    )
    full_box = SliceBox(0, 0, image.width, image.height)
    boxes = split_panels(mask, full_box, args.min_gap, args.gap_fraction, args.min_area)
    if len(boxes) <= 1:
        boxes = find_connected_regions(mask, args.min_area)
    boxes = [trim_box(image, box, args.white_threshold, args.offwhite_threshold, args.neutral_delta) for box in boxes]
    boxes = [box for box in boxes if box.width > 0 and box.height > 0 and box.area >= args.min_area]
    boxes = [add_padding(box, args.padding, image.width, image.height) for box in boxes]
    boxes = sort_boxes(boxes, args.row_tolerance)

    if not boxes:
        print("No slices detected.")
        return 1

    if args.dry_run:
        for index, box in enumerate(boxes, start=1):
            print(
                f"{index:02d}: left={box.left} top={box.top} right={box.right} "
                f"bottom={box.bottom} size={box.width}x{box.height}"
            )
        return 0

    output_dir.mkdir(parents=True, exist_ok=True)
    for stale_path in output_dir.glob(f"{prefix}_*.png"):
        stale_path.unlink()

    for index, box in enumerate(boxes, start=1):
        cropped = image.crop((box.left, box.top, box.right, box.bottom))
        output_path = output_dir / f"{prefix}_{index:02d}.png"
        cropped.save(output_path)
        print(f"wrote {output_path}")

    print(f"Exported {len(boxes)} slices to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())