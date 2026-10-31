import { konfigGelesen, SERVED } from "./41-server-mode";
import { archivAusLog, archivEinlesenGeht, type ArchivHalt } from "./76-archiv";

/* ---------- Alte Logs einlesen: das Lesen des Log-Ordners (Spezifikation Log-Archiv 8; #264) ----------
   Nur auf Klick ("Alte Logs einlesen" in den Einstellungen, Abschnitt Archiv, 57), nie von allein. Dieser
   Teil liest den Ordner des Spiels so, wie die Rekorde es tun (62): GET /api/logs?alle=1 nennt die Logs
   (Namen, Groessen, Zeiten; bis 1000, neueste zuerst), GET /api/log?name=&from= holt jede Datei in Stuecken.
   Eine Datei nach der anderen, nie alle im Speicher; jede geht ganz an das Archiv (archivAusLog in 76), das
   ihre Bosskaempfe schneidet und sendet. Dazwischen bekommt die Seite den Faden zurueck. Am Log-Ordner
   aendert sich nichts: hier steht nur GET.

   Dieser Teil nennt keine Route des Archivs und sendet nichts selbst (Audit 13d.P4): er spricht nur mit
   /api/logs?alle=1 und /api/log; gesendet wird allein in 76, ueber dessen eigene Routen (13d.P1). */

type Stueck = { file?: unknown; from?: unknown; to?: unknown; size?: unknown; text?: unknown };
const signal = (abbruch: AbortSignal) => AbortSignal.any([abbruch, AbortSignal.timeout(10000)]);

/* Eine Datei ganz, Stueck fuer Stueck; null, wenn sie sich nicht lesen laesst (404: nicht mehr im Ordner,
   jede andere Antwort, keine Antwort, ein Stueck, das nicht passt). */
async function dateiLesen(name: string, abbruch: AbortSignal): Promise<string | null> {
  let text = "", from = 0;
  for(;;){
    let d: Stueck | null;
    try {
      const r = await fetch("/api/log?name=" + encodeURIComponent(name) + "&from=" + from, {signal: signal(abbruch)});
      d = r.ok ? await r.json().catch(() => null) : null;
    } catch { return null; }
    if(!d) return null;
    const to = d.to, size = d.size;
    if(d.file !== name || d.from !== from || typeof d.text !== "string" || typeof to !== "number" || typeof size !== "number"
       || !Number.isSafeInteger(to) || !Number.isSafeInteger(size) || to < from || size < to) return null;
    text += d.text;
    if(to === size || to === from) return text;
    from = to;
  }
}

/** Was das Einlesen ergab: neu aufgenommen, schon da, unlesbare Logs (fehler), Kaempfe ohne Antwort beim Senden
    (nichtGesendet); halt: das Archiv hielt das Lesen an (Grund, nach n von von Logs). */
export interface EinlesenErgebnis { neu: number; schon: number; fehler: number; nichtGesendet: number; halt: {grund: ArchivHalt; n: number; von: number} | null }
/** Liest den Log-Ordner ins Archiv. fortschritt(n, von): n Dateien von von sind fertig. Wirft, wenn sich
    die Liste nicht lesen laesst; ein Abbruch endet mit dem, was bis dahin kam. */
export async function alteLogsEinlesen(abbruch: AbortSignal, fortschritt: (n: number, von: number) => void): Promise<EinlesenErgebnis> {
  const aus: EinlesenErgebnis = {neu: 0, schon: 0, fehler: 0, nichtGesendet: 0, halt: null};
  if(!SERVED || !(await konfigGelesen)) return aus;
  if(archivEinlesenGeht() !== "ja"){ aus.halt = {grund: "aus", n: 0, von: 0}; return aus; }
  const r = await fetch("/api/logs?alle=1", {signal: signal(abbruch)});
  const d = r.ok ? await r.json().catch(() => null) : null;
  if(!d || d.ok !== true || !Array.isArray(d.files)) throw new Error("liste");
  const namen = (d.files as unknown[]).flatMap(f => !!f && typeof (f as {name: unknown}).name === "string" ? [(f as {name: string}).name] : []);
  fortschritt(0, namen.length);
  for(let i = 0; i < namen.length; i++){
    if(abbruch.aborted) break;
    const text = await dateiLesen(namen[i]!, abbruch);
    if(abbruch.aborted) break;
    if(text === null) aus.fehler++;
    else {
      const e = await archivAusLog(namen[i]!, text, abbruch);
      aus.neu += e.neu; aus.schon += e.schon; aus.nichtGesendet += e.nichtGesendet;
      // das Archiv haelt an: diese Datei ist nicht fertig, gelesen sind die davor
      if(e.halt){ aus.halt = {grund: e.halt, n: i, von: namen.length}; break; }
    }
    fortschritt(i + 1, namen.length);
    // ein Bild Luft zwischen zwei Dateien: Abbrechen und Rollen bleiben bedienbar
    await new Promise(z => setTimeout(z, 0));
  }
  return aus;
}
