#!/bin/sh
# nginx -g "daemon off;" runs nginx in foreground mode (not as daemon)
# If node exits, container exits; nginx crash is visible in logs
nginx -g "daemon off;" &
exec node packages/backend/dist/index.js
