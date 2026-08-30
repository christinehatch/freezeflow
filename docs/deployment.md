# Deployment

Freezeflow ships as two Docker images (backend, frontend) and a
`docker-compose.yml` that runs both on a single host. See
[ADR-0021](architecture-decisions/0021-deployment-and-environment-strategy.md)
for why it's shaped this way.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`. The frontend container's nginx serves the
built app and proxies `/api/` to the backend container, so the browser
never talks to the backend directly.

`docker compose up` alone (without `--build`) is enough on later runs once
the images exist; `--build` picks up code changes.

## Recommended: a small VPS + Tailscale

For a real, single-user deployment (e.g. running this for a family member)
with no public exposure and no domain to manage, the simplest secure setup
is a small VPS reachable only over [Tailscale](https://tailscale.com) - the
app is never exposed to the raw internet at all.

**1. Provision a VPS.** Any provider works; this app's SQLite-backed load
is light enough for the cheapest tier anyone offers - e.g. a Hetzner Cloud
CX22 or a DigitalOcean Basic Droplet. Pick Ubuntu 24.04 LTS and make sure
you have SSH access (providers walk you through adding an SSH key at
creation time).

**2. Add a read-only deploy key for this repo** (it's private, so the
server needs its own credential rather than your personal one). On your
own machine:

```bash
ssh-keygen -t ed25519 -f freezeflow-deploy-key -N ""
```

Add `freezeflow-deploy-key.pub`'s contents as a Deploy Key on the GitHub
repo (Settings -> Deploy keys -> Add deploy key; read-only is enough).
Keep `freezeflow-deploy-key` (no `.pub`) - you'll copy it to the server.

**3. Run the setup script on the server.** `scp` `freezeflow-deploy-key` to
`~/.ssh/freezeflow-deploy-key` on the server, then `scp` and run
[`scripts/vps-setup.sh`](../scripts/vps-setup.sh):

```bash
scp freezeflow-deploy-key root@<server-ip>:~/.ssh/freezeflow-deploy-key
scp scripts/vps-setup.sh root@<server-ip>:~/vps-setup.sh
ssh root@<server-ip> 'bash ~/vps-setup.sh'
```

It installs Docker and Tailscale, brings Tailscale up (follow the login
link it prints the first time, to attach the server to your tailnet),
clones this repo to `/opt/freezeflow`, creates `.env` from `.env.example`,
and starts the stack.

**4. Expose it over Tailscale only, with HTTPS.** On the server:

```bash
sudo tailscale serve --bg 8080
```

This makes the app reachable at `https://<server-name>.<your-tailnet>.ts.net`
to anyone on your tailnet - no port number, a valid HTTPS certificate, and
nothing reachable from the public internet. Set
`FREEZEFLOW_CORS_ALLOWED_ORIGINS` in `.env` to that exact `https://...`
origin and restart: `docker compose up -d`. (HTTPS certificates need to be
enabled once for your tailnet in the Tailscale admin console's DNS
settings if they aren't already - on by default for personal accounts.)

If you'd rather skip `tailscale serve`, plain `http://<tailscale-ip>:8080`
works too - just point `FREEZEFLOW_CORS_ALLOWED_ORIGINS` at that instead.

**5. Give the other person access.** Have them install the Tailscale app
and log in to an account on your tailnet - to limit what they can see,
share just this one machine with them via the Tailscale admin console's
"Share" feature rather than adding them as a full tailnet member. Send
them the `https://<server-name>.<tailnet>.ts.net` address; that's the
whole app, reachable from anywhere with internet, on any device with
Tailscale installed.

**6. Back up `./data` off the server.** A nightly cron job that stops the
backend, tars `./data`, and restarts it keeps backups consistent:

```cron
0 3 * * * cd /opt/freezeflow && docker compose stop backend && tar czf /root/backups/freezeflow-$(date +\%F).tar.gz data && docker compose start backend
```

Periodically `scp` those tarballs off the server - a backup that only
lives on the same VPS it's backing up isn't a real backup.

**7. It survives reboots.** `docker-compose.yml` already sets
`restart: unless-stopped` on both services; `vps-setup.sh` enables Docker
itself to start on boot, and Tailscale's installer does the same for its
own service.

## What's in the stack

- **`backend`** - a multi-stage `backend/Dockerfile` image. On start, it
  runs `alembic upgrade head` against whatever `FREEZEFLOW_DATABASE_URL`
  points at, then starts `uvicorn`. It exposes an
  `http://localhost:8000/api/v1/health` endpoint that `docker-compose.yml`
  uses as a healthcheck.
- **`frontend`** - a multi-stage `frontend/Dockerfile` image. The first
  stage runs `npm run build`; the second serves the static output through
  `nginx:alpine` (config in `frontend/nginx.conf`). `frontend` declares
  `depends_on: backend: condition: service_healthy`, so Compose won't start
  it until the backend's healthcheck passes - the fix for `docker compose
  up` racing the frontend against a backend that isn't ready yet.

## Environment variables

Copy `.env.example` to `.env` before the first run - `docker-compose.yml`
loads it into the backend container, and Compose errors if it's missing
even when every value is left blank.

| Variable | Purpose |
| --- | --- |
| `FREEZEFLOW_ENVIRONMENT` | `production` disables the `/dev/*` developer-tools routes (demo-data seeding, database reset) meant only for local development. |
| `FREEZEFLOW_CORS_ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the API. Set this to wherever the frontend is actually reachable. |
| `FREEZEFLOW_SMTP_HOST`, `FREEZEFLOW_SMTP_PORT`, `FREEZEFLOW_SMTP_USERNAME`, `FREEZEFLOW_SMTP_PASSWORD`, `FREEZEFLOW_SMTP_FROM_ADDRESS`, `FREEZEFLOW_FEEDBACK_NOTIFY_EMAIL` | Optional Feedback notification email (ADR-0020). Leave blank and Feedback submissions are still accepted, just not emailed to anyone. |
| `FRONTEND_PORT` | Host port the frontend is published on (default `8080`). Compose-only; not read by the backend. |

`FREEZEFLOW_DATABASE_URL` and `FREEZEFLOW_FEEDBACK_UPLOAD_DIR` are set
directly in `docker-compose.yml`, not `.env` - they're internal container
paths (`/data/...`), not something a deployment needs to tune day to day.

## Data and backups

The backend container mounts `./data` (next to `docker-compose.yml`) to
`/data`, which holds:

- `freezeflow.db` - the SQLite database (default backend)
- `uploads/feedback/` - Feedback attachments (ADR-0020)

Back up the whole `./data` directory - it's the entire persistent state of
a SQLite-backed deployment. Since SQLite is a single file, a plain copy of
`./data` while the stack isn't mid-write is a valid backup; stop the stack
first (`docker compose stop backend`) for a guaranteed-consistent copy.

## Using Postgres instead of SQLite

The default is SQLite (see ADR-0021 for why). To use Postgres instead:

1. Add a `postgres` service to `docker-compose.yml` (image
   `postgres:16-alpine` or similar) with its own persistent volume.
2. Change the `backend` service's `FREEZEFLOW_DATABASE_URL` to point at it,
   e.g. `postgresql+psycopg://freezeflow:<password>@postgres:5432/freezeflow`.
3. Install the optional Postgres driver when building the backend image:
   `psycopg[binary]` is available as the `postgres` extra in
   `backend/pyproject.toml` (`uv sync --extra postgres`) - add
   `--extra postgres` to the `uv sync` line in `backend/Dockerfile`.

Nothing else needs to change: `backend/app/database/session.py` only passes
its one SQLite-specific connection argument when the URL's dialect is
SQLite, and `alembic upgrade head` (already run on every container start)
works against either database.

## Alembic migrations on a fresh deploy

`backend/Dockerfile`'s `CMD` always runs `alembic upgrade head` before
starting `uvicorn`, so a brand-new deployment (empty database) and an
existing one being upgraded both end up on the current schema
automatically - there's no separate migration step to remember.

## Running two isolated instances

The user's own future plan (see ADR-0021) is two separate deployments: a
real instance for day-to-day use, and a separate public demo linked from a
personal site, with neither able to see or affect the other's data. Nothing
in this milestone stands that up, but the pieces it adds are what make it
possible later without changing the app itself:

- Each instance is its own `docker compose` project, with its own `.env`
  (its own `FREEZEFLOW_CORS_ALLOWED_ORIGINS` pointed at its own frontend
  origin) and its own `./data` directory - there is no shared state between
  two instances run this way.
- A demo instance's own demo-data lifecycle (seeding, periodic reset) is a
  separate, not-yet-designed feature - it isn't part of what's described
  here.
