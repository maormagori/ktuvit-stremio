# Ktuvit Stremio Addon
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/maormagori/ktuvit-stremio/beamup-deployment.yml?style=for-the-badge)
[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/maormagori)


This is an unofficial [Stremio](http://strem.io/) addon for [ktuvit.me](https://ktuvit.me/), previously known as Screwzira.
It allows you to add Hebrew subtitles from Ktuvit to media streamed by Stremio. I have a similar addon for [Wizdom.xyz subtitles](https://github.com/maormagori/wizdom-stremio-v2) if you're interested.

**DISCLAIMER**: I am not affiliated with nor a part of Ktuvit.me. Any problems, issues, and attacks on the service or the content they provide should be addressed to them.

## Installation
The addon is available in the community addons section in Stremio. Search for "Ktuvit.me Subtitles" and press on install.

Alternatively, you can install the addon directly from here:
https://4b139a4b7f94-ktuvit-stremio.baby-beamup.club/

## Run locally with Docker

If the public addon is unavailable, you can run your own instance with Docker
and Docker Compose. This does not restore the public service; your instance
still needs working Ktuvit authentication and access to Ktuvit.

```bash
git clone https://github.com/maormagori/ktuvit-stremio.git
cd ktuvit-stremio
cp .env.example .env
```

Edit `.env` with your own Ktuvit email and hashed password. See the
[Ktuvit credentials guide](https://github.com/XBMCil/service.subtitles.ktuvit/blob/master/README.md)
for obtaining the hash. Keep these credentials locally: `.env` is ignored by
Git and excluded from the Docker image. Never commit or share it.

```bash
docker compose up --build -d
docker compose logs -f addon
```

After the logs show `Started addon on: http://localhost:3000`, open
`http://localhost:3000/manifest.json` to check the manifest. In Stremio desktop
on the same computer, paste that URL into the addon search/install field and
install it. The default `ADDON_HOSTNAME=localhost` is suitable for this setup.

For a TV or another device on your LAN without an HTTPS proxy, change the port
mapping in `compose.yaml` to `3000:3000` and set `ADDON_HOSTNAME` in `.env` to the Docker
host's LAN IP or a hostname that the device can resolve, for example
`ADDON_HOSTNAME=192.168.1.50`. Use only the hostname or IP, without `http://` or a
port. Apply changes with `docker compose up -d`, then install using
`http://192.168.1.50:3000/manifest.json` on that device. The hostname is also
used in returned subtitle URLs, so it must be reachable from every client;
`localhost` on a TV refers to the TV itself.

Compose publishes port 3000 only on the host's loopback interface by default.
If that port is already in use, set `ADDON_BIND_PORT` in `.env` to a free port
and point your HTTPS proxy at that port; the container still uses port 3000.
For direct HTTP access on a different host port, also set `PUBLIC_URL` to the
client-facing URL, for example `http://localhost:3012`, so subtitle links use
the same port as the manifest.
Changing it to `3000:3000` exposes the addon on all host interfaces. Allow port
3000 through your firewall only on your trusted LAN and do not forward it from
your router. This addon has no client authentication.

This setup serves plain HTTP. Stremio desktop is the intended local client;
Stremio Web and some TV clients may reject HTTP addons or local addresses.
Those clients may require a reachable HTTPS deployment. Merely changing the
manifest URL to HTTPS does not enable TLS in this container.

For an always-on Raspberry Pi, use a 64-bit OS such as ARM64 Kali Linux. The
Node 22 image supports ARM64 and Docker selects the architecture automatically.
Compose restarts the addon after a reboot when the Docker service starts.

With Tailscale Serve on the Pi, keep the loopback port mapping. Check whether
Serve already hosts anything before configuring it:

```bash
tailscale serve status
```

If an existing service is configured, preserve it and arrange a separate
endpoint before continuing. If no service is configured, enable the background
HTTPS proxy:

```bash
sudo tailscale serve --bg 3000
tailscale serve status
```

Set `PUBLIC_URL` in `.env` to the full HTTPS origin reported by Serve, using the
Pi's full `.ts.net` name, for example
`PUBLIC_URL=https://your-pi.your-tailnet.ts.net`. Apply the change with
`docker compose up -d` and install using that origin plus `/manifest.json`.
This setting also makes subtitle URLs use HTTPS without the internal port 3000.
Each Stremio device must be able to reach the proxy; Tailscale Serve requires
tailnet access on the TV or its network. The HTTP container itself does not
provide TLS.

To allow TVs to connect without Tailscale, you can instead publish the proxy
with [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel):

```bash
sudo tailscale funnel --bg 3000
tailscale funnel status
```

Use the HTTPS origin reported by Funnel as `PUBLIC_URL`. If you changed
`ADDON_BIND_PORT`, replace `3000` in the proxy command with that host port.
Funnel makes the addon publicly accessible: anyone with the URL can request
subtitles through your configured Ktuvit account. Preserve any existing
Serve/Funnel endpoints when configuring a shared host.

The container runs Node 22 as a non-root user. Compose explicitly sets
`NODE_ENV=development` to use local HTTP configuration and keeps `PORT=3000`
so advertised subtitle URLs match the published port. Leave those values in
place for this setup. Stop the addon with `docker compose down`.

## Development

Before trying to dive deep into the addon, get familiar with [Stremio's Addon Protocol](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md). Otherwise, things wouldn't make much sense.

This addon is an [express](https://github.com/expressjs/express) server running on Node 22 with NPM installed.

To get started, run these commands:
```bash
git clone https://github.com/maormagori/ktuvit-stremio.git
cd ktuvit-stremio
npm install
```

Before running the addon itself you'll have to set some environment variables so either export the required variables or create a `.env` file containing these variables:

```
KTUVIT_USER_EMAIL=your.ktuvit.user.email.address
KTUVIT_USER_HASHED_PASSWORD=your.ktuvit.user.hashed.password
```
Ktuvit hashes your password and uses it for authentication. This is required to make calls to Ktuvit.
If you're wondering what's your Ktuvit user's hashed password, CaTzil created a [guide](https://github.com/XBMCil/service.subtitles.ktuvit/blob/master/README.md) explaining how to get it.

After setting the variables you can run:
```bash
npm run start

# Alternatively with nodemon
npm run devStart
```

and the addon will be available on: `http://localhost:3000/`

#### Additional environment variables

You can also add these env variables to alter the way the addon behaves:
```bash
AUTHOR_EMAIL  # The email displayed in the addon's manifest
PORT   # The port the addon listens on. defaults to 3000
ADDON_HOSTNAME   # Hostname/IP advertised in subtitle URLs, without scheme or port. defaults to localhost outside production
PUBLIC_URL   # Optional external origin for subtitle URLs behind a reverse proxy, e.g. https://your-pi.your-tailnet.ts.net
LOG_LEVEL   # The minimum winston level to log. defaults to http
SUBS_CACHE_MAX_ENTRIES    # How many titles to keep cached. defaults to 500
SUBS_CACHE_FOUND_TTL_MS   # How long to keep a subtitles list. defaults to 3600000 (1 hour)
SUBS_CACHE_EMPTY_TTL_MS   # How long to keep an empty result. defaults to 300000 (5 minutes)
```

#### Logging

Requests are logged by [morgan](https://github.com/expressjs/morgan) at the `http`
level, and every call to the Ktuvit manager logs its arguments at the `info` level.
Response bodies are never logged, so a subtitle request shows up as the request
itself plus its status, never the contents of the SRT file.

`LOG_LEVEL` controls how much of this you see:

| `LOG_LEVEL` | What you get |
| --- | --- |
| `info` | Ktuvit calls and errors, no request logs |
| `http` (default) | The above, plus a line per request |
| `debug` | The above, plus the results of each Ktuvit call and every cache hit and miss |

#### Upstream availability

The HTTP server starts independently of Ktuvit authentication, so the landing
page and manifest remain available when credentials are missing or Ktuvit is
unreachable. A working manifest confirms HTTP availability, not that subtitle
lookups can currently succeed.

Authentication requests have a 10-second deadline. Concurrent requests share
one login attempt; after a failed attempt, another request can retry after a
30-second cooldown. Requests requiring unavailable authentication return HTTP
503 with `Cache-Control: no-store` and `Retry-After`. Explicit upstream 401/403
responses invalidate the session so a later request can log in again.

Failed title lookups, subtitle-list requests, and downloads return non-cacheable
HTTP 502 responses rather than successful empty results or invalid subtitle
files. Successful lookups with no subtitles still return an empty list.

These safeguards address known failure modes. They do not establish why any
particular public deployment is unavailable, or recognize every possible
authentication error returned by Ktuvit inside an HTTP 200 response.

#### Caching

Stremio appends the video's filename, hash and size to every subtitles request,
so no two viewers of the same episode send the same URL and route based caching
never helps. The addon therefore caches subtitles lists itself, keyed on the
title rather than the URL: every release of one episode shares a single entry
and each request is still sorted against its own filename.

An empty result is kept only briefly, since it usually means the subtitles are
not up yet rather than that the title will never have any. Failed requests are
never cached. The cache is per process, so it starts empty after a restart.

Because a cached list never reaches Ktuvit, the `info` line for a subs lookup
appears only on a miss. Set `LOG_LEVEL=debug` to see hits as well.
# Contributing
PRs are more than welcome!
Take a look at the currently open [issues](https://github.com/maormagori/ktuvit-stremio/issues) to see where you can help. If you're experiencing issues with the addon, be sure to open an issue.

This addon relies on a wrapper I wrote for Ktuvit which also needs some attention so if you can't find a way to help here, take a look at the [Ktuvit API repo](https://github.com/maormagori/Ktuvit-api).

# Supporting

Hey, if you're already here, consider starring this repository on Github 🌟

If you really want to show support, I have a [Buy Me Coffee](https://www.buymeacoffee.com/maormagori) page where you can drop a few shekels (Kidding, they only accept USD 😠).

And it's always a great ego booster to hear some positive feedback so just reach out.

# License
[MIT](https://github.com/maormagori/ktuvit-stremio/blob/main/LICENSE)
