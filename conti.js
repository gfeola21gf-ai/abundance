/* conti.js — i CALCOLI di Abundance (niente disegni qui).
   Importi sempre in CENTESIMI (numeri interi): 12,50 € = 1250. Date come testo "AAAA-MM-GG".

   Come funzionano i soldi nell'app:
   - profilo.saldo = quanto avevi sul conto all'inizio del giorno profilo.dal. Da lì in poi ogni movimento lo cambia.
   - mov:<id> = un movimento: tipo "e" entrata · "u" uscita · "v" versamento in un salvadanaio (importo + = dentro, − = fuori)
     · "r" rettifica del saldo (importo con segno, non conta nelle medie né nei budget).
     atteso = entrata che deve ancora arrivare (si conferma) · saltato = occorrenza di una ricorrenza che non c'è stata.
   - ric:<id> = una ricorrenza (abbonamento, giorno di paga): le sue date si CALCOLANO, non si salvano.
     Una data di una ricorrenza diventa un vero mov solo se la cambi (id = "<ric>@<data>"):
     così due telefoni non creano mai doppioni.
   - Stato di un movimento: "fatto" (conta) · "atteso" (entrata arrivata? da confermare) · "previsto" (nel futuro). */
import * as D from "./dati.js?v=20261105012336";

// ---------- date ----------
const pad = n => String(n).padStart(2, "0");
export const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const pd = s => { const [y, m, g] = s.split("-").map(Number); return new Date(y, m - 1, g, 12); };
export const oggi = () => ds(new Date());
export const addG = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); };
const giorniMese = (y, m) => new Date(y, m + 1, 0).getDate();
export function addM(s, n) {
  const [y, m, g] = s.split("-").map(Number);
  const t = new Date(y, m - 1 + n, 1, 12);
  t.setDate(Math.min(g, giorniMese(t.getFullYear(), t.getMonth())));
  return ds(t);
}
export const somma = (s, k, u) => u === "g" ? addG(s, k) : u === "s" ? addG(s, 7 * k) : u === "m" ? addM(s, k) : addM(s, 12 * k);
export const diffG = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
export const lunedi = s => { const d = pd(s); return addG(s, -((d.getDay() + 6) % 7)); };
export const primoMese = s => s.slice(0, 8) + "01";
export const mese = s => s.slice(0, 7);

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
export const nomeMese = (m, conAnno = true) => { const [y, mm] = m.split("-").map(Number); return MESI[mm - 1] + (conAnno ? " " + y : ""); };
export const meseCorto = m => MESI[Number(m.slice(5, 7)) - 1].slice(0, 3);
export function dataBella(s, { lunga = false } = {}) {
  const o = oggi(), d = pd(s);
  if (s === o) return "oggi";
  if (s === addG(o, -1)) return "ieri";
  if (s === addG(o, 1)) return "domani";
  const diff = diffG(o, s);
  if (diff > 1 && diff < 7 && !lunga) return GIORNI[d.getDay()];
  const anno = d.getFullYear() !== pd(o).getFullYear() ? " " + d.getFullYear() : "";
  return (lunga ? GIORNI[d.getDay()] + " " : "") + d.getDate() + " " + MESI[d.getMonth()].slice(0, lunga ? 20 : 3) + anno;
}
export const giornoSettimana = s => GIORNI[pd(s).getDay()];
export const dataTesta = s => { const d = pd(s); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };

// ---------- soldi ----------
/** 12345 → "12.345" (anche le cifre da 4: 7.928) */
export const migliaia = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export function euro(c, { segno = false, decimali = "auto" } = {}) {
  const ab = Math.abs(Math.round(c)), dec = decimali === "auto" ? (ab % 100 !== 0) : decimali;
  const t = migliaia(Math.floor(ab / 100)) + (dec ? "," + String(ab % 100).padStart(2, "0") : "");
  return (c < 0 ? "−" : segno && c > 0 ? "+" : "") + t + " €";
}
/** "12,5" → 1250 */
export const cent = t => Math.round(parseFloat(String(t).replace(/\./g, "").replace(",", ".")) * 100) || 0;

