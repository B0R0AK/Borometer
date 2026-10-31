# Hosting a party server yourself

A party in Borometer can run from one player's PC. A small server of your own
keeps the party code working when that player goes offline. This guide works on
any Linux server; it names no provider.

Placeholders stand in angle brackets: `<your-server>` is your server's address or
name, `<user>` your login on it, `<your-domain>` the name the server gets for HTTPS
(for example `party.example.com`) and `<server-ip>` its public IPv4 address (for
example `203.0.113.5`).

## 1. What it is

`boro_server.py` is a single Python file with nothing beyond the standard library.

It knows only the party code and what the Borometers push to it: each player's
character name and the two weapons of the build; for their latest fight the target,
start time and length, damage, DPS, hits, the crit and heavy figures and the biggest
hit; and for up to twelve skills their names with the same figures, split by hit
type, and the times of their casts. With the fight comes a damage curve per second:
the total, one lane per skill, and one more lane for all other skills. It never
reads a combat log, never touches the game, and talks to nothing except the
Borometers that push to it.

Rooms live in memory only; nothing is written to disk. A room nobody reports to is
dropped after 30 minutes (`EMPTY_ROOM_GRACE` in `boro_server.py`). A restart empties
every room; the players simply start a new party.

## 2. Requirements

- any Linux server with Python 3 and systemd;
- one open TCP port, by default `8732` (to change it, set `BORO_PARTY_PORT` in the
  service file, e.g. `Environment=BORO_PARTY_PORT=8800`);
- for HTTPS (step 5): a domain name pointing at the server, and ports `80` and
  `443` open.

## 3. Install

On the server, make the folder:

    sudo mkdir -p /opt/boro-party

From your own computer, in this folder, copy the two files over:

    scp boro_server.py boro-party.service <user>@<your-server>:/tmp/

On the server, move them into place and start the service:

    sudo mv /tmp/boro_server.py /opt/boro-party/
    sudo mv /tmp/boro-party.service /etc/systemd/system/
    sudo systemctl daemon-reload && sudo systemctl enable --now boro-party

Check that it answers:

    curl http://127.0.0.1:8732/health

`enable --now` also starts it again after every reboot.

## 4. Firewall

If your provider has a firewall in front of the server (many do, in their web
console), open the ports **there**; and on the server too, if it
runs `ufw`:

    sudo ufw allow 8732/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp

- `8732` is the plain-HTTP port. Older Borometer versions speak only to it. Keep it
  open until everyone in the clan has the version that speaks HTTPS, then close it
  (step 5.5).
- `80` and `443` are for HTTPS (step 5). The certificate is fetched over one of
  them, so at least one must be open to the whole internet, not only to the clan.

Do not lock yourself out: keep SSH (port 22, or the one you use) open before you
turn a firewall on.

## 5. HTTPS (recommended)

When the address starts with `https://`, Borometer speaks HTTPS to the party
server. It checks the certificate the normal way and never skips that check: a
server with an expired, self-signed or wrong-name certificate is refused. A plain
`host:8732` address still works, and the app then says that the connection is not
encrypted. What travels (character names, the party code, fight numbers) is not
a secret, but there is no reason to send it in plain text.

The server itself stays as it is, on port 8732. A reverse proxy in front takes the
HTTPS connection on port 443, holds the certificate and passes the request on to
`127.0.0.1:8732`. Nothing in `boro_server.py` changes.

### 5.1 DNS

The name `<your-domain>` has to lead to your server before a certificate can be
issued for it.

1. At your DNS provider (often the one you bought the domain from) open the zone
   of your domain; create it if it is not there yet. The domain's name servers
   must be the ones that zone belongs to (registrar settings).
2. In the zone add a record: type **A**, the name part (for `party.example.com` in
   the zone `example.com`: `party`), value `<server-ip>`. TTL 300 is fine.
3. Check from your own computer:

       nslookup <your-domain>

   The answer must list `<server-ip>`. "Non-existent domain" means the zone or the
   record is not there yet, or has not spread; that can take from a few minutes up
   to a few hours (longer mostly when the name servers of a new domain were only
   just set). Do not go on to 5.3 before the answer is right.

### 5.2 Caddy (reverse proxy with a certificate that renews itself)

Caddy fetches a certificate from Let's Encrypt by itself and renews it before it
runs out; there is nothing to schedule. On Debian or Ubuntu, as in Caddy's own
instructions (caddyserver.com/docs/install):

    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update && sudo apt install -y caddy

Replace the whole content of `/etc/caddy/Caddyfile` with:

    <your-domain> {
        reverse_proxy 127.0.0.1:8732
    }

(with your name, for example `party.example.com {`).

Then load it:

    sudo systemctl reload caddy
    systemctl is-active caddy

### 5.3 Check

    curl https://<your-domain>/health

The answer is `{"ok": true, "rooms": 0}` (the number of rooms may differ). The very
first call can take a few seconds while the certificate is issued.

