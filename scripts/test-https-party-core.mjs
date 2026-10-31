// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Gruppenserver ueber HTTPS (#231): serverBase/serverAddress/isPlain in
// src/main/http.ts und fetchJson gegen einen lokalen HTTPS-Server. Die
// Testzertifikate entstehen in jedem Lauf neu, mit node:crypto und einer
// kleinen DER-Schreibweise unten, in einem Ordner unter os.tmpdir() - kein
// Schluessel liegt im Repo. Gueltig mit eigener Kette (NODE_EXTRA_CA_CERTS gilt
// nur fuer den Kindprozess dieses Tests); abgelaufen, falscher Name und selbst
// signiert ohne Vertrauen muessen scheitern. Die Pruefung des Zertifikats wird
// nirgends abgeschaltet. Keine Anfrage verlaesst den Rechner.
//
// Run:  npm run test:https-party-core

import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---- X.509 in DER, nur so viel, wie ein Testzertifikat braucht ---- */
const len = (n) => n < 128 ? Buffer.from([n]) : (() => { const b = []; while (n) { b.unshift(n & 255); n >>= 8; } return Buffer.from([0x80 | b.length, ...b]); })();
const tlv = (tag, ...teile) => { const inhalt = Buffer.concat(teile); return Buffer.concat([Buffer.from([tag]), len(inhalt.length), inhalt]); };
const seq = (...t) => tlv(0x30, ...t);
// die Kennung als Zahlenliste, nicht als Punkt-Text (der Export liest a.b.c.d als IP-Adresse)
const oid = (n) => { const out = [40 * n[0] + n[1]];
  for (const v of n.slice(2)) { const b = [v & 127]; let x = v >> 7; while (x) { b.unshift((x & 127) | 128); x >>= 7; } out.push(...b); }
  return tlv(0x06, Buffer.from(out)); };
const ganz = (buf) => tlv(0x02, buf[0] & 0x80 ? Buffer.concat([Buffer.from([0]), buf]) : buf);
const zeit = (d) => { const z = d.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z";
  return d.getUTCFullYear() < 2050 ? tlv(0x17, Buffer.from(z.slice(2))) : tlv(0x18, Buffer.from(z)); };
const name = (cn) => seq(tlv(0x31, seq(oid([2, 5, 4, 3]), tlv(0x0c, Buffer.from(cn)))));
const ext = (id, kritisch, wert) => seq(oid(id), ...(kritisch ? [tlv(0x01, Buffer.from([0xff]))] : []), tlv(0x04, wert));
const ECDSA_SHA256 = seq(oid([1, 2, 840, 10045, 4, 3, 2]));
const pem = (der) => "-----BEGIN CERTIFICATE-----\n" + der.toString("base64").match(/.{1,64}/g).join("\n") + "\n-----END CERTIFICATE-----\n";
/** Ein Zertifikat: cn, Aussteller (cn und Schluessel; ohne = selbst), von/bis, ca, san (IP oder DNS-Name). */
function zertifikat({ cn, aussteller, von, bis, ca = false, san }) {
  const paar = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const exts = [ext([2, 5, 29, 19], true, ca ? seq(tlv(0x01, Buffer.from([0xff]))) : seq()),
    ext([2, 5, 29, 15], true, ca ? tlv(0x03, Buffer.from([1, 0x06])) : tlv(0x03, Buffer.from([7, 0x80])))];
  if (san) exts.push(ext([2, 5, 29, 17], false, seq(/^\d+\.\d+\.\d+\.\d+$/.test(san)
    ? tlv(0x87, Buffer.from(san.split(".").map(Number))) : tlv(0x82, Buffer.from(san)))));
  if (!ca) exts.push(ext([2, 5, 29, 37], false, seq(oid([1, 3, 6, 1, 5, 5, 7, 3, 1]))));
  const tbs = seq(tlv(0xa0, ganz(Buffer.from([2]))), ganz(randomBytes(8)), ECDSA_SHA256, name(aussteller?.cn ?? cn),
    seq(zeit(von), zeit(bis)), name(cn), paar.publicKey.export({ type: "spki", format: "der" }), tlv(0xa3, seq(...exts)));
  const sig = sign("sha256", tbs, aussteller?.key ?? paar.privateKey);
  return { cn, key: paar.privateKey, keyPem: paar.privateKey.export({ type: "pkcs8", format: "pem" }),
    certPem: pem(seq(tbs, ECDSA_SHA256, tlv(0x03, Buffer.from([0]), sig))) };
}

