#!/bin/bash

OUTPUT_FILE="source-code.zip"
TEMP_DIR="source-export"

rm -f "$OUTPUT_FILE"
rm -rf "$TEMP_DIR"

mkdir -p "$TEMP_DIR"

INCLUDE_DIRS=(
  "components"
  "constants"
  "contexts"
  "hooks"
  "i18n"
  "lib"
  "navigation"
  "screens"
  "services"
  "types"
  "assets"
)

INCLUDE_FILES=(
  "App.tsx"
  "app.json"
  "babel.config.js"
  "index.js"
  "metro.config.js"
  "tsconfig.json"
  "package.json"
  "design_guidelines.md"
)

for dir in "${INCLUDE_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    cp -r "$dir" "$TEMP_DIR/"
    echo "Added directory: $dir"
  fi
done

for file in "${INCLUDE_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$TEMP_DIR/"
    echo "Added file: $file"
  fi
done

cd "$TEMP_DIR"
zip -r "../$OUTPUT_FILE" . -x "*.DS_Store" -x "__pycache__/*" -x "node_modules/*" -x ".git/*"
cd ..

rm -rf "$TEMP_DIR"

echo ""
echo "Source code exported successfully to: $OUTPUT_FILE"
echo "File size: $(du -h $OUTPUT_FILE | cut -f1)"