// ---------- categorie ----------
export const CATEGORIE = [
  { id: "spesa", nome: "Spesa", icona: "spesa", tipo: "u" },
  { id: "fuori", nome: "Ristoranti", icona: "posate", tipo: "u" },
  { id: "bar", nome: "Bar e caffè", icona: "caffe", tipo: "u" },
  { id: "auto", nome: "Auto", icona: "auto", tipo: "u" },
  { id: "benzina", nome: "Benzina", icona: "benzina", tipo: "u" },
  { id: "trasporti", nome: "Trasporti", icona: "treno", tipo: "u" },
  { id: "casa", nome: "Casa", icona: "casa", tipo: "u" },
  { id: "bollette", nome: "Bollette", icona: "fulmine", tipo: "u" },
  { id: "abbonamenti", nome: "Abbonamenti", icona: "play", tipo: "u" },
  { id: "salute", nome: "Salute", icona: "cuore", tipo: "u" },
  { id: "vestiti", nome: "Vestiti", icona: "maglia", tipo: "u" },
  { id: "svago", nome: "Svago", icona: "calice", tipo: "u" },
  { id: "viaggi", nome: "Viaggi", icona: "valigia", tipo: "u" },
  { id: "regali", nome: "Regali", icona: "regalo", tipo: "u" },
  { id: "io", nome: "Per me", icona: "scintilla", tipo: "u" },
  { id: "formazione", nome: "Formazione", icona: "libro", tipo: "u" },
  { id: "lavoro-u", nome: "Lavoro", icona: "lavoro", tipo: "u" },
  { id: "tasse", nome: "Tasse", icona: "tasse", tipo: "u" },
  { id: "altro-u", nome: "Altro", icona: "altro", tipo: "u" },
  { id: "lavoro", nome: "Lavoro", icona: "lavoro", tipo: "e" },
  { id: "fatture", nome: "Fatture", icona: "fattura", tipo: "e" },
  { id: "compensi", nome: "Compensi", icona: "banconota", tipo: "e" },
  { id: "rimborsi", nome: "Rimborsi", icona: "invio", tipo: "e" },
  { id: "regali-e", nome: "Regali", icona: "regalo", tipo: "e" },
  { id: "investimenti", nome: "Investimenti", icona: "crescita", tipo: "e" },
  { id: "altro-e", nome: "Altro", icona: "altro", tipo: "e" },
];
/** tutte le categorie (base + cambiate/create da te), le nascoste escluse se visibili=true */
export function categorie(tipo, visibili = true) {
  const mie = Object.fromEntries(D.elenco("cat:").map(([, v]) => [v.id, v]));
  const tutte = CATEGORIE.map(c => ({ ...c, ...(mie[c.id] || {}) }));
  Object.values(mie).forEach(c => { if (!CATEGORIE.some(b => b.id === c.id)) tutte.push(c); });
  return tutte.filter(c => (!tipo || c.tipo === tipo) && (!visibili || !c.nascosta));
}
export const categoria = id => categorie(null, false).find(c => c.id === id) || { id, nome: "Altro", icona: "altro" };

// ---------- lettura dati ----------
export const profilo = () => D.leggi("profilo");
export const ricorrenze = () => D.elenco("ric:").map(([, v]) => v);
export const budgets = () => D.elenco("bud:").map(([, v]) => v).sort((a, b) => (b.principale ? 1 : 0) - (a.principale ? 1 : 0) || a.creato?.localeCompare(b.creato));
export const tuttiObiettivi = () => D.elenco("sal:").map(([, v]) => v);
export const salvadanai = () => D.elenco("sal:").map(([, v]) => v).filter(s => !s.rotto).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0) || a.creato?.localeCompare(b.creato));
const movReali = () => D.elenco("mov:").map(([, v]) => v);