In Borometer: *Settings* › *Party and server*, enter `https://<your-domain>`
(no port), **Save**, **Check now**.

### 5.4 If something goes wrong

- **`nslookup` does not show `<server-ip>`**: DNS has not arrived (5.1). Wait, and
  check the zone and the A record. Caddy cannot get a certificate before.
- **`curl` hangs or says "connection timed out"**: ports 80 and 443 are not open.
  Look at the provider firewall *and* `ufw` (step 4). Test from outside the
  server, not from the server itself.
- **`curl` reports a certificate or SSL error, or "connection reset"**: Caddy has
  no certificate (yet). Read why:

      sudo journalctl -u caddy -n 50 --no-pager

  Typical lines: the name does not resolve (DNS), the validation could not reach
  port 80 or 443 (firewall), or too many attempts (Let's Encrypt makes you wait
  after repeated failures; fix the cause, then wait an hour).
- **Caddy does not start**: another program already uses port 80 or 443 (an old web
  server). `sudo ss -ltnp | grep -E ':(80|443) '` shows which.
- **`502 Bad Gateway`**: Caddy works, `boro-party` does not.
  `systemctl is-active boro-party` and `curl http://127.0.0.1:8732/health` on the
  server.
- **`curl` works but Borometer says it cannot reach the server**: the address in
  the app must start with `https://` and carry no port.

### 5.5 Close the old port

The party server also answers on `8732` from outside, in plain text. Keep that
until every member of the clan has the Borometer version that speaks HTTPS and has
entered the `https://` address. Then remove the rule (`sudo ufw delete allow
8732/tcp`, and in the provider firewall). Caddy reaches the server on `127.0.0.1`,
which needs no rule. Check from outside afterwards:

    curl -m 5 http://<server-ip>:8732/health

must now time out, and `curl https://<your-domain>/health` must still answer.

### 5.6 What was and was not tested

The Borometer side (HTTPS with a checked certificate, no redirects; expired,
wrong-name and self-signed certificates refused) is covered by `npm run
test:https-party-core`, against a local server with test certificates.

The Caddy steps above come from Caddy's documentation and were **not run** by the
author of this change: not the installation, not the Caddyfile, not the issue of a
certificate for a real name. If a step behaves differently on your server,
trust its output over this text.

### 5.7 Second way: a certificate for the IP address

Since 15 January 2026 Let's Encrypt can issue certificates for an IP address
instead of a name, valid for only 160 hours (about 6.5 days). Then no domain is
needed and the app is given `https://<server-ip>`. The price: the certificate has to
renew itself every few days without a gap, and a client that finds it expired
refuses the connection. It needs an ACME client that supports IP addresses and the
short-lived profile; whether the installed Caddy does has to be read in its
documentation for your version. This way was **not tried** either. The name in
5.1 to 5.3 is the simpler path and the one this guide recommends.

## 6. Connect Borometer

In the app, under *Settings* › *Party and server*, enter the address into **Server
address**: `https://<your-domain>` for HTTPS (step 5), or `<your-server>:8732`,
for example `203.0.113.5:8732`, for plain HTTP (the app then warns that the
connection is not encrypted). Press **Save**, then **Check now**. Everyone in the
clan enters the same address once.

## 7. Update

Copy the new `boro_server.py` and `boro_gilde.py` over as in step 3, move them to `/opt/boro-party/`, then:

    sudo systemctl restart boro-party
    systemctl is-active boro-party

The answer should be `active`. A restart empties the rooms; tell the clan to start
a new party. Guilds (section 9) are on disk and survive it.

## 8. Security notes

`boro-party.service` runs the server with `DynamicUser=yes` (a throwaway user with
no rights), `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes` and
`NoNewPrivileges=yes`. The server needs none of what these take away. Do not
loosen them, and do not run it as root.

The server also limits what a stranger who finds the port can do: a request body
over 256 kB is refused with 413 before it is read, a connection that sends nothing
for 10 seconds is closed, and a room holds at most 40 names. A real party never
gets near any of these. If you run an older `boro_server.py`, update it (step 7)
to get them. More limits, for a server open to everyone, are in 8.1.

### 8.1 Limits, and running a server for strangers

Every limit is an environment variable of `boro_server.py`. The defaults are far
above what a clan needs, so a private server behaves as it always did. A server
open to everyone sets lower ones in its service file.

