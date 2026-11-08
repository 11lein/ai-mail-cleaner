#!/bin/sh
# Erzeugt die PNG-Icons (16–128 px) aus src/icons/icon.svg.
# Benötigt ImageMagick (brew install imagemagick).
set -e
cd "$(dirname "$0")/../src/icons"
for s in 16 32 48 64 96 128; do
  magick -background none -density 600 icon.svg -resize "${s}x${s}" "icon-$s.png"
done
ls -1 icon-*.png