/** le date di una ricorrenza tra da e a (comprese) */
export function occorrenze(r, da, a) {
  const out = [];
  if (!r.inizio || !r.ogni) return out;
  let k = 0;
  const passo = r.unita === "g" ? r.ogni : r.unita === "s" ? 7 * r.ogni : null;
  if (passo && da > r.inizio) k = Math.max(0, Math.floor(diffG(r.inizio, da) / passo) - 1);
  else if (!passo && da > r.inizio) {
    const mesi = (Number(da.slice(0, 4)) - Number(r.inizio.slice(0, 4))) * 12 + Number(da.slice(5, 7)) - Number(r.inizio.slice(5, 7));
    const perPasso = r.ogni * (r.unita === "a" ? 12 : 1);
    k = Math.max(0, Math.floor(mesi / perPasso) - 1);
  }
  for (let giri = 0; giri < 2000; giri++, k++) {
    const d = somma(r.inizio, k * r.ogni, r.unita);
    if (d > a || (r.fine && d > r.fine)) break;
    if (d >= da) out.push(d);
  }
  return out;
}

function stato(m, o) {
  if (m.data > o) return "previsto";
  if (m.atteso) return "atteso";
  return "fatto";
}

/** tutti i movimenti (veri + date delle ricorrenze) tra da e a, con .stato */
export function movimenti(da, a) {
  const o = oggi(), reali = movReali(), perId = new Map(reali.map(m => [m.id, m]));
  const out = [];
  for (const m of reali) {
    if (m.saltato || m.data < da || m.data > a) continue;
    out.push({ ...m, stato: stato(m, o) });
  }
  for (const r of ricorrenze()) {
    const dal = r.dal || r.inizio;
    for (const d of occorrenze(r, da, a)) {
      if (d < dal || perId.has(`${r.id}@${d}`)) continue;
      const m = { id: `${r.id}@${d}`, tipo: r.tipo, importo: r.importo, desc: r.desc, cat: r.cat, data: d, ric: r.id, virtuale: true, busta: r.busta, fuoriBudget: r.fuoriBudget,
        atteso: r.tipo === "e" && !r.auto };
      out.push({ ...m, stato: stato(m, o) });
    }
  }
  return out.sort((x, y) => y.data.localeCompare(x.data) || (y.creato || "").localeCompare(x.creato || ""));
}
/** un movimento per id (anche una data di una ricorrenza) */
export function trovaMov(id) {
  const vero = D.leggi("mov:" + id);
  if (vero) return { ...vero, stato: stato(vero, oggi()) };
  const [rid, d] = id.split("@");
  const r = D.leggi("ric:" + rid);
  if (!r || !d) return null;
  return movimenti(d, d).find(m => m.id === id) || null;
}

/** effetto sul conto disponibile */
const effetto = m => m.tipo === "e" ? m.importo : m.tipo === "u" ? -m.importo : m.tipo === "v" ? -m.importo : m.tipo === "r" ? m.importo : 0;

