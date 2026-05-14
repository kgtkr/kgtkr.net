#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${DRAFT_MASTER_KEY:-}" ]; then
  echo "Error: DRAFT_MASTER_KEY is not set."
  exit 1
fi

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <draft-name>"
  exit 1
fi

DRAFT_NAME=$1
DRAFT_DIR="drafts"
mkdir -p "$DRAFT_DIR"

ENC_FILE="$DRAFT_DIR/$DRAFT_NAME.md.enc"

KEY=$(node $SCRIPT_DIR/gen-key.js "$DRAFT_NAME")
TEMP_FILE=$(mktemp)

if [ -f "$ENC_FILE" ]; then
  echo "Decrypting $ENC_FILE..."
  node $SCRIPT_DIR/crypto.js decrypt "$ENC_FILE" "$KEY" > "$TEMP_FILE"
else
  echo "New draft $DRAFT_NAME."
  echo "---" > "$TEMP_FILE"
  echo "title: \"$DRAFT_NAME\"" >> "$TEMP_FILE"
  echo "---" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
fi

${EDITOR:-vim} "$TEMP_FILE"

echo "Encrypting..."
node $SCRIPT_DIR/crypto.js encrypt "$TEMP_FILE" "$KEY" > "$ENC_FILE"

rm "$TEMP_FILE"
echo "Done. Draft available at /drafts/$DRAFT_NAME?enc_key=$KEY"
