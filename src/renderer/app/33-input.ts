import { toastFail } from "./03-helpers";
import { tt } from "./08-translation";
import { $ } from "./18-interface-basics";
import { loadText, setLoadOrigin } from "./32-history";

/* ---------- input ---------- */
export function readFiles(files: FileList | File[]){
  const list = [...files]; if(!list.length) return;
  Promise.all(list.map(f => f.text()))
    .then(t => { setLoadOrigin("file"); loadText(t.join("\n"), list.map(f => f.name)); })
    .catch(() => toastFail(tt("toast.fileNotRead")));
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  $("#fileInput").onchange = e => readFiles((e.target as HTMLInputElement).files!);
  // Der Knopf auf der Startseite oeffnet direkt den Dateidialog - dort gibt es
  // noch kein Log und also auch nichts zu unterscheiden. Der in der Kopfleiste
  // klappt ein Menue auf, siehe toggleOpenMenu().
  $("#btnOpen2").onclick = () => $("#fileInput").click();
}