// Der Elternprozess baut die Kette, der Kindprozess vertraut ihr - und nur er.
if (!process.env.BORO_TLS_DIR) {
  const dir = mkdtempSync(join(tmpdir(), "boro-tls-"));
  const jetzt = Date.now(), tag = 864e5;
  const ca = zertifikat({ cn: "Borometer Testkette", von: new Date(jetzt - tag), bis: new Date(jetzt + 30 * tag), ca: true });
  const blatt = (cn, san, von, bis) => zertifikat({ cn, san, von, bis, aussteller: ca });
  const alle = {
    gueltig: blatt("gueltig", "127.0.0.1", new Date(jetzt - tag), new Date(jetzt + 30 * tag)),
    abgelaufen: blatt("abgelaufen", "127.0.0.1", new Date(jetzt - 30 * tag), new Date(jetzt - 2 * tag)),
    "falscher-name": blatt("falscher-name", "andere.test", new Date(jetzt - tag), new Date(jetzt + 30 * tag)),
    selbst: zertifikat({ cn: "selbst", san: "127.0.0.1", von: new Date(jetzt - tag), bis: new Date(jetzt + 30 * tag) }),
  };
  writeFileSync(join(dir, "ca.pem"), ca.certPem);
  for (const [n, z] of Object.entries(alle)) { writeFileSync(join(dir, n + ".pem"), z.certPem); writeFileSync(join(dir, n + ".key"), z.keyPem); }
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: "inherit",
    env: { ...process.env, BORO_TLS_DIR: dir, NODE_EXTRA_CA_CERTS: join(dir, "ca.pem"), NODE_TLS_REJECT_UNAUTHORIZED: "" },
  });
  rmSync(dir, { recursive: true, force: true });
  process.exit(r.status ?? 1);
}
const tls = process.env.BORO_TLS_DIR;

const built = await esbuild.build({ entryPoints: [join(root, "src", "main", "http.ts")], bundle: true, format: "esm",
  platform: "node", write: false, logLevel: "silent" });
const h = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + b); }
}

// --- die Adresse: Schema aus der Eingabe, Standardports, alte Eintraege ohne Schema
eq(h.serverBase("https://party.example"), "https://party.example", "https:// ohne Port: Port 443 (keiner angehaengt)");
eq(h.serverBase("https://party.example:9443/"), "https://party.example:9443", "https:// mit Port: der bleibt, Schraegstrich weg");
eq(h.serverBase("HTTPS://Party.Example"), "https://Party.Example", "Schema gross geschrieben zaehlt auch");
eq(h.serverBase("http://203.0.113.5"), "http://203.0.113.5:8732", "http:// ohne Port: 8732");
eq(h.serverBase("203.0.113.5"), "http://203.0.113.5:8732", "alter Eintrag ohne Schema und Port: http, 8732");
eq(h.serverBase("203.0.113.5:8750"), "http://203.0.113.5:8750", "alter Eintrag mit Port: http, der Port bleibt");
eq(h.serverBase("  http://203.0.113.5:8732/ "), "http://203.0.113.5:8732", "Leerraum und Schraegstrich weg");
eq(h.serverBase(""), "", "leer bleibt leer");
eq(h.serverBase(undefined), "", "undefined bleibt leer");
eq(h.serverBase("https://"), "", "nur ein Schema ist keine Adresse");
eq(h.serverBase("ftp://x"), "", "ein anderes Schema ist keine Adresse");
eq(h.serverAddress("https://party.example/"), "https://party.example", "gespeichert: https bleibt stehen");
eq(h.serverAddress("http://203.0.113.5:8732"), "203.0.113.5:8732", "gespeichert: http:// faellt weg, wie bisher");
eq(h.serverAddress("203.0.113.5:8732"), "203.0.113.5:8732", "gespeichert: ohne Schema bleibt");
eq(h.isPlain("https://party.example"), false, "https: nicht unverschluesselt");
eq(h.isPlain("203.0.113.5:8732"), true, "ohne Schema: unverschluesselt");
eq(h.isPlain("http://x"), true, "http://: unverschluesselt");
eq(h.isPlain(""), false, "leer: keine Warnung");

