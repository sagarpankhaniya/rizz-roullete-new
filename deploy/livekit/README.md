# Self-hosted LiveKit on Ubuntu VPS (native binary + systemd + Nginx)

No Docker. No LiveKit Cloud. Suitable for a single VPS today and multi-node
later via Redis (already enabled in `livekit.yaml`).

## What gets installed

| Piece | Path / port |
| --- | --- |
| Binary | `/usr/local/bin/livekit-server` |
| Config | `/etc/livekit/livekit.yaml` |
| systemd | `livekit.service` (enabled on boot) |
| Signaling | `127.0.0.1:7880` → Nginx → `wss://livekit.YOUR_DOMAIN` |
| ICE TCP | public `:7881` (not through Nginx) |
| Media UDP | public `50000-60000` (not through Nginx) |

## Prerequisites on the VPS

- Ubuntu 22.04+ (or 24.04)
- Root / sudo
- Redis already running on `127.0.0.1:6379` (same instance Nest uses; LiveKit uses `db: 1`)
- A DNS A/AAAA record for `livekit.YOUR_DOMAIN` → VPS public IP
- Nginx + Certbot for TLS (install steps below if missing)

## Generated credentials (this repo)

See [`credentials.env`](./credentials.env). The same key/secret are in
[`livekit.yaml`](./livekit.yaml) and Nest `backend/.env`.

Rotate anytime: regenerate keys, update `/etc/livekit/livekit.yaml` + Nest `.env`,
then `sudo systemctl restart livekit`.

---

## Option A — automated install (recommended)

Copy this folder to the VPS, then:

```bash
# Sets domain used in Nginx + printed Nest hints
export LIVEKIT_DOMAIN=livekit.your-real-domain.com

# Make the installer executable
chmod +x install.sh

# Run as root — downloads binary, writes config, enables systemd, opens UFW
sudo LIVEKIT_DOMAIN="$LIVEKIT_DOMAIN" ./install.sh
```

Then finish TLS:

```bash
# Issues Let's Encrypt cert and wires Nginx ssl_certificate directives
sudo certbot --nginx -d "$LIVEKIT_DOMAIN"
```

---

## Option B — manual commands (explained)

### 1. Packages

```bash
sudo apt-get update -y
# curl: download installer; unzip: some release archives; ca-certificates: HTTPS trust
sudo apt-get install -y curl unzip ca-certificates nginx redis-server
```

### 2. System user

```bash
# Dedicated non-login user so LiveKit does not run as root
sudo useradd --system --home /var/lib/livekit --shell /usr/sbin/nologin --create-home livekit
sudo mkdir -p /etc/livekit /var/log/livekit
sudo chown livekit:livekit /var/log/livekit
```

### 3. Install binary (official, no Docker)

```bash
# LiveKit's install script places livekit-server in /usr/local/bin
curl -sSL https://get.livekit.io | sudo bash
livekit-server --version
```

### 4. Config + credentials

```bash
# Copy production config (already contains generated keys from this repo)
sudo cp livekit.yaml /etc/livekit/livekit.yaml
sudo chown root:livekit /etc/livekit/livekit.yaml
sudo chmod 640 /etc/livekit/livekit.yaml
```

If you prefer to generate fresh keys on the server:

```bash
# Print a key/secret pair LiveKit understands
livekit-server generate-keys
# Paste into keys: section of /etc/livekit/livekit.yaml and Nest .env
```

### 5. systemd

```bash
sudo cp livekit.service /etc/systemd/system/livekit.service
# Reload unit files from disk
sudo systemctl daemon-reload
# Start on every boot
sudo systemctl enable livekit
# Start now
sudo systemctl start livekit
```

### 6. Firewall (media must bypass Nginx)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7881/tcp comment 'LiveKit ICE-TCP'
sudo ufw allow 50000:60000/udp comment 'LiveKit WebRTC UDP'
sudo ufw status
```

Also open the same ports on your cloud provider security group if applicable.

### 7. Nginx + TLS

```bash
# Replace domain placeholder, enable site
sudo sed 's/livekit.YOUR_DOMAIN/livekit.your-real-domain.com/g' nginx-livekit.conf \
  | sudo tee /etc/nginx/sites-available/livekit
sudo ln -sfn /etc/nginx/sites-available/livekit /etc/nginx/sites-enabled/livekit
sudo nginx -t
sudo systemctl reload nginx

# TLS certificates
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d livekit.your-real-domain.com
```

---

## Verify the service

```bash
# Active + enabled after reboot?
sudo systemctl status livekit
systemctl is-enabled livekit

# Recent logs
journalctl -u livekit -n 50 --no-pager

# Local signaling (Nest / health)
curl -i http://127.0.0.1:7880

# Public WSS path after TLS (expect HTTP response from LiveKit, not connection refused)
curl -i https://livekit.your-real-domain.com
```

Expect LiveKit to answer on the signaling port (often a small HTTP body / upgrade-oriented response). Connection refused means the process is down or bind failed — check `journalctl -u livekit -e`.

### WebRTC ports smoke check (from your laptop)

```bash
# TCP ICE fallback reachable?
nc -vz livekit.your-real-domain.com 7881
```

UDP is harder to probe; validate with two browser clients joining a call.

---

## NestJS `backend/.env`

After DNS + TLS work, copy values from `credentials.env` (created by install / already generated locally):

```env
LIVEKIT_URL=wss://livekit.your-real-domain.com
LIVEKIT_API_KEY=<LIVEKIT_API_KEY from credentials.env>
LIVEKIT_API_SECRET=<LIVEKIT_API_SECRET from credentials.env>
LIVEKIT_ROOM_EMPTY_TIMEOUT=300
LIVEKIT_MAX_PARTICIPANTS=2
LIVEKIT_TOKEN_TTL=2h
```

Nest derives the Room Service HTTP host from `LIVEKIT_URL` (`wss` → `https`).
The frontend never stores these values — it uses `livekitUrl` from the `matched` event.

Restart Nest after editing `.env`.

---

## Scaling later (still no Docker required)

1. Keep `redis.address` pointing at a shared Redis.
2. Run additional `livekit-server` nodes with the **same** `keys` and Redis.
3. Put signaling behind Nginx/load balancer; keep UDP/TCP RTC ports per-node on public IPs.
4. Optionally set `region` + `node_selector` in `livekit.yaml` (see upstream sample).

Single-VPS today already uses Redis `db: 1` so you do not re-architect Nest when you add a second SFU node.
