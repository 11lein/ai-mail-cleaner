#!/bin/sh
# Startet die Oberfläche im normalen Browser – ohne Thunderbird, mit Mock-API.
#   sh scripts/dev.sh            → http://localhost:8799/src/ui/_dev.html
#   …/_dev.html?n=5000           → zusätzliche 5000 Test-Mails (Performance)
#   …/_dev.html?fresh=1          → Erststart ohne Einstellungen
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-8799}"

# _dev.html = cleaner.html + Mock-Skript (wird nicht mitgepackt, siehe build.sh)
sed 's#</head>#<script src="../../dev/mock-messenger.js"></script></head>#' \
  src/ui/cleaner.html > src/ui/_dev.html

echo "Dev preview: http://localhost:$PORT/src/ui/_dev.html"
# Statischer Server ohne Browser-Cache (sonst bleiben alte ES-Module hängen)
exec python3 - "$PORT" <<'PY'
import sys, http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a):
        pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", int(sys.argv[1])), H) as s:
    s.serve_forever()
PY
