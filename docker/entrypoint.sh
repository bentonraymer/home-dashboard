#!/bin/sh
set -e
# Bind-mounted ./data folders are usually created as root by Docker; hand them
# to the unprivileged node user, then drop root before starting the app.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR" 2>/dev/null || true
  exec su-exec node "$@"
fi
exec "$@"
