#!/usr/bin/env bash
# Script to launch the Office Gym Booking server locally

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🏋️ Starting Office Gym Booking System..."
python3 server.py
