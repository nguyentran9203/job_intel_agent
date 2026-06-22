#!/bin/bash
# scripts/cron.sh — Set up daily pipeline cron job
#
# Adds a crontab entry that runs the pipeline every day at 08:00 UTC.
# Run this once: bash scripts/cron.sh
#
# To remove the cron later: crontab -e (delete the eu-job-intel line)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NODE_PATH="$(which node)"
LOG_FILE="$PROJECT_DIR/pipeline.log"

CRON_LINE="0 8 * * * cd $PROJECT_DIR && $NODE_PATH src/pipeline.js >> $LOG_FILE 2>&1"

# Check if already installed
if crontab -l 2>/dev/null | grep -q "eu-job-intel"; then
  echo "Cron job already installed. Current crontab:"
  crontab -l | grep "eu-job-intel" -A 1 -B 1
  exit 0
fi

# Add to crontab
(crontab -l 2>/dev/null; echo "# eu-job-intel pipeline"; echo "$CRON_LINE") | crontab -

echo "✓ Cron job installed:"
echo "  $CRON_LINE"
echo ""
echo "Logs will appear in: $LOG_FILE"
echo "To verify: crontab -l"
echo "To remove: crontab -e (delete the eu-job-intel lines)"