// --- fetchJson gegen einen lokalen HTTPS-Server
const key = (n) => ({ key: readFileSync(join(tls, n + ".key")), cert: readFileSync(join(tls, n + ".pem")) });
const antwort = (req, res) => {
  if (req.url === "/weiter") { res.writeHead(302, { Location: "/health" }); return res.end(); }
  res.writeHead(200, { "Content-Type": "application/json" });
  // /kopf: die Kopfzeilen, wie sie ankamen (Gilde online: Code und Schluessel gehen nur im Kopf)
  if (req.url === "/kopf") return res.end(JSON.stringify({ ok: true, code: req.headers["x-gilde-code"] ?? null, auth: req.headers.authorization ?? null, typ: req.headers["content-type"] ?? null }));
  res.end(JSON.stringify({ ok: true, rooms: 3 }));
};
const hoch = (server) => new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server.address().port)));
// "ok", oder warum nicht: der Code der Ursache (ein Zertifikatsfehler), sonst die Meldung
const geht = (p) => p.then(() => "ok", (e) => e?.cause?.code || e?.cause?.message || e?.message || "fehler");

const servers = [];
async function tlsServer(name) { const s = https.createServer(key(name), antwort); servers.push(s); return await hoch(s); }

eq(process.env.NODE_TLS_REJECT_UNAUTHORIZED || "", "", "die Pruefung ist im Test nicht abgeschaltet");
const gut = await tlsServer("gueltig");
const base = h.serverBase(`https://127.0.0.1:${gut}`);
eq((await h.fetchJson(`${base}/health`, 3000)).rooms, 3, "gueltiges Zertifikat mit eigener Kette: die Antwort kommt an");
eq(await geht(h.fetchJson(`${base}/weiter`, 3000)), "unexpected redirect", "eine Weiterleitung wird nicht verfolgt");
const kopfGet = await h.fetchJson(`${base}/kopf`, 3000, undefined, { "X-Gilde-Code": "CODE", Authorization: "Bearer KEY" });
eq([kopfGet.code, kopfGet.auth], ["CODE", "Bearer KEY"], "GET: Kopfzeilen kommen an");
const kopfPost = await h.fetchJson(`${base}/kopf`, 3000, { a: 1 }, { "X-Gilde-Code": "CODE" });
eq([kopfPost.code, kopfPost.auth, kopfPost.typ], ["CODE", null, "application/json"], "POST: Kopfzeile kommt an, der Inhaltstyp bleibt");
const ohneKopf = await h.fetchJson(`${base}/kopf`, 3000);
eq([ohneKopf.code, ohneKopf.auth], [null, null], "ohne Kopfzeilen: wie bisher");
eq(await geht(h.fetchJson(`https://127.0.0.1:${await tlsServer("abgelaufen")}/health`, 3000)), "CERT_HAS_EXPIRED", "abgelaufenes Zertifikat: scheitert (CERT_HAS_EXPIRED)");
eq(await geht(h.fetchJson(`https://127.0.0.1:${await tlsServer("falscher-name")}/health`, 3000)), "ERR_TLS_CERT_ALTNAME_INVALID", "Zertifikat fuer einen anderen Namen: scheitert (ERR_TLS_CERT_ALTNAME_INVALID)");
eq(await geht(h.fetchJson(`https://127.0.0.1:${await tlsServer("selbst")}/health`, 3000)), "DEPTH_ZERO_SELF_SIGNED_CERT", "selbst signiert ohne Vertrauen: scheitert (DEPTH_ZERO_SELF_SIGNED_CERT)");

// --- und weiter einfaches http, wie bisher
const klar = http.createServer(antwort);
servers.push(klar);
const klarPort = await hoch(klar);
eq((await h.fetchJson(h.serverBase(`127.0.0.1:${klarPort}`) + "/health", 3000)).rooms, 3, "http mit Port: wie bisher");
eq(await geht(h.fetchJson(`${h.serverBase(`127.0.0.1:${klarPort}`)}/weiter`, 3000)), "unexpected redirect", "auch bei http keine Weiterleitung");

for (const s of servers) s.closeAllConnections?.(), s.close();
// kein process.exit mitten in offenen Verbindungen (stuerzt unter Windows in libuv ab)
if (failed) { console.log(`\n${failed} fehlgeschlagen`); process.exitCode = 1; }
else console.log("\nalles gruen");
setTimeout(() => process.exit(process.exitCode ?? 0), 300);
