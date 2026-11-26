#!/bin/sh
# Stamp a new release version into index.html and version.json.
set -e
cd "$(dirname "$0")/../static"
v=$(date +%Y%m%d%H%M%S)
sed -i -E "s#\?v=[0-9]+#?v=$v#g; s#const V = \"[0-9]+\"#const V = \"$v\"#" index.html
printf '{"v":"%s"}\n' "$v" > version.json
echo "$v"
