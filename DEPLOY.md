# Deployment

Self-hosted on a Raspberry Pi, exposed to the internet via Cloudflare Tunnel,
fronted by Caddy. Domain: **pokerbs.com** (registered on Cloudflare).

## Architecture

```
                                pokerbs.com
                                     │
                                     │ (HTTPS, terminated by Cloudflare edge)
                                     ▼
                          ┌─────────────────────┐
                          │  Cloudflare Tunnel  │  ← outbound connection
                          │   (cloudflared)     │     from Pi, no inbound ports
                          └──────────┬──────────┘
                                     │ http://localhost:80
                                     ▼
                          ┌─────────────────────┐
                          │       Caddy         │  :80
                          │                     │
                          │  /        → static  │ ── client/dist
                          │  /api/*   → :8080   │
                          │  /ws/*    → :8080   │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  bs-poker server    │  :8080 (Go)
                          └─────────────────────┘
```

Why this shape:
- **Cloudflare Tunnel** removes the need to open ports on the home router or
  expose the Pi's IP. The tunnel daemon makes an outbound connection to
  Cloudflare; traffic to pokerbs.com is routed back through it.
- **Caddy** serves the built React bundle directly and reverse-proxies `/api`
  and `/ws` to the Go server. TLS at the edge is handled by Cloudflare, so
  Caddy can listen on plain HTTP on localhost.
- **Go server** stays on `:8080`, bound to localhost only (no exposure).

## One-time setup

### 1. Pi prerequisites

Assuming a fresh Raspberry Pi OS (64-bit) install:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates debian-keyring debian-archive-keyring apt-transport-https
```

Install Go (arm64):

```bash
GO_VERSION=1.24.7
curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-arm64.tar.gz | sudo tar -C /usr/local -xz
echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh
source /etc/profile.d/go.sh
go version
```

Install Node (for building the client; nvm keeps things tidy):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
node --version
```

### 2. Clone the repo

```bash
sudo mkdir -p /srv && sudo chown $USER:$USER /srv
cd /srv
git clone https://github.com/<you>/bs_poker.git
cd bs_poker
```

### 3. Build the server

```bash
cd /srv/bs_poker/server
go build -o /srv/bs_poker/bin/bs-poker-server .
```

### 4. Build the client

```bash
cd /srv/bs_poker/client
npm ci
npm run build
# Output: /srv/bs_poker/client/dist
```

### 5. Install Caddy

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Replace the default `/etc/caddy/Caddyfile` with:

```caddyfile
# Caddy listens on plain HTTP because TLS is terminated at Cloudflare's edge.
# The :80 here is the localhost-facing port that cloudflared connects to.
:80 {
    encode zstd gzip

    # WebSocket — must come before the static handler so /ws/* doesn't
    # fall through to file serving.
    handle /ws/* {
        reverse_proxy localhost:8080
    }

    # REST API
    handle /api/* {
        reverse_proxy localhost:8080
    }

    # Static SPA: serve files, fall back to index.html for client routes
    handle {
        root * /srv/bs_poker/client/dist
        try_files {path} /index.html
        file_server
    }
}

# Caddy logs to stdout by default; systemd captures it.
# View logs with: journalctl -u caddy -f
```

Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo systemctl status caddy
```

> If Caddy fails to start with `bind: address already in use` on `:80`, another
> web server is squatting the port. On a default Raspberry Pi OS install this is
> often `apache2`:
>
> ```bash
> sudo ss -tlnp | grep ':80 '          # identify the process
> sudo systemctl stop apache2
> sudo systemctl disable apache2
> sudo systemctl start caddy
> ```

### 6. systemd unit for the Go server

`/etc/systemd/system/bs-poker.service`:

```ini
[Unit]
Description=BS Poker Go server
After=network.target

[Service]
Type=simple
# Replace with your Pi login (Raspberry Pi OS Bookworm+ no longer creates a
# default `pi` user — check with `id -un`).
User=<your-user>
WorkingDirectory=/srv/bs_poker/server
ExecStart=/srv/bs_poker/bin/bs-poker-server
Restart=on-failure
RestartSec=3
# Bind to localhost only — Caddy is the only thing that should reach it.
Environment=GOMAXPROCS=4

[Install]
WantedBy=multi-user.target
```

> Note: `main.go` currently calls `http.ListenAndServe(":8080", ...)`, which
> binds to all interfaces. Since the router doesn't forward 8080 and the Pi
> isn't directly internet-exposed (cloudflared is the only ingress) this is
> fine, but tightening to `127.0.0.1:8080` is a one-line hardening win.

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bs-poker
sudo systemctl status bs-poker
journalctl -u bs-poker -f
```

### 7. Cloudflare Tunnel

#### Install cloudflared

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

#### Authenticate and create the tunnel

```bash
cloudflared tunnel login              # opens a URL — pick pokerbs.com
cloudflared tunnel create bs-poker    # creates the tunnel + credentials JSON
```

The credentials file lands at `~/.cloudflared/<tunnel-id>.json`.

#### Route DNS

```bash
cloudflared tunnel route dns bs-poker pokerbs.com
cloudflared tunnel route dns bs-poker www.pokerbs.com
```

This creates CNAME records pointing both hostnames at the tunnel.

#### Config file

