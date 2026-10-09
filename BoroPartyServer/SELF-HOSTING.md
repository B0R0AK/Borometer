# Hosting a party server yourself

A party in Borometer can run from one player's PC. A small server of your own
keeps the party code working when that player goes offline. This guide works on
any Linux server; it names no provider.

Placeholders stand in angle brackets: `<your-server>` is your server's address or
name, `<user>` your login on it, `<your-domain>` an optional domain name.

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
  service file, e.g. `Environment=BORO_PARTY_PORT=8800`).

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

Open port `8732/tcp` to the outside. Many providers have a firewall of their own in
front of the server: open the port **there**, and, if the server runs `ufw`, also
on the server:

    sudo ufw allow 8732/tcp

Do not lock yourself out: keep SSH (port 22, or the one you use) open before you
turn a firewall on.

## 5. Plain HTTP only

Borometer speaks only plain HTTP to the party server; it does not speak HTTPS.
What travels (numbers and character names) is not secret, but it travels
unencrypted. A reverse proxy with HTTPS (such as Caddy) adds no protection today:
Borometer would still send its first request, with its content, in plain text,
and only the proxy's redirect would lead to HTTPS. That changes only once
Borometer itself speaks HTTPS, which it does not today.

If you want a name instead of an IP, a DNS record for `<your-domain>` pointing at
the server is enough; enter it with the port, `<your-domain>:8732`.

## 6. Connect Borometer

In the app, on the *Party* tab under *Party server*, enter the address into
**Server address**: `<your-server>:8732`, for example `203.0.113.5:8732`, or
`<your-domain>:8732` with a name from step 5. Press **Save**, then **Check now**.
Everyone in the clan enters the same address once.

## 7. Update

Copy the new `boro_server.py` over as in step 3, move it to `/opt/boro-party/`, then:

    sudo systemctl restart boro-party
    systemctl is-active boro-party

The answer should be `active`. A restart empties the rooms; tell the clan to start
a new party.

## 8. Security notes

`boro-party.service` runs the server with `DynamicUser=yes` (a throwaway user with
no rights), `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes` and
`NoNewPrivileges=yes`. The server needs none of what these take away. Do not
loosen them, and do not run it as root.

The server also limits what a stranger who finds the port can do: a request body
over 256 kB is refused with 413 before it is read, a connection that sends nothing
for 10 seconds is closed, and a room holds at most 40 names. A real party never
gets near any of these. If you run an older `boro_server.py`, update it (step 7)
to get them.