// ---------- buste (scelta dell'utente 2026-11-04: «buste dello stesso conto») ----------
// busta:<id> {nome, icona, colore, iniziale, ordine}. "principale" esiste sempre (se non salvata, è virtuale).
// Ogni entrata/uscita ha .busta; un'entrata divisa ha .divisione {busta: importo}; tipo "t" = spostamento {da, a, importo};
// tipo "v" (obiettivo) prende/rimette i soldi in .busta. profilo.distribuzione = {attiva, pct: {busta: n}}.
export const COLORI_BUSTE = ["#2F6B4F", "#B0862A", "#2A6A9E", "#C8643C", "#93498C", "#5E8F72", "#7C8279"];
export function buste() {
  const l = D.elenco("busta:").map(([, v]) => v);
  if (!l.some(b => b.id === "principale")) l.unshift({ id: "principale", nome: "Principale", icona: "portafoglio", colore: COLORI_BUSTE[0], ordine: -1 });
  return l.sort((a, b) => (a.id === "principale" ? -1 : b.id === "principale" ? 1 : 0) || (a.ordine ?? 0) - (b.ordine ?? 0) || (a.creato || "").localeCompare(b.creato || ""));
}
export const busta = id => buste().find(b => b.id === id) || buste()[0];
const esiste = id => id && buste().some(b => b.id === id);
const qualeBusta = id => esiste(id) ? id : "principale";
export const distribuzione = () => profilo()?.distribuzione || { attiva: false, pct: {} };
/** divide un importo secondo le percentuali (il resto dei centesimi va alla busta più grande) */
export function dividi(importo, pct = distribuzione().pct) {
  const voci = Object.entries(pct).filter(([id, n]) => n > 0 && esiste(id));
  const tot = voci.reduce((t, [, n]) => t + n, 0);
  if (!voci.length || !tot) return { principale: importo };
  const out = {}; let usato = 0;
  voci.forEach(([id, n]) => { out[id] = Math.floor(importo * n / tot); usato += out[id]; });
  const grande = voci.sort((a, b) => b[1] - a[1])[0][0];
  out[grande] += importo - usato;
  return out;
}
/** quanto un movimento cambia ogni busta: {busta: ±centesimi} */
export function perBusta(m) {
  const out = {}, add = (id, v) => { const k = qualeBusta(id); out[k] = (out[k] || 0) + v; };
  if (m.tipo === "e") {
    if (m.divisione) Object.entries(m.divisione).forEach(([id, v]) => add(id, v));
    else if (m.busta === "dividi") Object.entries(dividi(m.importo)).forEach(([id, v]) => add(id, v));
    else add(m.busta, m.importo);
  } else if (m.tipo === "u") add(m.busta, -m.importo);
  else if (m.tipo === "v") add(m.busta, -m.importo);
  else if (m.tipo === "r") add(m.busta, m.importo);
  else if (m.tipo === "t") { add(m.da, -m.importo); add(m.a, m.importo); }
  return out;
}
/** saldo di ogni busta oggi: {busta: centesimi} */
export function saldiBuste(al = oggi()) {
  const p = profilo(), out = {};
  buste().forEach(b => { out[b.id] = (b.id === "principale" ? (p?.saldo || 0) : 0) + (b.iniziale || 0); });
  if (!p) return out;
  for (const m of movimenti(p.dal, al)) {
    if (m.stato !== "fatto") continue;
    Object.entries(perBusta(m)).forEach(([id, v]) => { out[id] = (out[id] || 0) + v; });
  }
  return out;
}

export function disponibile(al = oggi()) {
  const p = profilo();
  if (!p) return 0;
  const iniziali = D.elenco("busta:").reduce((t, [, b]) => t + (b.iniziale || 0), 0);
  return p.saldo + iniziali + movimenti(p.dal, al).filter(m => m.stato === "fatto").reduce((s, m) => s + effetto(m), 0);
}
/** saldo previsto alla fine di un giorno futuro (contando i previsti, non le entrate da confermare) */
export function previsto(al) {
  const o = oggi();
  if (al <= o) return disponibile(al);
  return disponibile(o) + movimenti(addG(o, 1), al).reduce((s, m) => s + effetto(m), 0);
}
export function saldoSalvadanaio(sid, al = oggi()) {
  const p = profilo(), s = D.leggi("sal:" + sid);
  return (s?.iniziale || 0) + movimenti(p?.dal || "2000-01-01", al)
    .filter(m => m.tipo === "v" && m.sal === sid && m.stato === "fatto").reduce((t, m) => t + m.importo, 0);
}
export const totaleSalvadanai = () => salvadanai().reduce((t, s) => t + saldoSalvadanaio(s.id), 0);
export const patrimonio = () => disponibile() + totaleSalvadanai();

export function bilancioMese(m = mese(oggi())) {
  const lista = movimenti(m + "-01", m + "-31").filter(x => x.stato === "fatto");
  const e = lista.filter(x => x.tipo === "e").reduce((s, x) => s + x.importo, 0);
  const u = lista.filter(x => x.tipo === "u").reduce((s, x) => s + x.importo, 0);
  return { e, u, netto: e - u };
}

