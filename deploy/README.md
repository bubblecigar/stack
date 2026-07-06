# Vultr deployment

This deploys:

- Expo web static files to nginx
- `server/authserver.mjs` as `stack-auth.service`
- `server/apiserver.mjs` as `stack-api.service`
- SQLite data under `/var/lib/stack` by default

The server uses Node's built-in `node:sqlite`, so the host must run a recent Node 22+ build that includes it.

## One-time host setup

Create an Ubuntu Vultr instance, point your DNS record to it if you have a domain, then install nginx/rsync if needed:

```sh
VULTR_HOST=your.server.ip INSTALL_DEPS=1 npm run deploy:vultr
```

The deploy script also loads local values from `.env`. Keep that file untracked:

```sh
VULTR_HOST=your.server.ip
VULTR_USER=root
VULTR_PASSWORD=your-root-password
```

If `VULTR_PASSWORD` is set and `sshpass` is installed locally, deploy can use password auth non-interactively. Without `sshpass`, SSH will prompt normally or use your SSH key.

If Node is not already installed on the host, install Node 22+ first. For example, use your preferred NodeSource, fnm, nvm, or distro package setup, then make sure `/usr/bin/node` points to that Node. If it does not, pass `NODE_BIN=/path/to/node`.

## Deploy

With an IP-only server:

```sh
VULTR_HOST=your.server.ip npm run deploy:vultr
```

If the instance already has Caddy occupying port 80/443 for other apps, keep Caddy as the public router and put this app's nginx on an internal port:

```sh
NGINX_HTTP_PORT=8080 APP_DOMAIN=stack.example.com PUBLIC_ORIGIN=https://stack.example.com npm run deploy:vultr
```

Then add a Caddy route for the app:

```caddyfile
stack.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

Do not use `DISABLE_CADDY=1` on a shared instance unless you intentionally want to remove Caddy from serving the other apps.

With a domain:

```sh
VULTR_HOST=your.server.ip APP_DOMAIN=stack.example.com PUBLIC_ORIGIN=https://stack.example.com npm run deploy:vultr
```

The deploy script builds Expo web with:

```sh
EXPO_PUBLIC_AUTH_SERVER_URL=$PUBLIC_ORIGIN
EXPO_PUBLIC_API_SERVER_URL=$PUBLIC_ORIGIN
```

nginx proxies `/auth/*` to the auth server and `/api/*` to the API server, so the client can use the same public origin for both.

## HTTPS and PWA

For a PWA, serve it over HTTPS. After DNS is pointed at the Vultr instance, install a certificate:

```sh
ssh root@your.server.ip
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d stack.example.com
```

To make the Expo web build installable as a PWA, add:

- a web app manifest, served as `/manifest.webmanifest`
- `<link rel="manifest" href="/manifest.webmanifest">` in the exported HTML path
- a service worker if you want offline caching

For this app, start with HTTPS + manifest first. Add service-worker caching later, after the API sync behavior is stable.
