/* push.js — le NOTIFICHE PUSH.
   attivaNotifiche() chiede il permesso e registra su Supabase l'"indirizzo" di questo telefono.
   programmaAvvisi(lista) riscrive le notifiche dei prossimi giorni (abbonamenti, paghe, budget da chiudere):
   le manda poi la funzione abundance-notifiche su Supabase, anche ad app chiusa.
   Su iPhone funzionano SOLO con l'app aggiunta alla schermata Home e aperta da lì. */
import { sb, PROVA, chiSei } from "./dati.js?v=20261105012336";
import { VAPID_CHIAVE_PUBBLICA } from "./config.js?v=20261105012336";

const suIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
const installata = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

/** "attive" · "da-attivare" · "bloccate" · "serve-installazione" · "non-supportate" */
export function statoNotifiche() {
  if (suIPhone && !installata()) return "serve-installazione";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "non-supportate";
  if (Notification.permission === "granted") return "attive";
  if (Notification.permission === "denied") return "bloccate";
  return "da-attivare";
}

/** chiede il permesso (va chiamata durante un tocco) e registra il telefono */
export async function attivaNotifiche() {
  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("Permesso non concesso");
  await registraDispositivo();
}

export async function registraDispositivo() {
  if (PROVA) return;
  const reg = await navigator.serviceWorker.ready;
  let iscrizione = await reg.pushManager.getSubscription();
  if (!iscrizione) {
    iscrizione = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: daBase64(VAPID_CHIAVE_PUBBLICA) });
  }
  const { endpoint, keys } = iscrizione.toJSON();
  const { error } = await sb.from("abundance_push").upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
}

let ultimaFirma = "";
/** lista = [{chiave, invio_alle (Date), titolo, testo}] — sostituisce gli avvisi futuri non ancora mandati */
export async function programmaAvvisi(lista) {
  if (PROVA || !chiSei() || !navigator.onLine) return;
  const firma = JSON.stringify(lista);
  if (firma === ultimaFirma) return;
  const ora = new Date();
  const righe = lista.filter(a => a.invio_alle > ora).map(a => ({
    chiave: a.chiave, invio_alle: a.invio_alle.toISOString(), titolo: a.titolo, testo: a.testo || "", url: a.url || "./",
  }));
  const { error: e1 } = await sb.from("abundance_avvisi").delete().eq("inviata", false);
  if (e1) return console.warn("Avvisi:", e1.message);
  if (righe.length) {
    const { error } = await sb.from("abundance_avvisi").upsert(righe, { onConflict: "user_id,chiave", ignoreDuplicates: true });
    if (error) return console.warn("Avvisi:", error.message);
  }
  ultimaFirma = firma;
}

function daBase64(testo) {
  const base64 = (testo + "=".repeat((4 - (testo.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
