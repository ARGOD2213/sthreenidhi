#!/bin/sh
# Starts the mock dashboard (fake data). Needs Node.js 12 or newer.
cd "$(dirname "$0")"
exec node server.js
