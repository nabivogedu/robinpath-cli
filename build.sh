#!/bin/bash
# Build robinpath standalone binary (macOS/Linux)
# Run from the robinpath-engine directory

set -e

echo "=== Building RobinPath Engine ==="

# Step 1: Build the TypeScript source
echo "[1/5] Building @wiredwp/robinpath..."
cd ../robinpath && npm run build && cd ../robinpath-engine

# Step 2: Bundle into single CJS file
echo "[2/5] Bundling CLI..."
mkdir -p dist
npx esbuild cli-entry.js --bundle --platform=node --format=cjs --target=node22 --outfile=dist/robinpath-cli.cjs

# Step 3: Generate SEA blob
echo "[3/5] Generating SEA blob..."
node --experimental-sea-config sea-config.json

# Step 4: Create binary
echo "[4/5] Creating binary..."
NODE_BIN=$(node -e "process.stdout.write(process.execPath)")
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    OUTPUT="dist/robinpath.exe"
else
    OUTPUT="dist/robinpath"
fi

cp "$NODE_BIN" "$OUTPUT"
npx postject "$OUTPUT" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "cygwin" && "$OSTYPE" != "win32" ]]; then
    chmod +x "$OUTPUT"
fi

# Step 5: Create 'rp' alias binary
echo "[5/5] Creating 'rp' alias..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    RP_OUTPUT="dist/rp.exe"
else
    RP_OUTPUT="dist/rp"
fi
cp "$OUTPUT" "$RP_OUTPUT"

echo ""
echo "=== Done! ==="
echo "Binary: $OUTPUT"
echo "Alias:  $RP_OUTPUT"
ls -lh "$OUTPUT" "$RP_OUTPUT"