/** da confermare: entrate arrivate? (le ultime 60 giornate) */
export const daConfermare = () => movimenti(addG(oggi(), -60), oggi()).filter(m => m.stato === "atteso").sort((a, b) => a.data.localeCompare(b.data));
export const inArrivo = (giorni = 30) => movimenti(addG(oggi(), 1), addG(oggi(), giorni)).sort((a, b) => a.data.localeCompare(b.data));

// ---------- budget ----------
export const UNITA = { g: ["giorno", "giorni"], s: ["settimana", "settimane"], m: ["mese", "mesi"], a: ["anno", "anni"] };
export function nomePeriodo(b) {
  const [uno, piu] = UNITA[b.unita] || UNITA.m;
  if (b.ogni === 1) return { g: "Al giorno", s: "Settimanale", m: "Mensile", a: "Annuale" }[b.unita];
  if (b.ogni === 2 && b.unita === "m") return "Bimestrale";
  if (b.ogni === 3 && b.unita === "m") return "Trimestrale";
  return `Ogni ${b.ogni} ${b.ogni === 1 ? uno : piu}`;
}
/** il periodo di un budget che contiene la data: { k, inizio, fine } */
export function periodo(b, data = oggi()) {
  let k = 0;
  if (data > b.inizio) {
    const passo = b.unita === "g" ? b.ogni : b.unita === "s" ? 7 * b.ogni : null;
    if (passo) k = Math.floor(diffG(b.inizio, data) / passo);
    else {
      const mesi = (Number(data.slice(0, 4)) - Number(b.inizio.slice(0, 4))) * 12 + Number(data.slice(5, 7)) - Number(b.inizio.slice(5, 7));
      k = Math.max(0, Math.floor(mesi / (b.ogni * (b.unita === "a" ? 12 : 1))) - 1);
      while (somma(b.inizio, (k + 1) * b.ogni, b.unita) <= data) k++;
    }
  }
  const inizio = somma(b.inizio, k * b.ogni, b.unita), fine = addG(somma(b.inizio, (k + 1) * b.ogni, b.unita), -1);
  return { k, inizio, fine };
}
const contaNelBudget = (b, m) => m.tipo === "u" && !m.fuoriBudget && (!b.cats?.length || b.cats.includes(m.cat)) && (!b.busta || qualeBusta(m.busta) === b.busta);
export function riporto(b, per) {
  if (per.k === 0) return 0;
  const prima = periodo(b, addG(per.inizio, -1));
  const c = D.leggi(`chiusa:${b.id}:${prima.inizio}`);
  return c?.scelta === "riporta" ? c.importo : 0;
}
/** com'è messo un budget nel periodo che contiene la data */
export function statoBudget(b, data = oggi()) {
  const per = periodo(b, data), lista = movimenti(per.inizio, per.fine).filter(m => contaNelBudget(b, m));
  const speso = lista.filter(m => m.stato === "fatto").reduce((s, m) => s + m.importo, 0);
  const inArrivo = lista.filter(m => m.stato === "previsto").reduce((s, m) => s + m.importo, 0);
  const totale = b.importo + riporto(b, per);
  const giorniRestanti = Math.max(1, diffG(oggi(), per.fine) + 1);
  return { ...per, speso, inArrivo, totale, resta: totale - speso, giorniRestanti,
    alGiorno: Math.max(0, Math.floor((totale - speso - inArrivo) / giorniRestanti)), quota: totale ? speso / totale : 0 };
}
/** periodi finiti da chiudere (il rito): solo l'ultimo per budget */
export function daChiudere() {
  const out = [];
  for (const b of budgets()) {
    const ora = periodo(b);
    if (ora.k === 0) continue;
    const prima = periodo(b, addG(ora.inizio, -1));
    if (prima.fine < (b.creato || "").slice(0, 10)) continue;
    if (D.leggi(`chiusa:${b.id}:${prima.inizio}`)) continue;
    const st = statoBudget(b, prima.inizio);
    out.push({ b, ...st, avanzo: st.totale - st.speso });
  }
  return out;
}

