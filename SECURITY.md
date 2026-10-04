# Security

Borometer reads the combat log Throne and Liberty writes, and nothing else
([what the audit checks](README.md#what-the-audit-checks)). If you find a way it could
do more, such as touching the game, reaching the network from the page, reading or
writing outside its own files, or letting another program or website drive it,
please report it privately:

**[Report a vulnerability](https://github.com/B0R0AK/Borometer/security/advisories/new)**
(GitHub's private reporting; only the maintainer sees it).

Please do not open a public issue for it. Include the version, what you did, and what
happened. Do not attach combat logs with character names.

In scope: the app (main process, the local server on 127.0.0.1, the page), the party
server in `BoroPartyServer/`, the build and release workflow. Out of scope: the game
itself, Questlog, GitHub.

Deutsch: Sicherheitslücken bitte nicht als Issue, sondern über den Link oben melden.