The system-wide `cloudflared` service runs as root, so put the config and
credentials in `/etc/cloudflared/` (not `~/.cloudflared/`, which root can't
see). Easiest: create them under your user, then copy:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp ~/.cloudflared/*.json     /etc/cloudflared/    # tunnel credentials
sudo cp ~/.cloudflared/cert.pem   /etc/cloudflared/    # account cert from `tunnel login`
```

`/etc/cloudflared/config.yml`:

```yaml
tunnel: bs-poker
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: pokerbs.com
    service: http://localhost:80
  - hostname: www.pokerbs.com
    service: http://localhost:80
  - service: http_status:404
```

#### Run as a service

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

> If `service install` errors with "Cannot determine default configuration
> path", the config isn't in one of the paths root searches. Confirm
> `/etc/cloudflared/config.yml` exists and re-run.

### 8. Cloudflare dashboard settings

In the Cloudflare dashboard for pokerbs.com:

- **SSL/TLS → Overview**: set encryption mode to **Full** (Cloudflare ↔ tunnel
  is already secure; the origin is plain HTTP on localhost, which is fine
  because the tunnel itself is encrypted).
- **SSL/TLS → Edge Certificates**: turn on **Always Use HTTPS**.
- **Network**: ensure **WebSockets** is **On** (default on, but worth
  confirming — required for `/ws/*`).
- **Rules → Page Rules** (optional): cache static assets aggressively. The
  Vite build emits hashed filenames so long TTLs are safe.

## Deploys

### Manual

```bash
cd /srv/bs_poker
git pull

# Rebuild server
cd server
go build -o /srv/bs_poker/bin/bs-poker-server .
sudo systemctl restart bs-poker

# Rebuild client
cd ../client
npm ci
npm run build
# Caddy serves from dist/ directly; no restart needed.
```

### Auto-deploy (systemd timer, pull-based)

A systemd timer fetches `origin/main` every 5 hours and runs the deploy
script if there are new commits. Pull-based so the Pi keeps zero inbound
exposure — no webhook, no CI SSH key, no GitHub Actions runner.

The repo ships three files for this under `scripts/`:

- `scripts/deploy.sh` — fetches main; if nothing changed, exits silently;
  otherwise fast-forwards, rebuilds server + client, and restarts the service.
- `scripts/bs-poker-autodeploy.service` — oneshot unit that runs the script.
- `scripts/bs-poker-autodeploy.timer` — fires 5 min after boot, every 5 hours.

Install:

```bash
# Edit the service file's `User=<your-user>` to match your Pi login.
sudo cp /srv/bs_poker/scripts/bs-poker-autodeploy.service /etc/systemd/system/
sudo cp /srv/bs_poker/scripts/bs-poker-autodeploy.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bs-poker-autodeploy.timer
```

The script calls `sudo systemctl restart bs-poker`, so the deploy user needs
a passwordless sudo rule for just that command. Add via `sudo visudo`:

```
<your-user> ALL=(root) NOPASSWD: /bin/systemctl restart bs-poker
```

(Path may be `/usr/bin/systemctl` on some systems — check with `which systemctl`.)

Verify:

```bash
systemctl list-timers bs-poker-autodeploy.timer
journalctl -u bs-poker-autodeploy.service -n 50 -f
```

To force an immediate deploy without waiting for the timer:

```bash
sudo systemctl start bs-poker-autodeploy.service
```

To pause auto-deploys (e.g. during incident response):

```bash
sudo systemctl stop bs-poker-autodeploy.timer
```

## Verification

After a deploy:

```bash
# Local checks on the Pi
curl -sf http://localhost:8080/api/rooms >/dev/null && echo "go server ok"
curl -sf http://localhost/api/rooms     >/dev/null && echo "caddy ok"

# From anywhere
curl -sfI https://pokerbs.com | head -1
curl -sf https://pokerbs.com/api/rooms

# WebSocket end-to-end: open https://pokerbs.com in two browsers,
# create a room in one, join from the other, play a round.
```

## Troubleshooting

- **502 from pokerbs.com**: Caddy is up but Go server is down. `journalctl -u bs-poker -n 100`.
- **WS connects then drops**: confirm Cloudflare → Network → WebSockets is on.
  Also check the `/ws/*` handler comes *before* the static `handle {}` in the
  Caddyfile (otherwise file_server captures the request).
- **DNS doesn't resolve**: `cloudflared tunnel route dns ...` must succeed.
  Check the DNS tab — there should be a CNAME for `pokerbs.com` pointing at
  `<tunnel-id>.cfargotunnel.com` (proxied, orange cloud).
- **`cloudflared` won't start**: `sudo journalctl -u cloudflared -n 100`.
  Most often it's a missing credentials file path in `config.yml`.
- **Stale frontend after deploy**: hard refresh, or check that `npm run build`
  actually wrote new files into `client/dist`. Vite hashes filenames so the
  browser shouldn't serve stale JS — but the `index.html` itself can be cached
  by Cloudflare. A purge in the dashboard fixes it; a longer-term fix is a
  cache rule that bypasses cache for `index.html`.

## Future hardening

- Bind Go server to `127.0.0.1:8080` (small `main.go` change).
- Move build artifacts off the Pi: build the client in CI, ship `dist/`
  via `rsync` or a release artifact. Building Node modules on a Pi is slow.
- Add a basic health endpoint (`GET /healthz`) and use it in the systemd
  unit's `ExecStartPost` so failed deploys roll back instead of black-holing.