// ---------- media dei guadagni ----------
/** mesi = 3 | 6 | 12 | 0 (= da sempre) */
export function andamento(mesi = 6) {
  const o = oggi(), questo = mese(o), p = profilo();
  const reali = movReali().filter(m => m.tipo === "e" || m.tipo === "u");
  const primo = [p?.dal, ...reali.map(m => m.data), ...ricorrenze().map(r => r.dal || r.inizio)].filter(Boolean).sort()[0] || o;
  let inizio = mese(primo);
  if (mesi) { const lim = mese(addM(questo + "-01", -mesi)); if (lim > inizio) inizio = lim; }
  const lista = [];
  for (let m = inizio; m < questo; m = mese(addM(m + "-01", 1))) lista.push(m);
  const serie = lista.map(m => ({ m, ...bilancioMese(m) }));
  const conDati = serie.length ? serie : [];
  const media = conDati.length ? Math.round(conDati.reduce((s, x) => s + x.e, 0) / conDati.length) : 0;
  const mediaU = conDati.length ? Math.round(conDati.reduce((s, x) => s + x.u, 0) / conDati.length) : 0;
  const ord = [...conDati].sort((a, b) => b.e - a.e);
  // spese per categoria nel periodo (mesi completi + questo)
  const da = (lista[0] || questo) + "-01";
  const perCat = {}, perCatE = {};
  movimenti(da, o).filter(m => m.stato === "fatto").forEach(m => {
    if (m.tipo === "u") perCat[m.cat] = (perCat[m.cat] || 0) + m.importo;
    if (m.tipo === "e") perCatE[m.cat] = (perCatE[m.cat] || 0) + m.importo; });
  return { serie, media, mediaU, migliore: ord[0], peggiore: ord[ord.length - 1], mesiContati: conDati.length,
    perCat: Object.entries(perCat).sort((a, b) => b[1] - a[1]), perCatE: Object.entries(perCatE).sort((a, b) => b[1] - a[1]), corrente: { m: questo, ...bilancioMese(questo) } };
}

/** costo di una ricorrenza al mese (stima) */
export function alMese(r) {
  const volteAlMese = r.unita === "g" ? 30.44 / r.ogni : r.unita === "s" ? 4.348 / r.ogni : r.unita === "m" ? 1 / r.ogni : 1 / (12 * r.ogni);
  return Math.round(r.importo * volteAlMese);
}
export function nomeRipeti(r) {
  if (!r) return "Non si ripete";
  if (r.ogni === 1) return { g: "Ogni giorno", s: "Ogni settimana", m: "Ogni mese", a: "Ogni anno" }[r.unita];
  return `Ogni ${r.ogni} ${UNITA[r.unita][1]}`;
}
export const ricAttiva = r => !r.fine || r.fine >= oggi();
export const prossima = r => occorrenze(r, oggi(), addM(oggi(), 24 * (r.unita === "a" ? r.ogni : 1)))[0] || null;

// ---------- frasi ----------
export const FRASI = [
  "Il denaro scorre verso di me.", "Merito di guadagnare bene.", "Paga prima te stesso.", "C'è abbastanza, e ne arriva altro.",
  "Ogni euro ha un compito.", "Sono bravo con i soldi.", "Il mio valore cresce ogni giorno.", "Ricevo con gratitudine.",
  "Spendo con intenzione.", "Il denaro ama la chiarezza.", "Risparmiare è un regalo al me di domani.", "Le opportunità mi trovano.",
  "Ciò che misuro, cresce.", "Sono in pace con i miei soldi.", "Guadagno facendo ciò che amo.", "Piccoli passi, grandi somme.",
  "Il denaro è energia: lo guido io.", "Dico sì all'abbondanza.", "Ogni giorno so dove sono.", "Investo in ciò che conta.",
  "La ricchezza è una scelta quotidiana.", "Il mio lavoro vale.", "Spendere bene è un'arte.", "Ho sempre ciò che mi serve.",
  "La calma attira prosperità.", "Il futuro lo finanzio oggi.", "Più do valore, più ricevo.", "Il denaro è un buon amico.",
  "Celebro ogni entrata.", "Sono il capitano dei miei conti.",
];
export const fraseDelGiorno = (spost = 0) => { const n = diffG("2026-01-01", oggi()) + spost; return FRASI[((n % FRASI.length) + FRASI.length) % FRASI.length]; };
export const FRASI_RISPARMIO = ["Un euro messo da parte è un euro che lavora per te.", "Il me di domani ringrazia.",
  "Così cresce l'abbondanza: un passo alla volta.", "Ottima scelta. Il tuo futuro è più ricco."];