| Variable | Default | Example for a public server | What it limits |
|---|---|---|---|
| `BORO_MAX_ROOMS` | 5000 | 500 | rooms at once; beyond it a new room is answered `503 server full` |
| `BORO_MAX_MEMBERS_TOTAL` | 20000 | 3000 | names in all rooms together |
| `BORO_MAX_BYTES` | 1073741824 | 100663296 | stored reports in all rooms together (the size of what members pushed) |
| `BORO_RATE_IP` | 600 | 180 | requests per sender per minute (`429 slow down`) |
| `BORO_CREATE_IP` | 50 | 10 | new rooms per sender per hour |
| `BORO_MISS_IP` | 60 | 20 | different unknown codes per sender per minute, then a pause (`BORO_MISS_PAUSE`, seconds, default 300); guessing codes gets nowhere |
| `BORO_CONN_MAX` | 1000 | 256 | connections at once (`503 busy` with `Retry-After`, no thread spent) |
| `BORO_CONN_IP` | 200 | 16 | requests of one sender in progress at once |
| `BORO_LIMIT_TABLE_MAX` | 50000 | 20000 | senders each counting table holds (a memory bound); past it, new senders get `503 busy` and those already counted keep counting |
| `BORO_ROOM_MAX_AGE` | 0 (off) | 43200 | seconds a room may live at most, however busy |
| `BORO_PARTY_HOST` | `0.0.0.0` | `127.0.0.1` | the address it listens on |
| `BORO_GILDE` | 1 | 0 | `0` serves no `/gilde/` route at all and makes no guild folder |
| `BORO_PROFIL` | empty | `oeffentlich` | named in `/health`, so a load test can tell it is the right server |

A sender is the address your reverse proxy reports in `X-Forwarded-For`; the
server believes that header only from the proxy's own address (`BORO_TRUSTED_PROXY`,
default `127.0.0.1`). So for a public server: let it listen on `127.0.0.1` only, have
the proxy set the header to the real address (in Caddy: `header_up X-Forwarded-For {remote_host}`),
and keep no access log (or one without addresses). An IPv6 sender is counted as a
whole /64. Nothing here is written anywhere: the counters live in memory and are
dropped after their window.

`/health` reports `rooms`, `members` and `bytes` (what is stored), `absender`
(entries in the counting table), `anfragen` and `verbindungen` (what is being
served now), `speicherKB` (the peak memory of the process) and `last1`
(load average), and `profil` when set. The memory and CPU of the service itself
are best capped by systemd (`MemoryMax`, `CPUQuota`, `TasksMax`).

**What to tell the people who use it** (one sentence): *The party server only
knows the party code, your character name and your meter's numbers; they live in
memory only, nothing is written to disk, a room is gone 30 minutes after it
empties (and after 12 hours at the latest, on a server that sets
`BORO_ROOM_MAX_AGE`).* That sentence is about the party; the guild store of the
same file does write its files to disk, which is why a public server turns it off
with `BORO_GILDE=0`.

### 8.2 The server the project runs for everyone

The project runs one such server at `https://guest.borometer.de`, as a second
instance of this same file next to the one for its own guild. It uses the values
in the "Example for a public server" column of the table above, has no guild store
and writes nothing to disk. Rooms live in memory only, for 12 hours at the longest,
and a restart of the server empties all of them. Its service file also caps the
memory, CPU and number of tasks of the instance, so a rush there cannot take the
rest of the machine down with it.

It is a courtesy, not a promise. It can be switched off at any time; the address
then answers `503` with one sentence, the certificate stays, and Borometer shows
that nothing is answering. A party that matters should run on your own server or on
the host's PC.

## 9. Guild online (optional)

`boro_gilde.py` lets a guild leader keep the member list, the points and the
attendance on this server instead of on their own PC (Borometer: Guild, "Guild
online"). Unlike the party board this **is stored on disk**, and it holds the
names, weapons, points and attendance that the leader typed in. Whoever runs the
server can read them. Tell the guild before you run it for them, and answer a
member's request to be taken out by asking the leader to remove them; the earlier
states are kept in the history, not deleted.

- **Use https only.** Borometer refuses an address that does not start with
  `https://`. Set up Caddy as in section 5; `/gilde/*` goes through the same
  `reverse_proxy 127.0.0.1:8732`. Caddy's default access log does not write request
  headers, which is where the guild code and keys travel; do not turn that on.
- **Where it lives.** `/var/lib/boro-party/gilden` (set by `boro-party.service`
  through `StateDirectory` and `BORO_GILDE_DIR`). One folder per guild, one file
  per state. Nothing is deleted: restoring an earlier state writes a new one, old
  files move to `archiv/`, a closed guild only gets a flag.
- **Back it up.** A daily copy, kept for 14 days, for example as a systemd timer or
  a cron job running
  `tar -czf /var/backups/boro-gilden-$(date +%F).tgz -C /var/lib/private boro-party`
  (`DynamicUser` keeps the folder under `/var/lib/private`). Removing old copies is
  yours to do, the server never deletes anything. A leader can also save a backup
  file from Borometer itself.
- **Limits** (environment variables of the service, defaults in brackets):
  `BORO_GILDE_MAX` guilds per server [50]; `BORO_TRUSTED_PROXY` the address whose
  `X-Forwarded-For` is believed [127.0.0.1]. Built in: a state of at most 2.25 MiB,
  other requests 4 KiB, 30 links per guild, 20 writes a minute per guild, 5 new
  guilds an hour per address, 10 wrong codes or keys a minute and then a pause.
