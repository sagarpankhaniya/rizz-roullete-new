#!/usr/bin/env bash
# =============================================================================
# install.sh — Native LiveKit on Ubuntu (no Docker)
#
# Run on the Ubuntu VPS as a user with sudo:
#   chmod +x install.sh && sudo ./install.sh
#
# Optional env:
#   LIVEKIT_DOMAIN=livekit.example.com   # used in printed Nest .env hints
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIVEKIT_DOMAIN="${LIVEKIT_DOMAIN:-livekit.YOUR_DOMAIN}"
CREDENTIALS_FILE="${SCRIPT_DIR}/credentials.env"
CONFIG_TEMPLATE="${SCRIPT_DIR}/livekit.yaml.example"
CONFIG_BUILT="${SCRIPT_DIR}/livekit.yaml"
UNIT_FILE="${SCRIPT_DIR}/livekit.service"
NGINX_SRC="${SCRIPT_DIR}/nginx-livekit.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run as root: sudo $0"
  exit 1
fi

echo "==> [1/9] Update package index and install prerequisites"
echo "    apt-get update — refreshes Ubuntu package lists"
echo "    curl unzip ca-certificates — fetch LiveKit release + TLS trust store"
apt-get update -y
apt-get install -y curl unzip ca-certificates

echo "==> [2/9] Create dedicated livekit system user (no login shell)"
echo "    Isolates the SFU process from root for safer production operation"
if ! id -u livekit >/dev/null 2>&1; then
  useradd --system --home /var/lib/livekit --shell /usr/sbin/nologin --create-home livekit
fi
mkdir -p /etc/livekit /var/log/livekit /var/lib/livekit
chown -R livekit:livekit /var/log/livekit /var/lib/livekit

echo "==> [3/9] Download official livekit-server binary (amd64)"
echo "    Uses LiveKit's install script → places binary in /usr/local/bin"
curl -sSL https://get.livekit.io | bash

if [[ ! -x /usr/local/bin/livekit-server ]]; then
  echo "ERROR: livekit-server not found in /usr/local/bin after install"
  exit 1
fi
/usr/local/bin/livekit-server --version || true

echo "==> [4/9] Load or generate API key + secret"
if [[ -f "${CREDENTIALS_FILE}" ]] && grep -q '^LIVEKIT_API_KEY=' "${CREDENTIALS_FILE}"; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "${CREDENTIALS_FILE}"
  set +a
  echo "    Using existing credentials from credentials.env"
else
  echo "    Generating new API key/secret with openssl"
  LIVEKIT_API_KEY="API$(openssl rand -hex 8)"
  LIVEKIT_API_SECRET="$(openssl rand -base64 32 | tr -d '\n=+/' | head -c 43)"
  LIVEKIT_URL="wss://${LIVEKIT_DOMAIN}"
  cat > "${CREDENTIALS_FILE}" <<EOF
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
LIVEKIT_URL=${LIVEKIT_URL}
LIVEKIT_ROOM_EMPTY_TIMEOUT=300
LIVEKIT_MAX_PARTICIPANTS=2
LIVEKIT_TOKEN_TTL=2h
EOF
  chmod 600 "${CREDENTIALS_FILE}"
fi

: "${LIVEKIT_API_KEY:?missing LIVEKIT_API_KEY}"
: "${LIVEKIT_API_SECRET:?missing LIVEKIT_API_SECRET}"

echo "==> [5/9] Write /etc/livekit/livekit.yaml from template + credentials"
sed \
  -e "s|__LIVEKIT_API_KEY__|${LIVEKIT_API_KEY}|g" \
  -e "s|__LIVEKIT_API_SECRET__|${LIVEKIT_API_SECRET}|g" \
  "${CONFIG_TEMPLATE}" > /etc/livekit/livekit.yaml
# Also refresh local built copy for reference
cp /etc/livekit/livekit.yaml "${CONFIG_BUILT}"
chown root:livekit /etc/livekit/livekit.yaml
chmod 640 /etc/livekit/livekit.yaml

echo "==> [6/9] Install systemd unit and enable on boot"
echo "    daemon-reload — pick up new unit file"
echo "    enable — start LiveKit after every reboot"
echo "    restart — apply config now"
cp "${UNIT_FILE}" /etc/systemd/system/livekit.service
systemctl daemon-reload
systemctl enable livekit.service
systemctl restart livekit.service

echo "==> [7/9] Open firewall ports (UFW) if ufw is present"
echo "    7881/tcp  — WebRTC ICE over TCP (must NOT go through Nginx)"
echo "    50000:60000/udp — WebRTC media"
echo "    80/443    — Nginx TLS for signaling (if not already open)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 7881/tcp comment 'LiveKit ICE-TCP' || true
  ufw allow 50000:60000/udp comment 'LiveKit WebRTC UDP' || true
  ufw allow 80/tcp comment 'HTTP' || true
  ufw allow 443/tcp comment 'HTTPS' || true
  ufw status || true
else
  echo "    ufw not installed — open these ports on your cloud security group / iptables"
fi

echo "==> [8/9] Install Nginx site snippet (TLS via certbot separately)"
if command -v nginx >/dev/null 2>&1; then
  sed "s/livekit.YOUR_DOMAIN/${LIVEKIT_DOMAIN}/g" "${NGINX_SRC}" \
    > /etc/nginx/sites-available/livekit
  ln -sfn /etc/nginx/sites-available/livekit /etc/nginx/sites-enabled/livekit
  nginx -t && systemctl reload nginx
  echo "    Next: sudo certbot --nginx -d ${LIVEKIT_DOMAIN}"
else
  echo "    nginx not installed yet — copy nginx-livekit.conf after you install Nginx"
fi

echo "==> [9/9] Verify LiveKit is running"
systemctl --no-pager --full status livekit.service || true
sleep 1
if curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7880; then
  echo "    Local HTTP reachability: OK (signaling port 7880)"
else
  echo "    WARNING: could not reach http://127.0.0.1:7880 — check journalctl -u livekit -e"
fi

cat <<EOF

=============================================================================
LiveKit install complete (self-hosted, no Cloud)

Paste into NestJS backend/.env:

LIVEKIT_URL=wss://${LIVEKIT_DOMAIN}
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
LIVEKIT_ROOM_EMPTY_TIMEOUT=300
LIVEKIT_MAX_PARTICIPANTS=2
LIVEKIT_TOKEN_TTL=2h

Verify:
  sudo systemctl status livekit
  curl -i http://127.0.0.1:7880
  # after DNS + certbot:
  curl -i https://${LIVEKIT_DOMAIN}

Logs:
  journalctl -u livekit -f
=============================================================================
EOF