export const FRASI_SALVA = ["Ogni euro che segni è un euro che guidi.", "La chiarezza è già ricchezza.", "Sai sempre dove sei.", "Il controllo è tuo."];
export const FRASI_ENTRATA = ["Benvenuti, soldi.", "Ricevuto con gratitudine.", "Il tuo lavoro vale: eccone la prova.", "Ne arriveranno altri."];

// ---------- notifiche dei prossimi giorni ----------
/** avviso = { giorni: 0..7 prima (−1 = nessuno), ora: "HH:MM" } — predefinito: profilo.avviso, se no 1 giorno prima alle 9 */
export const AVVISO_BASE = { giorni: 1, ora: "09:00" };
export const avvisoPredefinito = () => profilo()?.avviso || AVVISO_BASE;
export function nomeAvviso(av, corto = false) {
  if (!av) av = avvisoPredefinito();
  if (av.giorni < 0) return corto ? "Nessun avviso" : "Nessun avviso";
  const g = av.giorni === 0 ? (corto ? "Il giorno" : "Il giorno stesso") : av.giorni === 7 ? (corto ? "1 sett. prima" : "Una settimana prima")
    : corto ? `${av.giorni} g prima` : `${av.giorni} ${av.giorni === 1 ? "giorno" : "giorni"} prima`;
  return corto ? g : `${g}, alle ${av.ora}`;
}
export function avvisiProgrammati() {
  const o = oggi(), fino = addG(o, 40), out = [];
  const alle = (s, ora = "09:00") => { const d = pd(s); const [h, m] = ora.split(":").map(Number); d.setHours(h || 0, m || 0, 0, 0); return d; };
  const principale = budgets().find(b => b.principale);
  for (const m of movimenti(o, fino)) {
    if (m.tipo === "u") {
      const r = m.ric ? D.leggi("ric:" + m.ric) : null;
      const av = m.avviso || r?.avviso || avvisoPredefinito();
      if (av.giorni < 0) continue;
      let testo = `${euro(m.importo)} dalla carta: assicurati di avere i soldi.`;
      if (principale && contaNelBudget(principale, m)) {
        const st = statoBudget(principale, m.data);
        const dopo = st.totale ? Math.round(((st.speso + m.importo) / st.totale) * 100) : 0;
        if (dopo >= 80) testo += ` Il budget arriverà al ${dopo}%.`;
      }
      const quando = av.giorni === 0 ? "Oggi" : av.giorni === 1 ? "Domani" : `Tra ${av.giorni} giorni`;
      out.push({ chiave: "u:" + m.id, invio_alle: alle(addG(m.data, -av.giorni), av.ora), titolo: `${quando}: ${m.desc || categoria(m.cat).nome}`, testo });
    } else if (m.tipo === "e" && m.atteso) {
      out.push({ chiave: "e:" + m.id, invio_alle: alle(m.data), titolo: `Giorno di paga: ${m.desc || categoria(m.cat).nome}`,
        testo: `Sono arrivati ${euro(m.importo)}? Tocca per confermare.` });
    }
  }
  for (const b of budgets()) {
    const per = periodo(b);
    const g = addG(per.fine, 1);
    if (g <= fino) out.push({ chiave: `b:${b.id}:${per.inizio}`, invio_alle: alle(g), titolo: `${b.nome}: periodo chiuso`,
      testo: "Vediamo com'è andata e dove mettere quello che è avanzato." });
  }
  return out.sort((a, b) => a.invio_alle - b.invio_alle).slice(0, 80);
}

export const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
