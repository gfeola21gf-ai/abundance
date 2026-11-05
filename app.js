/* app.js — tutte le schermate di Abundance e i tocchi.
   Ogni pulsante ha data-a="<azione>": le azioni sono nell'oggetto AZ in fondo.
   I fogli dal basso (aggiungi, budget, salvadanaio…) si disegnano in #strato e hanno il loro stato in U.f. */
import * as D from "./dati.js?v=20261105012336";
import * as K from "./conti.js?v=20261105012336";
import { ic, NOMI, GRUPPI } from "./icone.js?v=20261105012336";
import { statoNotifiche, attivaNotifiche, registraDispositivo, programmaAvvisi } from "./push.js?v=20261105012336";

const app = document.getElementById("app");
const $ = s => app.querySelector(s);
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clona = v => v == null ? v : JSON.parse(JSON.stringify(v));
const adesso = () => new Date().toISOString();
const caso = l => l[Math.floor(Math.random() * l.length)];
const memo = { leggi(k, d) { try { return JSON.parse(localStorage.getItem("abundance." + k)) ?? d; } catch { return d; } },
  scrivi(k, v) { try { localStorage.setItem("abundance." + k, JSON.stringify(v)); } catch { /* niente */ } } };

const U = { scheda: "oggi", foglio: null, f: null, spostFrase: 0, netto: null, calMese: K.mese(K.oggi()), calGiorno: K.oggi(),
  accesso: { nuovo: false, errore: "" }, benv: null, cerca: "" };

// ================= GUSCIO =================
function guscio() {
  app.innerHTML = `<div class="corpo" id="corpo"></div><nav class="tab" id="tab"></nav><div id="strato"></div>
    <div class="toast" id="toast"></div><div class="festa" id="festa"></div><div class="sync" id="sync">Sincronizzo…</div>`;
}
function disegna() {
  if (!$("#corpo")) guscio();
  const corpo = $("#corpo"), prima = corpo.dataset.scheda === U.scheda ? corpo.scrollTop : 0;
  corpo.dataset.scheda = U.scheda;
  corpo.innerHTML = { oggi: oggiHtml, calendario: calendarioHtml, piani: pianiHtml, buste: busteHtml }[U.scheda]();
  corpo.scrollTop = prima;
  $("#tab").innerHTML = tabHtml();
  dopoDisegno();
  programma();
}
function tabHtml() {
  const b = (id, icona, nome) => `<button class="${U.scheda === id ? "on" : ""}" data-a="scheda" data-id="${id}"><span class="pill">${ic(icona)}</span>${nome}</button>`;
  return b("oggi", "casa", "Oggi") + b("calendario", "calendario", "Calendario") +
    `<button class="piu" data-a="nuovo" aria-label="Aggiungi">${ic("piu")}</button>` +
    b("piani", "piani", "Piani") + b("buste", "portafoglio", "Buste");
}
function dopoDisegno() {
  const n = $("#netto");
  if (n) { const v = K.patrimonio(); conta(n, U.netto ?? 0, v, U.netto == null ? 1500 : 700); U.netto = v; }
  requestAnimationFrame(() => setTimeout(() => {
    app.querySelectorAll("[data-larg]").forEach(el => { el.style.width = el.dataset.larg; });
    app.querySelectorAll("[data-arco]").forEach(el => { el.style.strokeDashoffset = el.dataset.arco; });
  }, 60));
}
function conta(el, da, a, ms) {
  const t0 = performance.now();
  const scrivi = v => { const c = Math.round(v), neg = c < 0, ab = Math.abs(c);
    el.innerHTML = (neg ? "−" : "") + K.migliaia(Math.floor(ab / 100)) + `<small>,${String(ab % 100).padStart(2, "0")} €</small>`; };
  if (da === a) return scrivi(a);
  (function passo(t) { const p = Math.min((t - t0) / ms, 1), e = 1 - Math.pow(1 - p, 4); scrivi(da + (a - da) * e); if (p < 1) requestAnimationFrame(passo); })(t0);
}

// ================= PEZZI COMUNI =================
function rigaMov(m, { conData = true } = {}) {
  const c = K.categoria(m.cat);
  let icona = c.icona, nome = m.desc || c.nome, cls = m.tipo === "e" ? "e" : "", sotto = [];
  if (m.tipo === "v") { const s = D.leggi("sal:" + m.sal); icona = s?.icona || "salvadanaio"; cls = "oro"; nome = m.desc || (m.importo >= 0 ? "Nel salvadanaio" : "Dal salvadanaio") + (s ? " " + s.nome : ""); }
  if (m.tipo === "r") { icona = "matita"; nome = "Saldo corretto"; }
  if (m.tipo === "t") { icona = "ripeti"; cls = ""; nome = m.desc || `${K.busta(m.da).nome} → ${K.busta(m.a).nome}`; if (m.desc) sotto.push(`${K.busta(m.da).nome} → ${K.busta(m.a).nome}`); }
  if ((m.tipo === "e" || m.tipo === "u") && K.buste().length > 1) sotto.push(m.divisione || m.busta === "dividi" ? "divisa tra le buste" : K.busta(m.busta).nome);
  if (m.tipo !== "v" && m.tipo !== "r" && m.tipo !== "t" && m.desc) sotto.unshift(c.nome);
  if (conData) sotto.push(K.dataBella(m.data));
  const segno = m.tipo === "e" ? "+" : m.tipo === "u" ? "−" : m.tipo === "v" ? (m.importo >= 0 ? "→ " : "← ") : m.tipo === "t" ? "" : (m.importo >= 0 ? "+" : "−");
  const et = (m.tipo === "u" && m.fuoriBudget ? `<span class="etichettina">fuori budget</span>` : "") + (m.stato === "atteso" ? `<span class="etichettina">da confermare</span>` : m.stato === "previsto" && m.tipo === "e" && m.atteso ? `<span class="etichettina">attesa</span>` : "");
  return `<button class="mov" data-a="apriMov" data-id="${esc(m.id)}"><div class="ico ${cls}">${ic(icona)}</div>
    <div class="nome"><div>${esc(nome)}${et}</div><div class="sotto">${m.ric ? ic("ripeti", "picc") + " " : ""}${esc(sotto.join(" · "))}</div></div>
    <div class="imp ${m.tipo} ${m.stato !== "fatto" ? "pallido" : ""}">${segno}${K.euro(Math.abs(m.importo)).replace(" €", "")}</div></button>`;
}
function cardBudget(b, grande, info = "") {
  const s = K.statoBudget(b), sfor = s.resta < 0;
  const w = Math.min(100, s.quota * 100), dopo = s.totale ? Math.min(100 - w, (s.inArrivo / s.totale) * 100) : 0;
  const giorni = s.giorniRestanti === 1 ? "ultimo giorno" : `ancora ${s.giorniRestanti} giorni`;
  return `<button class="card" data-a="formBudget" data-id="${b.id}">
    <div class="riga"><span class="titolo">${esc(b.nome)}</span><span class="sotto" style="flex:none">${giorni}</span></div>
    ${info ? `<div class="sotto" style="margin-top:2px">${esc(info)}</div>` : ""}
    ${grande ? `<div class="resta ${sfor ? "terra" : ""}">${sfor ? "Oltre di " + K.euro(-s.resta) : K.euro(s.resta)} <span>${sfor ? "su " + K.euro(s.totale) : "restano di " + K.euro(s.totale)}</span></div>`
      : `<div class="riga" style="margin-top:4px"><span class="imp ${sfor ? "u" : ""}" style="font-size:18px">${sfor ? "−" + K.euro(-s.resta) : K.euro(s.resta)}</span><span class="sotto">di ${K.euro(s.totale)}</span></div>`}
    <div class="barra ${grande ? "" : "mini"}"><i class="${s.quota >= .8 ? "attenzione" : ""}" data-larg="${w}%"></i>${dopo > 0 ? `<i class="dopo" data-larg="${dopo}%"></i>` : ""}</div>
    ${grande ? `<div class="sotto" style="margin-top:8px">${sfor ? "Nessun dramma: ogni periodo è un nuovo inizio." : `circa ${K.euro(s.alGiorno)} al giorno${s.inArrivo ? ` · ${K.euro(s.inArrivo)} già in arrivo` : ""}`}</div>` : ""}
  </button>`;
}
const vuoto = (titolo, testo) => `<div class="vuoto"><b>${titolo}</b>${testo}</div>`;

// ================= OGGI =================
function oggiHtml() {
  const o = K.oggi(), bm = K.bilancioMese(), buds = K.budgets(), conf = K.daConfermare(), chiudere = K.daChiudere();
  const arrivo = K.inArrivo(21).slice(0, 4);
  const ultimi = K.movimenti(K.addG(o, -90), o).filter(m => m.stato === "fatto").slice(0, 6);
  const an = K.andamento(K.profilo().mediaMesi ?? 6);
  const notif = statoNotifiche() === "da-attivare" && !memo.leggi("noNotifiche", false) && !D.PROVA;
  return `
  <div class="testa"><span class="data">${K.dataTesta(o)}</span>
    <button class="tondo" data-a="impostazioni" aria-label="Impostazioni">${ic("regola")}</button></div>
  <p class="frase" data-a="frase">${esc(K.fraseDelGiorno(U.spostFrase))}</p>
  <div class="patrimonio"><div class="etichetta">Patrimonio netto</div><div class="cifra" id="netto"></div>
    <span class="chip ${bm.netto < 0 ? "terra" : ""}">${ic(bm.netto < 0 ? "giu" : "su")}${K.euro(Math.abs(bm.netto))} questo mese</span>
    <div class="dueNum"><span>Disponibile <b>${K.euro(K.disponibile())}</b></span><span>Obiettivi <b>${K.euro(K.totaleSalvadanai())}</b></span></div></div>
  ${chiudere.map(ritoHtml).join("")}
  ${conf.map(m => `<div class="card conferma"><div class="sotto">${m.data === o ? "Oggi" : "Dal " + K.dataBella(m.data)} · ${esc(m.desc || K.categoria(m.cat).nome)}</div>
    <p>Arrivati ${K.euro(m.importo)}?</p><div class="bottoni"><button class="btn si" data-a="arrivati" data-id="${esc(m.id)}">Sì, arrivati</button>
    <button class="btn no" data-a="apriMov" data-id="${esc(m.id)}">Correggi</button></div></div>`).join("")}
  ${notif ? `<div class="card"><div class="riga"><span class="titolo">Ti avviso io?</span><button class="sotto" data-a="noNotifiche">Non ora</button></div>
    <div class="sotto" style="margin:6px 0 0">Il giorno prima degli abbonamenti, nei giorni di paga e quando un budget si chiude.</div>
    <div class="bottoni"><button class="btn si" data-a="attivaNotifiche">${ic("campanella")} Attiva le notifiche</button></div></div>` : ""}
  ${buds.length ? buds.map((b, i) => cardBudget(b, i === 0)).join("")
    : `<button class="card" data-a="formBudget">${vuoto("Nessun budget", "Tocca per decidere quanto spendere a settimana, al mese o come vuoi tu.")}</button>`}
  <div class="sezione">In arrivo <button data-a="scheda" data-id="calendario">Calendario ${ic("avanti")}</button></div>
  <div class="card lista">${arrivo.length ? arrivo.map(m => rigaMov(m)).join("") : vuoto("Niente in vista", "Abbonamenti, paghe e spese future compariranno qui.")}</div>
  <div class="sezione">Ultimi movimenti <button data-a="tutti">Tutti ${ic("avanti")}</button></div>
  <div class="card lista">${ultimi.length ? ultimi.map(m => rigaMov(m)).join("") : vuoto("Inizia da qui", "Tocca il + in basso e segna la prima spesa o entrata.")}</div>
  <button class="card" data-a="andamento"><div class="riga"><span class="titolo">Guadagno medio</span>
    <span class="sotto">${an.mesiContati ? (K.profilo().mediaMesi ? `ultimi ${an.mesiContati} mesi` : "da sempre") : "questo mese"} ${ic("avanti", "picc")}</span></div>
    <div class="resta">${K.euro(an.mesiContati ? an.media : an.corrente.e)} <span>al mese</span></div></button>`;
}
function ritoHtml(r) {
  const nomeP = { s: "settimana", m: "mese", a: "anno", g: "giorno" }[r.b.unita];
  const prossimo = r.b.ogni === 1 ? (r.b.unita === "s" ? "Alla prossima settimana" : r.b.unita === "m" ? "Al prossimo mese" : r.b.unita === "a" ? "Al prossimo anno" : "A domani") : "Al prossimo periodo";
  if (r.avanzo <= 0) return `<div class="card rito"><div class="sotto">${esc(r.b.nome)} · ${nomeP === "settimana" ? "settimana" : "periodo"} chiuso</div>
    <p style="margin-top:6px">Sei andato oltre di ${K.euro(-r.avanzo)}.</p><div class="sotto" style="margin-top:4px">Succede. Guardare i numeri è già vincere: si riparte.</div>
    <div class="bottoni"><button class="btn si" data-a="chiudi" data-id="${r.b.id}" data-scelta="sforato">Si riparte</button></div></div>`;
  return `<div class="card rito"><div class="sotto">${esc(r.b.nome)} · ${nomeP === "settimana" ? "settimana" : "periodo"} chiuso</div>
    <p style="margin-top:6px">Ti sono avanzati</p><div class="grande">${K.euro(r.avanzo)}</div><p>Dove li mettiamo?</p>
    <div class="bottoni colonna">${bustaRisparmi() ? `<button class="btn si" data-a="chiudi" data-id="${r.b.id}" data-scelta="busta">${ic("salvadanaio")} In ${esc(bustaRisparmi().nome)}</button>` : ""}
    <div class="bottoni" style="margin-top:0"><button class="btn chiaro" data-a="chiudi" data-id="${r.b.id}" data-scelta="riporta">${prossimo}</button>
    ${K.salvadanai().length > 1 ? `<button class="btn chiaro" data-a="chiudi" data-id="${r.b.id}" data-scelta="obiettivo">In un obiettivo</button>` : ""}</div></div></div>`;
}

// ================= CALENDARIO =================
function calendarioHtml() {
  const m = U.calMese, primo = m + "-01", o = K.oggi();
  const inizio = K.lunedi(primo), ultimo = K.addG(K.addM(primo, 1), -1), fine = K.addG(K.lunedi(ultimo), 6);
  const movs = K.movimenti(inizio, fine), perG = {};
  movs.forEach(x => { if (x.tipo !== "e" && x.tipo !== "u") return; (perG[x.data] ||= { e: 0, u: 0 })[x.tipo]++; });
  K.salvadanai().forEach(s => { if (s.entro && s.entro >= inizio && s.entro <= fine) (perG[s.entro] ||= { e: 0, u: 0 }).o = true; });
  let celle = "";
  for (let d = inizio; d <= fine; d = K.addG(d, 1)) {
    const p = perG[d] || {}, cl = [d.slice(0, 7) !== m && "fuori", d === o && "oggi", d === U.calGiorno && "scelto", d < o && "passato"].filter(Boolean).join(" ");
    celle += `<button class="${cl}" data-a="giorno" data-id="${d}"><span>${Number(d.slice(8))}</span><span class="punti">${p.e ? '<i class="e"></i>' : ""}${p.u ? '<i class="u"></i>' : ""}${p.o ? '<i class="o"></i>' : ""}</span></button>`;
  }
  const delMese = movs.filter(x => x.data.slice(0, 7) === m);
  const e = delMese.filter(x => x.tipo === "e").reduce((s, x) => s + x.importo, 0), u = delMese.filter(x => x.tipo === "u").reduce((s, x) => s + x.importo, 0);
  const g = U.calGiorno, delGiorno = K.movimenti(g, g), obiettivi = K.salvadanai().filter(s => s.entro === g);
  return `
  <div class="testa"><span class="data">${g >= o ? "Cosa arriva" : "Cosa è successo"}</span>
    <button class="tondo" data-a="oggiCal" aria-label="Oggi">${ic("calendario")}</button></div>
  <div class="mesi"><h2>${K.nomeMese(m)}</h2><div class="frecce"><button class="tondo" data-a="mese" data-id="-1" aria-label="Mese prima">${ic("indietro")}</button>
    <button class="tondo" data-a="mese" data-id="1" aria-label="Mese dopo">${ic("avanti")}</button></div></div>
  <div class="dueNum" style="justify-content:flex-start"><span>Entrate <b style="color:var(--verde)">+${K.euro(e)}</b></span><span>Uscite <b style="color:var(--terra)">−${K.euro(u)}</b></span></div>
  <div class="settimana"><span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span></div>
  <div class="giorni">${celle}</div>
  <div class="legenda"><span><i style="background:var(--verde)"></i>entrate</span><span><i style="background:var(--terra)"></i>uscite</span><span><i style="background:var(--oro)"></i>obiettivi</span></div>
  <div class="card">
    <div class="riga"><span class="titolo" style="text-transform:capitalize">${K.dataBella(g, { lunga: true })}</span>
      <span class="sotto">${g > o ? "saldo previsto" : "saldo a fine giornata"}</span></div>
    <div class="resta">${K.euro(K.previsto(g))}</div>
    <div class="lista" style="padding:0;margin-top:6px">${obiettivi.map(s => `<button class="mov" data-a="apriSal" data-id="${s.id}"><div class="ico oro">${ic(s.icona || "obiettivo")}</div>
      <div class="nome"><div>${esc(s.nome)}</div><div class="sotto">obiettivo da raggiungere oggi</div></div><div class="imp v">${K.euro(s.obiettivo || 0)}</div></button>`).join("")}
      ${delGiorno.map(x => rigaMov(x, { conData: false })).join("")}
      ${!delGiorno.length && !obiettivi.length ? `<div class="vuoto" style="padding:10px 0 4px">Nessun movimento.</div>` : ""}</div>
    <button class="btn no pieno" style="margin-top:12px" data-a="nuovo" data-data="${g}">${ic("piu")} Aggiungi ${g === o ? "oggi" : g > o ? "una spesa prevista" : "in questo giorno"}</button>
  </div>`;
}

// ================= PIANI =================
function pianiHtml() {
  const rics = K.ricorrenze().filter(K.ricAttiva), ab = rics.filter(r => r.tipo === "u"), en = rics.filter(r => r.tipo === "e");
  const totAb = ab.reduce((s, r) => s + K.alMese(r), 0), totEn = en.reduce((s, r) => s + K.alMese(r), 0);
  const future = K.movimenti(K.addG(K.oggi(), 1), K.addM(K.oggi(), 24)).filter(m => !m.ric).reverse();
  const rigaRic = r => { const c = K.categoria(r.cat), pr = K.prossima(r);
    return `<button class="mov" data-a="apriRic" data-id="${r.id}"><div class="ico ${r.tipo === "e" ? "e" : ""}">${ic(c.icona)}</div>
      <div class="nome"><div>${esc(r.desc || c.nome)}</div><div class="sotto">${K.nomeRipeti(r)}${pr ? " · prossimo " + K.dataBella(pr) : ""}</div></div>
      <div class="imp ${r.tipo}">${K.euro(r.importo)}</div></button>`; };
  const budgets = K.budgets();
  return `
  <div class="testa"><span class="data">Il futuro, già scritto</span></div>
  <div class="h1">Piani</div>
  <div class="sezione">Budget <button data-a="formBudget">${ic("piu")} Nuovo</button></div>
  ${budgets.length ? budgets.map(b => cardBudget(b, false, K.nomePeriodo(b) + (b.cats?.length ? " · " + b.cats.map(c => K.categoria(c).nome).join(", ") : " · tutte le spese"))).join("")
    : `<div class="card">${vuoto("Nessun budget", "Crea un budget per la settimana, il mese, due mesi o un anno: anche solo per alcune categorie.")}</div>`}
  <div class="sezione">Abbonamenti e spese fisse <button data-a="nuovo" data-tipo="u" data-rip="1m">${ic("piu")} Nuovo</button></div>
  <div class="card lista">${ab.length ? ab.map(rigaRic).join("") + `<div class="mov" style="justify-content:space-between"><span class="sotto">Al mese ${K.euro(totAb)}</span><span class="sotto">All'anno <b style="color:var(--inchiostro)">${K.euro(totAb * 12)}</b></span></div>`
    : vuoto("Nessun abbonamento", "Netflix, affitto, palestra: segnali una volta e li conto io ogni mese.")}</div>
  <div class="sezione">Entrate che si ripetono <button data-a="nuovo" data-tipo="e" data-rip="1m">${ic("piu")} Nuova</button></div>
  <div class="card lista">${en.length ? en.map(rigaRic).join("") + `<div class="mov"><span class="sotto">Circa ${K.euro(totEn)} al mese</span></div>`
    : vuoto("Nessun giorno di paga", "Un cliente fisso, uno stipendio: il giorno giusto ti chiedo se sono arrivati.")}</div>
  <div class="sezione">Spese ed entrate future <button data-a="nuovo" data-data="${K.addG(K.oggi(), 7)}">${ic("piu")} Nuova</button></div>
  <div class="card lista">${future.length ? future.map(m => rigaMov(m)).join("") : vuoto("Niente in programma", "Un regalo, una vacanza, una fattura da incassare: segnala con la sua data.")}</div>`;
}

// ================= BUSTE E OBIETTIVI =================
// Scelte dell'utente (2026-11-04): buste = divisioni dello stesso conto; obiettivi = salvadanai di porcellana che si rompono.
const tondoBusta = (b, dim = 42) => `<div class="tondo2" style="background:${b.colore || K.COLORI_BUSTE[0]};width:${dim}px;height:${dim}px">${ic(b.icona || "portafoglio")}</div>`;
// Salvadanaio = porcellino (disegno scelto dall'utente il 2026-11-05, muso smussato). Il contorno intero è disegnato due volte,
// ognuna ritagliata a metà (clipPath): da intero non si vede la giuntura, quando si rompe le due metà si separano.
const PORCELLINO = "M27 19C34 15 49 15 56 24C63 31 63 44 57 50L55 59H48L47 54Q39 56 31 54L30 59H23L21 50C18 48 16 46 16 44H10Q7 44 7 41V35Q7 32 10 32H16C17 29 18 27 20 25L15 14Q21 15 27 19Z";
function vaso(s, dim = 74, rotto = false) {
  const col = s.colore || "#2F6B4F", saldo = s.id ? K.saldoSalvadanaio(s.id) : 0, q = s.obiettivo ? Math.min(1, saldo / s.obiettivo) : 0, h = 41 * q, id = "v" + (s.id || "n") + dim;
  const st = `stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
  const meta = n => `<path d="${PORCELLINO}" fill="var(--bianco)" ${st} clip-path="url(#${id}${n})"/>`;
  return `<div class="vaso ${rotto ? "rotto" : ""}" style="width:${dim}px;height:${dim}px"><svg viewBox="0 0 74 74" style="width:${dim}px;height:${dim}px">
    <defs><clipPath id="${id}"><path d="${PORCELLINO}"/></clipPath><clipPath id="${id}a"><rect x="0" y="0" width="37" height="74"/></clipPath><clipPath id="${id}b"><rect x="37" y="0" width="37" height="74"/></clipPath></defs>
    <g class="pezzo1">${meta("a")}<circle cx="21.5" cy="30.5" r="1.7" fill="${col}"/></g>
    <g class="pezzo2"><path d="M61.5 35c3-.5 5-3.5 3.2-5.6-1.6-1.6-4 .6-2.3 2.2 1.5 1.3 4 .4 5.2-1.6" fill="none" ${st}/>${meta("b")}</g>
    <rect x="0" y="${59 - h}" width="74" height="${h}" fill="${col}" opacity=".22" clip-path="url(#${id})" class="livello"/>
    <path class="tappo" d="M34 21.5Q41.5 18.5 49 21.5" fill="none" ${st}/>
    <path class="crepa" d="M37 18l-3 9 5 7-4 8 3 7" fill="none" stroke="${col}" stroke-width="1.5"/>
    <svg x="31" y="29" width="18" height="18" viewBox="0 0 24 24" class="i" style="color:${col}">${ic(s.icona || "obiettivo").replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg></svg></div>`;
}
function sottoSal(s) {
  const saldo = K.saldoSalvadanaio(s.id);
  if (!s.obiettivo) return "messi da parte";
  if (saldo >= s.obiettivo) return "obiettivo raggiunto!";
  let t = `di ${K.euro(s.obiettivo)}`;
  if (s.entro) { const mesi = Math.max(1, Math.round(K.diffG(K.oggi(), s.entro) / 30.44));
    t += ` · entro ${K.dataBella(s.entro)} · ${K.euro(Math.ceil((s.obiettivo - saldo) / mesi / 100) * 100)} al mese`; }
  return t;
}
const raggiunto = s => s.obiettivo && K.saldoSalvadanaio(s.id) >= s.obiettivo;
function busteHtml() {
  const vista = U.vistaSoldi || "buste", saldi = K.saldiBuste(), dist = K.distribuzione(), lb = K.buste();
  const seg = `<div class="seg" style="margin-top:12px;--acc:var(--verde)"><div class="cursore" style="width:calc(50% - 3px);transform:translateX(${vista === "obiettivi" ? 100 : 0}%)"></div>
    <button class="${vista === "buste" ? "on" : ""}" data-a="vistaSoldi" data-id="buste">Buste</button><button class="${vista === "obiettivi" ? "on" : ""}" data-a="vistaSoldi" data-id="obiettivi">Obiettivi</button></div>`;
  if (vista === "obiettivi") {
    const lista = K.salvadanai(), rotti = K.tuttiObiettivi().filter(s => s.rotto).sort((a, b) => b.rotto.quando.localeCompare(a.rotto.quando));
    return `<div class="testa"><span class="data">Messi da parte · ${K.euro(K.totaleSalvadanai())}</span>
      <button class="tondo verde" data-a="formSal" aria-label="Nuovo obiettivo">${ic("piu")}</button></div>
    <div class="h1">I tuoi soldi</div>${seg}
    ${lista.map(s => { const fatto = raggiunto(s);
      return `<div class="card porc ${fatto ? "raggiunto" : ""}" data-a="apriSal" data-id="${s.id}">${vaso(s)}<div style="flex:1;min-width:0"><div class="titolo">${esc(s.nome)}</div>
        <div class="quanto">${K.euro(K.saldoSalvadanaio(s.id))} ${s.obiettivo ? `<span class="sotto">di ${K.euro(s.obiettivo)}</span>` : ""}</div>
        <div class="sotto">${s.entro && !fatto ? esc(sottoSal(s).replace(/^di [^·]*· /, "")) : fatto ? "Ce l'hai fatta!" : ""}</div>
        <div class="bottoni" style="margin-top:8px">${fatto ? `<button class="btn oro btnPiccolo" data-a="rompi" data-id="${s.id}">Raggiunto! Rompi</button>`
          : `<button class="btn chiaro btnPiccolo" data-a="apriSal" data-id="${s.id}">${ic("piu")} Metti</button><button class="btn chiaro btnPiccolo" data-a="rompi" data-id="${s.id}">Rinuncia</button>`}</div></div></div>`; }).join("")}
    ${!lista.length ? `<div class="card">${vuoto("Nessun obiettivo", "Un viaggio, un regalo, un fondo per gli imprevisti: crea un salvadanaio di porcellana e riempilo.")}</div>` : ""}
    <button class="card" data-a="formSal" style="border-style:dashed;background:none">${vuoto("Un nuovo obiettivo", "I soldi degli obiettivi non si spendono: per usarli rompi il salvadanaio.")}</button>
    ${rotti.length ? `<div class="sezione">Rotti</div><div class="card lista">${rotti.map(s => `<div class="mov"><div class="ico ${s.rotto.esito === "rinuncia" ? "" : "oro"}">${ic(s.icona || "obiettivo")}</div>
      <div class="nome"><div>${esc(s.nome)}</div><div class="sotto">${s.rotto.esito === "rinuncia" ? "rinunciato" : s.rotto.esito === "speso" ? "raggiunto e speso" : "raggiunto"} · ${K.dataBella(s.rotto.quando.slice(0, 10))}</div></div>
      <span class="imp v">${K.euro(s.rotto.importo || 0)}</span><button class="tondo" style="width:30px;height:30px;margin-left:6px" data-a="eliminaRotto" data-id="${s.id}" aria-label="Togli">${ic("chiudi")}</button></div>`).join("")}</div>` : ""}`;
  }
  return `<div class="testa"><span class="data">Disponibile · ${K.euro(K.disponibile())}</span>
    <button class="tondo verde" data-a="formBusta" aria-label="Nuova busta">${ic("piu")}</button></div>
  <div class="h1">I tuoi soldi</div>${seg}
  <div class="card" style="display:flex;align-items:center;gap:10px;padding:12px 14px">
    <button style="display:flex;align-items:center;gap:10px;flex:1;text-align:left;min-width:0" data-a="dividi"><span style="color:var(--verde)">${ic("ripeti")}</span>
    <span style="flex:1;font-size:13px;min-width:0"><b style="font-weight:600">Dividi la paga</b><span class="sotto" style="display:block">${dist.attiva
      ? lb.filter(b => dist.pct[b.id] > 0).map(b => `${esc(b.nome)} ${dist.pct[b.id]}%`).join(" · ") || "scegli le percentuali" : "spenta: le entrate vanno dove scegli"}</span></span></button>
    <label class="interruttore" style="padding:0"><input type="checkbox" data-campo="distAttiva" ${dist.attiva ? "checked" : ""}></label></div>
  ${lb.map(b => { const bud = K.budgets().find(x => x.busta === b.id), st = bud ? K.statoBudget(bud) : null;
    return `<button class="card busta" data-a="formBusta" data-id="${b.id}">${tondoBusta(b)}<div class="info"><div class="titolo">${esc(b.nome)}</div>
      <div class="q">${K.euro(saldi[b.id] || 0)}</div>${st ? `<div class="barra mini"><i class="${st.quota >= .8 ? "attenzione" : ""}" data-larg="${Math.min(100, st.quota * 100)}%"></i></div>
      <div class="sotto" style="margin-top:4px">${esc(bud.nome)}: restano ${K.euro(st.resta)} di ${K.euro(st.totale)}</div>` : ""}</div>
      ${dist.attiva && dist.pct[b.id] ? `<span class="pct">${dist.pct[b.id]}%</span>` : ""}</button>`; }).join("")}
  <div class="bottoni">${lb.length > 1 ? `<button class="btn chiaro" data-a="sposta">${ic("ripeti")} Sposta soldi</button>` : ""}<button class="btn chiaro" data-a="formBusta">${ic("piu")} Nuova busta</button></div>
  <p class="nota" style="text-align:center">Le buste dividono lo stesso conto in banca: la loro somma è sempre il tuo disponibile.</p>`;
}

// ================= FOGLI =================
function apriFoglio(fn, cls = () => "") { U.foglio = { fn, cls }; disegnaFoglio(true); }
function disegnaFoglio(nuovo = false) {
  const s = $("#strato");
  if (!U.foglio) { s.innerHTML = ""; return; }
  const dentro = U.foglio.fn();
  s.innerHTML = `<div class="velo" data-a="chiudiFoglio" style="${nuovo ? "" : "animation:none"}"></div>
    <div class="foglio ${U.foglio.cls()}" style="${nuovo ? "" : "animation:none"}"><div class="maniglia"></div>${dentro}</div>`;
  dopoDisegno();
  const cat = s.querySelector(".cat"), on = cat?.querySelector(".on");
  if (on && nuovo) cat.scrollLeft = on.offsetLeft - cat.clientWidth / 2 + on.offsetWidth / 2;
  programma();
}
function chiudiFoglio() {
  const f = $("#strato .foglio"), v = $("#strato .velo");
  U.foglio = null; U.f = null;
  if (!f) return;
  f.classList.add("via"); f.style.pointerEvents = v.style.pointerEvents = "none"; v.style.transition = "opacity .3s"; v.style.opacity = 0;
  setTimeout(() => { if (!U.foglio) $("#strato").innerHTML = ""; }, 290);
}
const testaFoglio = (titolo, dx = "", azioneDx = "") => `<div class="testaFoglio">${azioneDx === "chiudiFoglio" ? '<span class="lato"></span>' : '<button class="lato" data-a="chiudiFoglio">Annulla</button>'}<h2>${titolo}</h2>
  ${dx ? `<button class="lato dx" data-a="${azioneDx}">${dx}</button>` : '<span class="lato"></span>'}</div>`;

// ---------- tastierino ----------
const tasti = () => `<div class="tasti">${["1", "2", "3", "4", "5", "6", "7", "8", "9", ","].map(k => `<button data-a="tasto" data-k="${k}">${k}</button>`).join("")}
  <button data-a="tasto" data-k="0">0</button><button data-a="tasto" data-k="canc" aria-label="Cancella">${ic("cancella")}</button></div>`;
const mostraNp = np => (np || "0") + " €";
function premi(k) {
  let s = U.f.np || "";
  if (k === "canc") s = s.slice(0, -1);
  else if (k === ",") { if (!s.includes(",")) s += (s ? "" : "0") + ","; }
  else if (!k) { /* solo aggiorna */ }
  else if (s.includes(",") ? s.split(",")[1].length < 2 : s.replace(/^0/, "").length < 7) s = (s === "0" ? "" : s) + k;
  U.f.np = s;
  const el = $("#strato .importo") || $(".benvenuto .importo"); if (el) el.textContent = mostraNp(s);
  const b = $("#strato .salva") || $(".benvenuto .salva"); if (b) b.disabled = !(K.cent(s || "0") > 0) && !U.f.zeroOk;
}
const npDa = c => c % 100 ? (c / 100).toFixed(2).replace(".", ",") : String(c / 100);

// ---------- aggiungi / modifica movimento ----------
function primaCat(tipo) { return K.categorie(tipo)[0]?.id; }
function nuovoMov({ tipo = "u", data = K.oggi(), rip = null } = {}) {
  U.f = { modo: "nuovo", tipo, np: "", desc: "", cat: primaCat(tipo), data, rip, conferma: true, vista: "mov", avviso: null };
  U.f.busta = bustaPredefinita(tipo, U.f.cat); U.f.nelBudget = true;
  apriFoglio(foglioMov, () => U.f?.tipo === "u" ? "u" : "");
}
function apriMov(id) {
  const m = K.trovaMov(id);
  if (!m) return;
  if (m.tipo === "v" || m.tipo === "r" || m.tipo === "t") { U.f = { modo: "semplice", m }; return apriFoglio(foglioSemplice, () => ""); }
  U.f = { modo: m.ric ? "occ" : "mod", id: m.id, ric: m.ric, tipo: m.tipo, np: npDa(m.importo), desc: m.desc || "", cat: m.cat, data: m.data,
    rip: null, atteso: m.stato === "atteso", vista: "mov", avviso: m.avviso || null, bustaScelta: true, nelBudget: !m.fuoriBudget,
    busta: m.divisione ? "dividi" : m.busta || (m.tipo === "e" && m.stato === "atteso" ? bustaPredefinita("e") : "principale") };
  apriFoglio(foglioMov, () => U.f?.tipo === "u" ? "u" : "");
}
function apriRic(id) {
  const r = D.leggi("ric:" + id);
  if (!r) return;
  const d = K.prossima(r) || r.inizio;
  U.f = { modo: "ric", id, tipo: r.tipo, np: npDa(r.importo), desc: r.desc || "", cat: r.cat, data: d, dataOrig: d,
    rip: { ogni: r.ogni, unita: r.unita }, conferma: !r.auto, vista: "mov", avviso: r.avviso || null, busta: r.busta || "principale", bustaScelta: true, nelBudget: !r.fuoriBudget };
  apriFoglio(foglioMov, () => U.f?.tipo === "u" ? "u" : "");
}
function foglioMov() {
  const f = U.f;
  if (f.vista === "ripeti") return foglioRipeti();
  if (f.vista === "nuovaCat") return foglioCategoria();
  if (f.vista === "avviso") return foglioAvviso();
  const cats = K.categorie(f.tipo);
  if (f.cat && !cats.some(c => c.id === f.cat)) cats.unshift(K.categoria(f.cat));
  const o = K.oggi(), dataTxt = f.data === o ? "Oggi" : K.dataBella(f.data)[0].toUpperCase() + K.dataBella(f.data).slice(1);
  const rip = f.modo === "occ" ? D.leggi("ric:" + f.ric) : f.rip;
  const titoloSalva = f.atteso ? "Conferma" : f.modo === "nuovo" ? (f.tipo === "u" ? "Salva uscita" : "Salva entrata") : "Salva";
  return `
  <div class="seg"><div class="cursore" style="width:calc(50% - 3px);transform:translateX(${f.tipo === "e" ? 100 : 0}%)"></div>
    <button class="${f.tipo === "u" ? "on" : ""}" data-a="tipo" data-id="u">Uscita</button><button class="${f.tipo === "e" ? "on" : ""}" data-a="tipo" data-id="e">Entrata</button></div>
  <div class="importo">${mostraNp(f.np)}</div>
  <label class="campo">${ic("matita")}<input data-campo="desc" value="${esc(f.desc)}" placeholder="Cos'è? es. ${f.tipo === "u" ? "Cena con Marco" : "Fattura Rossi"}" enterkeyhint="done" autocomplete="off"></label>
  ${K.buste().length > 1 ? `<div id="chipBusta">${chipBuste(f.busta, "fBusta", { dividi: f.tipo === "e" })}</div>` : ""}
  <div class="cat">${cats.map(c => `<button class="${c.id === f.cat ? "on" : ""}" data-a="cat" data-id="${c.id}"><b>${ic(c.icona)}</b>${esc(c.nome)}</button>`).join("")}
    <button data-a="vista" data-id="nuovaCat"><b class="tratteggio">${ic("piu")}</b>Nuova</button>
    <button data-a="modCatScelta"><b class="tratteggio">${ic("matita")}</b>Modifica</button></div>
  <div class="opz"><label class="${f.data !== o ? "attivo" : ""}">${ic("calendario")}<span>${dataTxt}</span><input type="date" data-campo="data" value="${f.data}"></label>
    <button class="${rip ? "attivo" : ""}" data-a="${f.modo === "occ" ? "apriRicDaOcc" : "vista"}" data-id="ripeti">${ic("ripeti")}<span>${K.nomeRipeti(rip)}</span></button>
    ${f.tipo === "u" && f.modo !== "occ" && (f.rip || f.data > o) ? `<button class="${f.avviso ? "attivo" : ""}" data-a="vista" data-id="avviso">${ic("campanella")}<span>${K.nomeAvviso(f.avviso, true)}</span></button>` : ""}</div>
  ${f.tipo === "u" && K.budgets().length ? `<label class="interruttore piccolo">Conta nel budget<input type="checkbox" data-campo="nelBudget" ${f.nelBudget ? "checked" : ""}></label>` : ""}
  ${f.rip && f.tipo === "e" && f.modo !== "occ" ? `<label class="interruttore" style="padding:8px 2px 0;font-size:13px">Chiedimi conferma quando arriva<input type="checkbox" data-campo="conferma" ${f.conferma ? "checked" : ""}></label>` : ""}
  ${tasti()}
  <button class="salva" data-a="salvaMov" ${K.cent(f.np || "0") > 0 ? "" : "disabled"}>${titoloSalva}</button>
  ${f.modo !== "nuovo" ? `<button class="elimina" data-a="eliminaMov">${ic("cestino")} ${f.atteso ? "Non sono arrivati" : f.modo === "ric" ? "Interrompi la ricorrenza" : "Elimina"}</button>` : ""}`;
}
function foglioRipeti() {
  const f = U.f, r = f.rip, scelte = [[null, "Non si ripete"], [{ ogni: 1, unita: "s" }, "Ogni settimana"], [{ ogni: 2, unita: "s" }, "Ogni 2 settimane"],
    [{ ogni: 1, unita: "m" }, "Ogni mese"], [{ ogni: 2, unita: "m" }, "Ogni 2 mesi"], [{ ogni: 3, unita: "m" }, "Ogni 3 mesi"], [{ ogni: 6, unita: "m" }, "Ogni 6 mesi"], [{ ogni: 1, unita: "a" }, "Ogni anno"]];
  const uguale = (a, b) => (!a && !b) || (a && b && a.ogni === b.ogni && a.unita === b.unita);
  const personal = r && !scelte.some(([s]) => uguale(s, r));
  return `<div class="testaFoglio"><button class="lato" data-a="vista" data-id="mov">${ic("indietro")}</button><h2>Si ripete?</h2><button class="lato dx" data-a="vista" data-id="mov">Fatto</button></div>
  <div class="dentro"><div class="lista card" style="margin-top:0">${scelte.map(([s, t], i) => `<button class="mov" data-a="sceltaRip" data-id="${i}"><div class="nome">${t}</div>${uguale(s, r) ? `<span style="color:var(--acc)">${ic("spunta")}</span>` : ""}</button>`).join("")}</div>
  <span class="etichettaCampo">Oppure scegli tu</span>
  <div class="dueCampi"><label class="campo">Ogni<input type="number" inputmode="numeric" min="1" max="99" data-campo="ripOgni" value="${personal ? r.ogni : ""}" placeholder="N"></label>
    <label class="campo"><select data-campo="ripUnita">${Object.entries(K.UNITA).map(([u, [, piu]]) => `<option value="${u}" ${personal && r.unita === u ? "selected" : u === "g" && !personal ? "selected" : ""}>${piu}</option>`).join("")}</select></label></div>
  <p class="nota">La prima volta è la data che hai scelto (${K.dataBella(f.data)}). Le uscite che si ripetono le conto io in automatico; per le entrate posso chiederti conferma.</p>
  <button class="salva" data-a="vista" data-id="mov">Fatto</button></div>`;
}
const SCELTE_AVVISO = [[-1, "Nessun avviso"], [0, "Il giorno stesso"], [1, "1 giorno prima"], [2, "2 giorni prima"], [3, "3 giorni prima"], [5, "5 giorni prima"], [7, "Una settimana prima"]];
function foglioAvviso() {
  const f = U.f, perTutti = f.modo === "categorie", av = (perTutti ? K.avvisoPredefinito() : f.avviso) || K.avvisoPredefinito(), indietro = perTutti ? "" : "mov";
  return `<div class="testaFoglio"><button class="lato" data-a="${perTutti ? "vistaImp" : "vista"}" data-id="${indietro}">${ic("indietro")}</button><h2>Quando ti avviso?</h2>
    <button class="lato dx" data-a="${perTutti ? "vistaImp" : "vista"}" data-id="${indietro}">Fatto</button></div>
  <div class="dentro"><p class="nota" style="margin:0 2px 10px">${perTutti ? "Vale per tutti gli abbonamenti e le spese previste, tranne quelli in cui scegli diversamente."
    : "Ti arriva una notifica prima dell'addebito, così controlli di avere i soldi sulla carta."}</p>
  <div class="lista card" style="margin-top:0">${SCELTE_AVVISO.map(([g, t]) => `<button class="mov" data-a="sceltaAvv" data-id="${g}"><div class="nome">${t}</div>${av.giorni === g ? `<span style="color:var(--acc)">${ic("spunta")}</span>` : ""}</button>`).join("")}</div>
  ${av.giorni >= 0 ? `<span class="etichettaCampo">A che ora</span><label class="campo">${ic("orologio")}<input type="time" data-campo="avvOra" value="${av.ora}" step="300"></label>` : ""}
  ${!perTutti && f.avviso ? `<button class="saltaLink" style="display:block;margin:8px auto 0" data-a="avvBase">Usa quello predefinito (${esc(K.nomeAvviso(null))})</button>` : ""}
  <button class="salva" style="margin-top:14px" data-a="${perTutti ? "vistaImp" : "vista"}" data-id="${indietro}">Fatto</button></div>`;
}
function scriviAvviso(nuovo) {
  const f = U.f;
  if (f.modo === "categorie") D.scrivi("profilo", { ...clona(K.profilo()), avviso: nuovo });
  else f.avviso = nuovo;
  disegnaFoglio();
}
function foglioCategoria() {
  const f = U.f, nc = f.nc ||= { nome: "", icona: "scintilla" };
  return `<div class="testaFoglio"><button class="lato" data-a="vista" data-id="${f.modo === "categorie" ? "elenco" : "mov"}">${ic("indietro")}</button><h2>${nc.id ? "Categoria" : "Nuova categoria"}</h2>
    <button class="lato dx" data-a="salvaCat">Salva</button></div>
  <div class="dentro"><label class="campo">${ic(nc.icona)}<input data-campo="ncNome" value="${esc(nc.nome)}" placeholder="Nome, es. Libri" autocomplete="off"></label>
  <span class="etichettaCampo">Icona</span>
  <div class="griglia">${Object.keys(NOMI).map(n => `<button class="${n === nc.icona ? "on" : ""}" data-a="ncIcona" data-id="${n}" aria-label="${NOMI[n]}">${ic(n)}</button>`).join("")}</div>
  ${nc.id ? `<label class="interruttore" style="margin-top:8px">Nascondi quando aggiungo<input type="checkbox" data-campo="ncNascosta" ${nc.nascosta ? "checked" : ""}></label>
    <button class="elimina" data-a="eliminaCat">${ic("cestino")} ${K.CATEGORIE.some(c => c.id === nc.id) ? "Togli dall'elenco" : "Elimina la categoria"}</button>
    <p class="nota" style="text-align:center;margin-top:0">I movimenti già segnati restano, sotto «Altro».</p>` : ""}
  <button class="salva" style="margin-top:14px" data-a="salvaCat">Salva</button></div>`;
}
function foglioSemplice() {
  const m = U.f.m, s = m.tipo === "v" ? D.leggi("sal:" + m.sal) : null;
  if (m.tipo === "t") return `${testaFoglio("Spostamento")}<div class="importo" style="color:var(--verde)">${K.euro(m.importo)}</div>
  <p class="nota" style="text-align:center">${esc(K.busta(m.da).nome)} → ${esc(K.busta(m.a).nome)} · ${K.dataBella(m.data, { lunga: true })}</p>
  <button class="elimina" data-a="eliminaSemplice">${ic("cestino")} Annulla lo spostamento</button>`;
  return `${testaFoglio(m.tipo === "v" ? "Obiettivo" : "Saldo corretto")}
  <div class="importo" style="color:var(--oro)">${m.importo >= 0 ? "" : "−"}${K.euro(Math.abs(m.importo))}</div>
  <p class="nota" style="text-align:center">${m.tipo === "v" ? (m.importo >= 0 ? "Messi in " : "Presi da ") + esc(s?.nome || "un salvadanaio") : "Correzione del disponibile"} · ${K.dataBella(m.data, { lunga: true })}</p>
  <button class="elimina" data-a="eliminaSemplice">${ic("cestino")} Elimina</button>`;
}

function salvaMov() {
  const f = U.f, importo = K.cent(f.np || "0");
  if (importo <= 0) { const el = $("#strato .importo"); el?.classList.remove("scuoti"); void el?.offsetWidth; el?.classList.add("scuoti"); return; }
  const o = K.oggi(), p = K.profilo(), desc = f.desc.trim(), prima = statiBudget();
  if (f.modo === "nuovo" && f.rip) {
    const id = K.nuovoId();
    D.scrivi("ric:" + id, { id, tipo: f.tipo, importo, desc, cat: f.cat, inizio: f.data, dal: f.data > p.dal ? f.data : p.dal,
      ogni: f.rip.ogni, unita: f.rip.unita, auto: f.tipo === "e" ? !f.conferma : true, avviso: f.tipo === "u" ? f.avviso : null, busta: f.busta, fuoriBudget: f.tipo === "u" && !f.nelBudget, creato: adesso() });
  } else if (f.modo === "nuovo") {
    const id = K.nuovoId();
    D.scrivi("mov:" + id, { id, tipo: f.tipo, importo, desc, cat: f.cat, data: f.data, atteso: f.tipo === "e" && f.data > o,
      avviso: f.tipo === "u" && f.data > o ? f.avviso : null, ...bustaDi(f, importo, f.tipo === "e" && f.data > o), fuoriBudget: f.tipo === "u" && !f.nelBudget, creato: adesso() });
  } else if (f.modo === "mod") {
    const m = clona(D.leggi("mov:" + f.id));
    Object.assign(m, { tipo: f.tipo, importo, desc, cat: f.cat, data: f.data, atteso: f.tipo === "e" && f.data > o, avviso: f.tipo === "u" ? f.avviso : null });
    delete m.divisione; Object.assign(m, bustaDi(f, importo, m.atteso), { fuoriBudget: f.tipo === "u" && !f.nelBudget });
    D.scrivi("mov:" + f.id, m);
  } else if (f.modo === "occ") {
    const v = D.leggi("mov:" + f.id), m = { ...(clona(v) || {}), id: f.id, ric: f.ric, tipo: f.tipo, importo, desc, cat: f.cat, data: f.data,
      atteso: f.tipo === "e" && f.data > o, creato: v?.creato || adesso() };
    delete m.saltato; delete m.divisione; Object.assign(m, bustaDi(f, importo, m.atteso), { fuoriBudget: f.tipo === "u" && !f.nelBudget });
    D.scrivi("mov:" + f.id, m);
  } else if (f.modo === "ric") {
    const r = clona(D.leggi("ric:" + f.id));
    materializza(r);
    if (!f.rip) { r.fine = o; }
    else Object.assign(r, { tipo: f.tipo, importo, desc, cat: f.cat, ogni: f.rip.ogni, unita: f.rip.unita, auto: f.tipo === "e" ? !f.conferma : true, avviso: f.tipo === "u" ? f.avviso : null, busta: f.busta, fuoriBudget: f.tipo === "u" && !f.nelBudget,
      dal: K.addG(o, 1), inizio: f.data !== f.dataOrig ? f.data : r.inizio });
    D.scrivi("ric:" + f.id, r);
  }
  const eraNuovo = f.modo === "nuovo", eraAtteso = f.atteso, tipo = f.tipo;
  chiudiFoglio();
  disegna();
  const allarme = controllaBudget(prima);
  if (allarme) festa(allarme.titolo, allarme.testo, true);
  else if (eraAtteso || (eraNuovo && tipo === "e" && f.data <= o)) festa(caso(K.FRASI_ENTRATA), `+${K.euro(importo)}`);
  else if (eraNuovo) festa(f.rip ? "Ci penso io." : "Fatto.", f.rip ? `${K.nomeRipeti(f.rip)}: lo segno da solo.` : caso(K.FRASI_SALVA));
  else toast("Salvato", true);
}
/** busta (e divisione, se l'entrata è già arrivata) da salvare in un movimento; ricorda la busta della categoria */
function bustaDi(f, importo, attesa) {
  if (f.tipo === "u" && K.buste().length > 1 && f.cat) { const mem = clona(D.leggi("memoria")) || {}; mem.bustaCat = { ...(mem.bustaCat || {}), [f.cat]: f.busta };
    if (D.leggi("memoria")?.bustaCat?.[f.cat] !== f.busta) D.scrivi("memoria", mem); }
  if (f.busta === "dividi") return attesa ? { busta: "dividi" } : { busta: "dividi", divisione: K.dividi(importo) };
  return { busta: f.busta || "principale" };
}
function materializza(r) {
  for (const d of K.occorrenze(r, r.dal || r.inizio, K.oggi())) {
    const id = `${r.id}@${d}`;
    if (D.leggi("mov:" + id)) continue;
    D.scrivi("mov:" + id, { id, ric: r.id, tipo: r.tipo, importo: r.importo, desc: r.desc, cat: r.cat, data: d, atteso: r.tipo === "e" && !r.auto, busta: r.busta,
      ...(r.busta === "dividi" && !(r.tipo === "e" && !r.auto) ? { divisione: K.dividi(r.importo) } : {}), creato: adesso() });
  }
}
function eliminaMov() {
  const f = U.f;
  if (f.modo === "mod") D.scrivi("mov:" + f.id, null);
  else if (f.modo === "occ") { const v = clona(D.leggi("mov:" + f.id)) || {}; const [, d] = f.id.split("@");
    D.scrivi("mov:" + f.id, { ...v, id: f.id, ric: f.ric, data: v.data || d, saltato: true, creato: v.creato || adesso() }); }
  else if (f.modo === "ric") {
    const r = clona(D.leggi("ric:" + f.id));
    if ((r.dal || r.inizio) > K.oggi()) D.scrivi("ric:" + f.id, null);
    else { materializza(r); r.fine = K.oggi(); D.scrivi("ric:" + f.id, r); }
  }
  const msg = f.atteso ? "Segnato come non arrivato" : f.modo === "ric" ? "Ricorrenza interrotta" : "Eliminato";
  chiudiFoglio(); disegna(); toast(msg, true);
}
function statiBudget() { return Object.fromEntries(K.budgets().map(b => [b.id, K.statoBudget(b).quota])); }
function controllaBudget(prima) {
  for (const b of K.budgets()) {
    const q0 = prima[b.id] ?? 0, s = K.statoBudget(b);
    if (q0 < 1 && s.quota >= 1) return { titolo: `${b.nome}: superato`, testo: `Sei oltre di ${K.euro(-s.resta)}. Respira: lo vedi, quindi lo governi.` };
    if (q0 < .8 && s.quota >= .8) return { titolo: `${b.nome}: ${Math.round(s.quota * 100)}%`, testo: `Restano ${K.euro(s.resta)} per ${s.giorniRestanti === 1 ? "oggi" : s.giorniRestanti + " giorni"}.` };
  }
  return null;
}

// ---------- budget ----------
function formBudget(id) {
  const b = id ? clona(D.leggi("bud:" + id)) : null;
  U.f = { modo: "budget", id, nome: b?.nome || "", np: b ? npDa(b.importo) : "", ogni: b?.ogni || 1, unita: b?.unita || "s", inizio: b?.inizio || null,
    cats: b?.cats || [], tutte: !b?.cats?.length, principale: b ? !!b.principale : !K.budgets().some(x => x.principale), busta: b?.busta || "" };
  apriFoglio(foglioBudget, () => "");
}
const inizioPredefinito = f => f.unita === "s" ? K.lunedi(K.oggi()) : f.unita === "m" ? K.primoMese(K.oggi()) : f.unita === "a" ? K.oggi().slice(0, 4) + "-01-01" : K.oggi();
function foglioBudget() {
  const f = U.f, per = [["1s", "Settimana"], ["1m", "Mese"], ["2m", "2 mesi"], ["3m", "3 mesi"], ["1a", "Anno"]];
  const chiave = f.ogni + f.unita, personal = !per.some(([k]) => k === chiave) || f.personal;
  const inizio = f.inizio || inizioPredefinito(f);
  return `${testaFoglio(f.id ? "Budget" : "Nuovo budget", "Salva", "salvaBudget")}
  <div class="dentro">
  <label class="campo">${ic("obiettivo")}<input data-campo="bNome" value="${esc(f.nome)}" placeholder="Nome, es. Spese della settimana" autocomplete="off"></label>
  <span class="etichettaCampo">Quanto puoi spendere</span>
  <label class="campo">${ic("monete")}<input data-campo="bImporto" inputmode="decimal" value="${esc(f.np)}" placeholder="250" autocomplete="off"><span>€</span></label>
  <span class="etichettaCampo">Ogni quanto riparte</span>
  <div class="scelte">${per.map(([k, t]) => `<button class="${k === chiave && !personal ? "on" : ""}" data-a="bPer" data-id="${k}">${t}</button>`).join("")}
    <button class="${personal ? "on" : ""}" data-a="bPer" data-id="pers">Scegli tu</button></div>
  ${personal ? `<div class="dueCampi" style="margin-top:8px"><label class="campo">Ogni<input type="number" inputmode="numeric" min="1" max="99" data-campo="bOgni" value="${f.ogni}"></label>
    <label class="campo"><select data-campo="bUnita">${Object.entries(K.UNITA).map(([u, [, piu]]) => `<option value="${u}" ${f.unita === u ? "selected" : ""}>${piu}</option>`).join("")}</select></label></div>` : ""}
  <div class="opz" style="margin-top:10px"><label class="attivo">${ic("calendario")}<span>Inizia ${K.dataBella(inizio, { lunga: true })}</span><input type="date" data-campo="bInizio" value="${inizio}"></label></div>
  ${K.buste().length > 1 ? `<span class="etichettaCampo">Quale busta</span><div class="chipBuste" style="flex-wrap:wrap;overflow:visible">
    <button class="${!f.busta ? "on" : ""}" data-a="bBusta" data-id="">Tutte</button>${K.buste().map(b => `<button class="${f.busta === b.id ? "on" : ""}" data-a="bBusta" data-id="${b.id}"><i style="background:${b.colore}"></i>${esc(b.nome)}</button>`).join("")}</div>` : ""}
  <label class="interruttore" style="margin-top:6px">Conta tutte le spese<input type="checkbox" data-campo="bTutte" ${f.tutte ? "checked" : ""}></label>
  ${f.tutte ? "" : `<div class="scelte">${K.categorie("u").map(c => `<button class="${f.cats.includes(c.id) ? "on" : ""}" data-a="bCat" data-id="${c.id}">${ic(c.icona)}${esc(c.nome)}</button>`).join("")}</div>`}
  <label class="interruttore">In evidenza nella schermata Oggi<input type="checkbox" data-campo="bPrinc" ${f.principale ? "checked" : ""}></label>
  <p class="nota">Ti avviso quando arrivi all'80% e quando lo superi. A fine periodo, se avanza qualcosa, scegli tu: lo riporti al periodo dopo o lo metti da parte.</p>
  ${f.id ? `<button class="elimina" data-a="eliminaBudget">${ic("cestino")} Elimina il budget</button>` : ""}</div>`;
}
function salvaBudget() {
  const f = U.f, importo = K.cent(f.np || "0");
  if (importo <= 0) return toast("Scrivi quanto puoi spendere");
  const id = f.id || K.nuovoId(), vecchio = f.id ? D.leggi("bud:" + id) : null;
  if (f.principale) K.budgets().filter(b => b.principale && b.id !== id).forEach(b => D.scrivi("bud:" + b.id, { ...clona(b), principale: false }));
  D.scrivi("bud:" + id, { id, nome: f.nome.trim() || (K.nomePeriodo({ ogni: f.ogni, unita: f.unita }) === "Settimanale" ? "Budget della settimana" : "Budget " + K.nomePeriodo({ ogni: f.ogni, unita: f.unita }).toLowerCase()),
    importo, ogni: Math.max(1, Number(f.ogni) || 1), unita: f.unita, inizio: f.inizio || inizioPredefinito(f), cats: f.tutte ? [] : f.cats, busta: f.busta || null,
    principale: f.principale, creato: vecchio?.creato || adesso() });
  chiudiFoglio(); disegna(); toast(f.id ? "Budget aggiornato" : "Budget creato", true);
}

// ---------- scelta della busta (nel + e altrove) ----------
function chipBuste(scelta, azione, { dividi = false, conSaldo = true } = {}) {
  const lb = K.buste(), saldi = K.saldiBuste(), d = K.distribuzione();
  const voci = (dividi && d.attiva ? [`<button class="${scelta === "dividi" ? "on" : ""}" data-a="${azione}" data-id="dividi"><i style="background:conic-gradient(${lb.filter(b => d.pct[b.id] > 0).map((b, i, l) => `${b.colore} ${i / l.length * 100}% ${(i + 1) / l.length * 100}%`).join(",") || "#999 0 100%"})"></i>Dividi</button>`] : [])
    .concat(lb.map(b => `<button class="${scelta === b.id ? "on" : ""}" data-a="${azione}" data-id="${b.id}"><i style="background:${b.colore}"></i>${esc(b.nome)}${conSaldo ? ` · ${K.euro(saldi[b.id] || 0, { decimali: false })}` : ""}</button>`));
  return `<div class="chipBuste">${voci.join("")}</div>`;
}
const bustaPerCat = cat => { const m = D.leggi("memoria")?.bustaCat?.[cat]; return m && K.buste().some(b => b.id === m) ? m : "principale"; };
function bustaPredefinita(tipo, cat) { return tipo === "e" ? (K.distribuzione().attiva ? "dividi" : "principale") : bustaPerCat(cat); }

// ---------- buste ----------
function formBusta(id) {
  const b = id ? K.busta(id) : null;
  U.f = { modo: "busta", id, nome: b?.nome || "", icona: b?.icona || "portafoglio", colore: b?.colore || K.COLORI_BUSTE[K.buste().length % K.COLORI_BUSTE.length] };
  apriFoglio(foglioBusta, () => "");
}
const coloriHtml = f => `<div class="colori">${K.COLORI_BUSTE.map(c => `<button class="${c === f.colore ? "on" : ""}" data-a="fCol" data-id="${c}" style="background:${c}" aria-label="colore"></button>`).join("")}</div>`;
const iconeHtml = f => GRUPPI.map(([t, l]) => `<div class="gruppoT">${t}</div><div class="icone6">${l.map(([n, nome]) =>
  `<button class="${n === f.icona ? "on" : ""}" data-a="fIcona" data-id="${n}" aria-label="${nome}">${ic(n)}</button>`).join("")}</div>`).join("");
function foglioBusta() {
  const f = U.f, recenti = f.id ? K.movimenti(K.addM(K.oggi(), -3), K.oggi()).filter(m => m.stato === "fatto" && K.perBusta(m)[f.id]).slice(0, 6) : [];
  return `<div class="testaFoglio" style="--col:${f.colore}"><button class="lato" data-a="chiudiFoglio">Annulla</button><h2></h2><button class="lato dx" style="color:${f.colore}" data-a="salvaBusta">Salva</button></div>
  <div class="dentro" style="--col:${f.colore}">
    <div class="testaSal"><div class="bollo">${ic(f.icona)}</div>
      <input class="nomeGrande" data-campo="fNome" value="${esc(f.nome)}" placeholder="Nome della busta, es. Sfizi" autocomplete="off">${coloriHtml(f)}
      ${f.id ? `<div class="sotto" style="margin-top:8px">Dentro ci sono ${K.euro(K.saldiBuste()[f.id] || 0)}</div>` : ""}</div>
    ${recenti.length ? `<div class="gruppoT">Ultimi movimenti</div><div class="card lista" style="margin-top:0">${recenti.map(m => rigaMov(m)).join("")}</div>` : ""}
    ${iconeHtml(f)}
    ${f.id && f.id !== "principale" ? `<button class="elimina" data-a="eliminaBusta">${ic("cestino")} Elimina la busta</button>
      <p class="nota" style="text-align:center;margin-top:0">I soldi dentro tornano in Principale.</p>` : ""}
    <div class="salvaBasso"><button class="salva" style="background:${f.colore}" data-a="salvaBusta">${f.id ? "Salva" : "Crea la busta"}</button></div></div>`;
}
function salvaBusta() {
  const f = U.f, nome = f.nome.trim();
  if (!nome) return toast("Dagli un nome");
  const id = f.id || K.nuovoId(), v = clona(D.leggi("busta:" + id)) || { id, creato: adesso(), iniziale: 0, ordine: K.buste().length };
  D.scrivi("busta:" + id, { ...v, id, nome, icona: f.icona, colore: f.colore });
  chiudiFoglio(); disegna(); toast(f.id ? "Busta salvata" : "Busta creata", true);
}

// ---------- sposta soldi tra buste ----------
function foglioSposta() {
  const f = U.f, saldi = K.saldiBuste();
  return `${testaFoglio("Sposta soldi")}
  <span class="etichettaCampo" style="margin-top:0">Da</span>${chipBuste(f.da, "sDa")}
  <span class="etichettaCampo">A</span>${chipBuste(f.a, "sA")}
  <div class="importo" style="color:var(--verde)">${mostraNp(f.np)}</div>
  <p class="nota" style="text-align:center;margin:0">in ${esc(K.busta(f.da).nome)} ci sono ${K.euro(saldi[f.da] || 0)}</p>
  ${tasti()}<button class="salva" style="background:var(--verde)" data-a="salvaSposta" disabled>Sposta</button>`;
}

// ---------- dividi la paga ----------
function foglioDividi() {
  const d = K.distribuzione(), lb = K.buste(), tot = lb.reduce((t, b) => t + (d.pct[b.id] || 0), 0);
  return `<div class="testaFoglio"><span class="lato"></span><h2>Dividi la paga</h2><button class="lato dx" data-a="chiudiFoglio">Fatto</button></div>
  <div class="dentro">
    <label class="interruttore" style="padding-top:0">Distribuzione automatica<input type="checkbox" data-campo="distAttiva" ${d.attiva ? "checked" : ""}></label>
    ${d.attiva ? `<p class="nota" style="margin-top:0">Quando segni o confermi un'entrata, la divido così tra le buste. Prima di salvare puoi sempre scegliere una busta sola.</p>
    <div class="blocco">${lb.map(b => `<div class="cursoreP" style="--c:${b.colore}"><span class="n">${esc(b.nome)}</span>
      <input type="range" min="0" max="100" step="5" value="${d.pct[b.id] || 0}" data-campo="pct" data-id="${b.id}"><b>${d.pct[b.id] || 0}%</b></div>`).join("")}</div>
    <div class="somma ${tot === 100 ? "" : "male"}"><span>Totale</span><b>${tot}%${tot === 100 ? " ✓" : tot < 100 ? " · manca " + (100 - tot) + "%" : " · troppo di " + (tot - 100) + "%"}</b></div>
    ${tot !== 100 && tot > 0 ? `<p class="nota">Se non arrivi a 100%, divido in proporzione.</p>` : ""}
    <span class="etichettaCampo">Su una paga di 1.000 €</span>
    <div class="esempio">${Object.entries(K.dividi(100000, d.pct)).map(([id, v]) => `<div style="flex-grow:${v};background:${K.busta(id).colore}">${K.euro(v, { decimali: false })}</div>`).join("")}</div>
    <button class="btn chiaro pieno" data-a="formBusta">${ic("piu")} Aggiungi una busta</button>`
    : `<div class="card" style="text-align:center">${ic("portafoglio")}<p style="font-family:var(--serif);font-size:17px;margin-top:6px">Una busta alla volta</p>
      <p class="sotto">Le entrate vanno al 100% nella busta che scegli quando le segni. Riaccendi quando vuoi: le percentuali restano salvate.</p></div>`}
  </div>`;
}
function scriviDistribuzione(cambia) {
  const p = clona(K.profilo()), d = p.distribuzione || { attiva: false, pct: {} };
  if (!Object.keys(d.pct).length) d.pct = { principale: 100 };
  cambia(d); p.distribuzione = d; D.scrivi("profilo", p);
}

// ---------- obiettivi (salvadanai di porcellana) ----------
const ENTRO = [["", "Nessuna data"], ["3", "3 mesi"], ["6", "6 mesi"], ["12", "1 anno"]];
function formSal(id) {
  const s = id ? D.leggi("sal:" + id) : null;
  U.f = { modo: "sal", id, nome: s?.nome || "", icona: s?.icona || "obiettivo", colore: s?.colore || K.COLORI_BUSTE[(K.salvadanai().length + 2) % 5],
    obiettivo: s?.obiettivo ? npDa(s.obiettivo) : "", entro: s?.entro || "", entroK: s?.entro ? "sc" : "" };
  apriFoglio(foglioFormSal, () => "");
}
function foglioFormSal() {
  const f = U.f, o = K.cent(f.obiettivo || "0"), mesi = f.entro ? Math.max(1, Math.round(K.diffG(K.oggi(), f.entro) / 30.44)) : 0;
  const giaDentro = f.id ? K.saldoSalvadanaio(f.id) : 0;
  return `<div class="testaFoglio"><button class="lato" data-a="chiudiFoglio">Annulla</button><h2></h2><button class="lato dx" style="color:${f.colore}" data-a="salvaSal">Salva</button></div>
  <div class="dentro" style="--col:${f.colore}">
    <div class="testaSal"><div class="bollo">${ic(f.icona)}</div>
      <input class="nomeGrande" data-campo="fNome" value="${esc(f.nome)}" placeholder="Per cosa metti da parte?" autocomplete="off">${coloriHtml(f)}</div>
    <div class="blocco">
      <div class="rigaB"><span class="et">Obiettivo</span><input data-campo="sObiettivo" inputmode="decimal" value="${esc(f.obiettivo)}" placeholder="3000"><span class="sotto">€</span></div>
      <div class="rigaB" style="padding-bottom:6px"><span class="et">Entro</span>${f.entro ? `<span class="sotto">${K.dataBella(f.entro, { lunga: true })}</span>` : ""}</div>
      <div class="chipData">${ENTRO.map(([k, t]) => `<button class="${k === f.entroK ? "on" : ""}" data-a="entro" data-id="${k}">${t}</button>`).join("")}
        <label class="${f.entroK === "sc" ? "on" : ""}" style="position:relative">Scegli…<input type="date" data-campo="sEntro" value="${f.entro}" style="position:absolute;inset:0;opacity:0"></label></div>
    </div>
    ${o && mesi ? `<p class="calcolo">Ti bastano <b>${K.euro(Math.ceil(Math.max(0, o - giaDentro) / mesi / 100) * 100)}</b> al mese per arrivarci.</p>` : ""}
    ${iconeHtml(f)}
    ${f.id && !giaDentro ? `<button class="elimina" data-a="eliminaSal">${ic("cestino")} Elimina l'obiettivo</button>` : ""}
    <div class="salvaBasso"><button class="salva" style="background:${f.colore}" data-a="salvaSal">${f.id ? "Salva" : "Crea l'obiettivo"}</button></div></div>`;
}
function salvaSal() {
  const f = U.f, nome = f.nome.trim();
  if (!nome) return toast("Dagli un nome");
  const id = f.id || K.nuovoId(), v = f.id ? clona(D.leggi("sal:" + id)) : { id, creato: adesso(), iniziale: 0 };
  Object.assign(v, { nome, icona: f.icona, colore: f.colore, obiettivo: K.cent(f.obiettivo || "0") || null, entro: f.entro || null });
  D.scrivi("sal:" + id, v);
  U.vistaSoldi = "obiettivi";
  chiudiFoglio(); disegna(); toast(f.id ? "Obiettivo salvato" : "Obiettivo creato", true);
}
function apriSal(id) {
  U.f = { modo: "versa", id, verso: 1, np: "", busta: "principale" };
  apriFoglio(foglioSal, () => U.f?.verso < 0 ? "u" : "");
}
function foglioSal() {
  const f = U.f, s = D.leggi("sal:" + f.id);
  if (!s) return "";
  const fatto = raggiunto(s);
  return `<div class="testaFoglio"><button class="lato" data-a="chiudiFoglio">Chiudi</button><h2>${esc(s.nome)}</h2><button class="lato dx" data-a="formSal" data-id="${s.id}">Modifica</button></div>
  <div class="porc" style="justify-content:center;margin:0 0 6px">${vaso(s, 70)}<div><div class="quanto" style="font-family:var(--serif);font-size:28px">${K.euro(K.saldoSalvadanaio(s.id))}</div>
    <div class="sotto">${esc(sottoSal(s))}</div></div></div>
  <div class="seg"><div class="cursore" style="width:calc(50% - 3px);transform:translateX(${f.verso < 0 ? 100 : 0}%)"></div>
    <button class="${f.verso > 0 ? "on" : ""}" data-a="verso" data-id="1">Metti</button><button class="${f.verso < 0 ? "on" : ""}" data-a="verso" data-id="-1">Riprendi</button></div>
  ${chipBuste(f.busta, "vBusta")}
  <div class="importo" style="margin-top:4px">${mostraNp(f.np)}</div>
  ${tasti()}
  <button class="salva" data-a="versa" disabled>${f.verso > 0 ? "Metti da parte · da " + esc(K.busta(f.busta).nome) : "Riprendi · in " + esc(K.busta(f.busta).nome)}</button>
  <button class="${fatto ? "btn oro pieno" : "saltaLink"}" style="${fatto ? "margin-top:8px" : "display:block;margin:2px auto 0;padding:8px"}" data-a="rompi" data-id="${s.id}">${fatto ? "Raggiunto! Rompi il salvadanaio" : "Rinuncia all'obiettivo"}</button>`;
}
function versa() {
  const f = U.f, importo = K.cent(f.np || "0");
  if (importo <= 0) return;
  const id = K.nuovoId(), da = $("#strato .salva");
  D.scrivi("mov:" + id, { id, tipo: "v", sal: f.id, busta: f.busta, importo: importo * f.verso, data: K.oggi(), creato: adesso() });
  if (f.verso > 0) moneta(da, $("#strato .vaso"));
  f.np = "";
  setTimeout(() => { disegnaFoglio(); disegna(); $("#strato .vaso")?.classList.add("pulsa");
    if (f.verso > 0) festa(caso(K.FRASI_RISPARMIO), `${K.euro(importo)} in ${D.leggi("sal:" + f.id)?.nome}`); else toast(`Ripresi ${K.euro(importo)}`, true); }, f.verso > 0 ? 650 : 0);
}
// rompere: raggiunto → torna in una busta o «l'ho speso»; rinuncia → torna in una busta
function rompi(id) {
  const s = D.leggi("sal:" + id); if (!s) return;
  U.f = { modo: "rompi", id, busta: "principale", fatto: raggiunto(s) };
  apriFoglio(foglioRompi, () => "");
  setTimeout(() => $("#strato .vaso")?.classList.add("rotto"), 350);
}
function foglioRompi() {
  const f = U.f, s = D.leggi("sal:" + f.id), saldo = K.saldoSalvadanaio(f.id);
  return `${testaFoglio(f.fatto ? "Rompi" : "Rinunci?")}
  <div style="display:flex;justify-content:center;margin:6px 0">${vaso(s, 96)}</div>
  <p class="domanda">${f.fatto ? "Ce l'hai fatta!" : "Nessun problema."}</p>
  <p class="nota" style="text-align:center">${f.fatto ? `«${esc(s.nome)}»: ${K.euro(saldo)} messi da parte, un euro alla volta.` : "Le priorità cambiano: cambiare idea è saggezza, non sconfitta."}</p>
  ${saldo ? `<span class="etichettaCampo">I soldi vanno nella busta</span>${chipBuste(f.busta, "rBusta")}
  <button class="btn si pieno" data-a="esitoRompi" data-id="${f.fatto ? "busta" : "rinuncia"}">${ic("su")} Torna in ${esc(K.busta(f.busta).nome)}</button>
  ${f.fatto ? `<button class="btn oro pieno" style="margin-top:8px" data-a="esitoRompi" data-id="speso">L'ho speso per questo</button>
    <p class="nota" style="text-align:center">«L'ho speso» segna subito l'uscita di ${K.euro(saldo)} per «${esc(s.nome)}».</p>` : ""}`
    : `<button class="btn si pieno" data-a="esitoRompi" data-id="rinuncia">Chiudi l'obiettivo</button>`}`;
}
function esitoRompi(esito) {
  const f = U.f, s = clona(D.leggi("sal:" + f.id)), saldo = K.saldoSalvadanaio(f.id), o = K.oggi();
  if (saldo) {
    const id = K.nuovoId();
    D.scrivi("mov:" + id, { id, tipo: "v", sal: f.id, busta: f.busta, importo: -saldo, data: o, desc: `Rotto: ${s.nome}`, creato: adesso() });
    if (esito === "speso") { const id2 = K.nuovoId();
      D.scrivi("mov:" + id2, { id: id2, tipo: "u", importo: saldo, desc: s.nome, cat: "io", busta: f.busta, data: o, creato: adesso() }); }
  }
  s.rotto = { quando: adesso(), esito, importo: saldo };
  D.scrivi("sal:" + f.id, s);
  chiudiFoglio(); disegna();
  if (esito === "rinuncia") toast("Obiettivo chiuso", true);
  else festa(esito === "speso" ? "Goditelo." : "Obiettivo raggiunto!", esito === "speso" ? "Te lo sei guadagnato, un euro alla volta." : `${K.euro(saldo)} tornano in ${K.busta(f.busta).nome}.`);
}

// ---------- rito di fine periodo ----------
const bustaRisparmi = () => K.buste().find(b => b.id === "risparmi") || K.buste().find(b => /risparm/i.test(b.nome)) || K.buste().find(b => b.id !== "principale");
function chiudiPeriodo(bid, scelta, salId) {
  const r = K.daChiudere().find(x => x.b.id === bid);
  if (!r) return;
  if (scelta === "obiettivo" && !salId) { U.f = { modo: "sceltaSal", bid }; return apriFoglio(foglioSceltaSal, () => ""); }
  const da = r.b.busta || "principale", verso = scelta === "busta" ? bustaRisparmi() : null, sal = salId ? D.leggi("sal:" + salId) : null;
  D.scrivi(`chiusa:${bid}:${r.inizio}`, { scelta, importo: Math.max(0, r.avanzo), sal: sal?.id || null, busta: verso?.id || null, quando: adesso() });
  if (r.avanzo > 0 && verso && verso.id !== da) { const id = K.nuovoId();
    D.scrivi("mov:" + id, { id, tipo: "t", da, a: verso.id, importo: r.avanzo, data: K.oggi(), desc: `Avanzo · ${r.b.nome}`, creato: adesso() }); }
  if (r.avanzo > 0 && sal) { const id = K.nuovoId();
    D.scrivi("mov:" + id, { id, tipo: "v", sal: sal.id, busta: da, importo: r.avanzo, data: K.oggi(), desc: `Avanzo · ${r.b.nome}`, creato: adesso() }); }
  const bottone = app.querySelector(`[data-a="chiudi"][data-id="${bid}"]`), dove = verso || sal;
  if (dove && r.avanzo > 0) moneta(bottone, app.querySelector('#tab [data-id="buste"]'));
  chiudiFoglio();
  setTimeout(() => {
    disegna();
    if (scelta === "riporta") festa("Riportati.", `${K.euro(r.avanzo)} in più per il prossimo periodo.`);
    else if (scelta === "sforato") toast("Nuovo periodo, nuovo inizio");
    else festa(caso(K.FRASI_RISPARMIO), `${K.euro(r.avanzo)} in ${dove.nome}`);
  }, dove ? 600 : 0);
}
function foglioSceltaSal() {
  return `${testaFoglio("In quale obiettivo?")}<div class="dentro"><div class="card lista" style="margin-top:0">${K.salvadanai().map(s =>
    `<button class="mov" data-a="chiudiIn" data-id="${s.id}"><div class="ico oro">${ic(s.icona || "obiettivo")}</div><div class="nome"><div>${esc(s.nome)}</div>
    <div class="sotto">${K.euro(K.saldoSalvadanaio(s.id))}</div></div>${ic("avanti")}</button>`).join("")}</div></div>`;
}

// ---------- andamento ----------
function foglioAndamento() {
  const mesi = K.profilo().mediaMesi ?? 6, a = K.andamento(mesi), serie = a.serie.slice(-12);
  const max = Math.max(1, ...serie.map(x => Math.max(x.e, x.u))), larg = 320, alt = 130, passo = serie.length ? larg / serie.length : larg;
  const barre = serie.map((x, i) => { const bw = Math.min(14, passo / 3), x0 = i * passo + passo / 2 - bw - 1;
    return `<rect x="${x0}" y="${alt - (x.e / max) * alt}" width="${bw}" height="${(x.e / max) * alt}" rx="3" fill="var(--verde)"/>
      <rect x="${x0 + bw + 2}" y="${alt - (x.u / max) * alt}" width="${bw}" height="${(x.u / max) * alt}" rx="3" fill="var(--terra)" opacity=".75"/>
      <text x="${i * passo + passo / 2}" y="${alt + 14}" text-anchor="middle" font-size="10" fill="var(--grigio)">${K.meseCorto(x.m)}</text>`; }).join("");
  const yMedia = alt - (a.media / max) * alt, totCat = a.perCat.reduce((s, [, v]) => s + v, 0) || 1;
  return `${testaFoglio("Andamento", "Chiudi", "chiudiFoglio")}
  <div class="dentro">
  <div class="selettore">${[[3, "3 mesi"], [6, "6 mesi"], [12, "12 mesi"], [0, "Sempre"]].map(([n, t]) => `<button class="${mesi === n ? "on" : ""}" data-a="mesiMedia" data-id="${n}">${t}</button>`).join("")}</div>
  <div class="treNum">
    <div><span class="sotto">Guadagno medio</span><b style="color:var(--verde)">${K.euro(a.media)}</b><span class="sotto">al mese</span></div>
    <div><span class="sotto">Spesa media</span><b style="color:var(--terra)">${K.euro(a.mediaU)}</b><span class="sotto">al mese</span></div>
    <div><span class="sotto">Mese migliore</span><b>${a.migliore ? K.euro(a.migliore.e) : "—"}</b><span class="sotto">${a.migliore ? K.nomeMese(a.migliore.m, false) : ""}</span></div>
    <div><span class="sotto">Mese più magro</span><b>${a.peggiore ? K.euro(a.peggiore.e) : "—"}</b><span class="sotto">${a.peggiore ? K.nomeMese(a.peggiore.m, false) : ""}</span></div>
  </div>
  ${serie.length ? `<div class="card grafico"><div class="riga"><span class="titolo">Entrate e uscite</span><span class="sotto">--- media</span></div>
    <svg viewBox="0 0 ${larg} ${alt + 18}" preserveAspectRatio="none" style="margin-top:10px">${barre}
    <line x1="0" x2="${larg}" y1="${yMedia}" y2="${yMedia}" stroke="var(--verde)" stroke-dasharray="4 4" opacity=".7"/></svg></div>`
    : `<div class="card">${vuoto("Serve un mese completo", "La media si calcola sui mesi finiti. Intanto questo mese: +" + K.euro(a.corrente.e))}</div>`}
  <div class="card"><div class="riga"><span class="titolo">Questo mese finora</span></div>
    <div class="dueNum" style="justify-content:flex-start;margin-top:6px"><span>Entrate <b style="color:var(--verde)">+${K.euro(a.corrente.e)}</b></span><span>Uscite <b style="color:var(--terra)">−${K.euro(a.corrente.u)}</b></span></div></div>
  <div class="sezione">${U.cbTipo === "e" ? "Da dove arrivano" : "Dove vanno i soldi"}</div>
  ${ciambellaHtml(U.cbTipo === "e" ? a.perCatE : a.perCat)}
  <p class="nota" style="text-align:center;margin:14px 0 8px">Da libero professionista conta la media, non il singolo mese.</p></div>`;
}

// ---------- ciambella delle categorie (anteprima «A» scelta il 2026-11-04) ----------
// colori validati (si distinguono anche per chi confonde rosso/verde); oltre le 5 più grandi tutto va in «Altro»
const COLORI_CAT = ["#1F7A50", "#B0862A", "#2A6A9E", "#C8643C", "#93498C"], GRIGIO_ALTRO = "#BDB7AA";
function arco(cx, cy, r1, r2, a0, a1) {
  if (a1 - a0 >= 2 * Math.PI - 1e-3) a1 = a0 + 2 * Math.PI - 1e-3;
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)], g = a1 - a0 > Math.PI ? 1 : 0;
  const [x1, y1] = p(r2, a0), [x2, y2] = p(r2, a1), [x3, y3] = p(r1, a1), [x4, y4] = p(r1, a0);
  return `M${x1} ${y1}A${r2} ${r2} 0 ${g} 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 ${g} 0 ${x4} ${y4}Z`;
}
function ciambellaHtml(lista) {
  const tipo = U.cbTipo || "u";
  const testa = `<div class="seg" style="--acc:${tipo === "e" ? "var(--verde)" : "var(--terra)"}"><div class="cursore" style="width:calc(50% - 3px);transform:translateX(${tipo === "e" ? 100 : 0}%)"></div>
    <button class="${tipo === "u" ? "on" : ""}" data-a="cbTipo" data-id="u">Uscite</button><button class="${tipo === "e" ? "on" : ""}" data-a="cbTipo" data-id="e">Entrate</button></div>`;
  if (!lista.length) return `<div class="card">${testa}${vuoto("Ancora niente", tipo === "e" ? "Quando segni le entrate, qui vedi da dove arrivano." : "Quando segni le spese, qui vedi in cosa vanno.")}</div>`;
  const prime = lista.slice(0, 5), resto = lista.slice(5).reduce((t, [, v]) => t + v, 0);
  const d = prime.map(([c, v], i) => ({ c, nome: K.categoria(c).nome, icona: K.categoria(c).icona, v, col: COLORI_CAT[i] }));
  if (resto) d.push({ c: "_altro", nome: "Tutto il resto", icona: "altro", v: resto, col: GRIGIO_ALTRO });
  const tot = d.reduce((t, x) => t + x.v, 0), sel = d.findIndex(x => x.c === U.cbSel), x0 = sel >= 0 ? d[sel] : null;
  let a = 0; const gap = d.length > 1 ? 0.025 : 0;
  const fette = d.map((x, i) => { const a0 = a, a1 = a + x.v / tot * 2 * Math.PI; a = a1;
    return `<path d="${arco(110, 110, 70, 104, a0 + gap / 2, a1 - gap / 2)}" fill="${x.col}" data-a="cbSel" data-id="${x.c}" class="${sel < 0 ? "" : sel === i ? "su" : "via"}"/>`; }).join("");
  const pc = v => Math.round(v / tot * 100) + "%";
  return `<div class="card">${testa}
    <div class="cb"><svg viewBox="0 0 220 220">${fette}</svg>
      <div class="cbCentro"><small>${x0 ? esc(x0.nome) : tipo === "e" ? "Entrate" : "Spese"}</small><b>${K.euro(x0 ? x0.v : tot, { decimali: false })}</b><span>${x0 ? pc(x0.v) + " del totale" : d.length + (d.length === 1 ? " categoria" : " categorie")}</span></div></div>
    <div class="lista" style="padding:0;margin-top:6px">${d.map((x, i) => `<button class="mov ${sel >= 0 && sel !== i ? "cbVia" : ""}" data-a="cbSel" data-id="${x.c}">
      <span class="cbPunto" style="background:${x.col}"></span><div class="nome"><div>${esc(x.nome)}</div></div>
      <span class="imp">${K.euro(x.v, { decimali: false })}</span><span class="sotto" style="width:36px;text-align:right">${pc(x.v)}</span></button>`).join("")}</div>
    <p class="nota" style="text-align:center">Tocca una fetta o una riga per vederla al centro.</p></div>`;
}

// ---------- tutti i movimenti ----------
function foglioTutti() {
  const q = U.cerca.trim().toLowerCase(), o = K.oggi();
  let lista = K.movimenti(K.addM(o, -24), K.addM(o, 3));
  if (q) lista = lista.filter(m => (m.desc || "").toLowerCase().includes(q) || K.categoria(m.cat).nome.toLowerCase().includes(q));
  const perMese = {};
  lista.slice(0, 400).forEach(m => (perMese[K.mese(m.data)] ||= []).push(m));
  return `${testaFoglio("Movimenti", "Chiudi", "chiudiFoglio")}
  <label class="campo">${ic("altro")}<input data-campo="cerca" value="${esc(U.cerca)}" placeholder="Cerca" autocomplete="off" type="search"></label>
  <div class="dentro" id="tuttiLista">${Object.entries(perMese).map(([m, l]) => `<div class="sezione" style="text-transform:capitalize">${K.nomeMese(m)}</div>
    <div class="card lista">${l.map(x => rigaMov(x)).join("")}</div>`).join("") || vuoto("Nessun movimento", q ? "Prova con un'altra parola." : "")}</div>`;
}

// ---------- impostazioni ----------
function foglioImpostazioni() {
  if (U.f?.vista === "saldo") return foglioSaldo();
  if (U.f?.vista === "avviso") return foglioAvviso();
  if (U.f?.vista === "elenco") return foglioElencoCat();
  if (U.f?.vista === "nuovaCat") return foglioCategoria();
  const st = statoNotifiche(), utente = D.chiSei();
  const testoN = { attive: "Attive su questo telefono", "da-attivare": "", bloccate: "Bloccate: riattivale da Impostazioni › Notifiche › Abundance",
    "serve-installazione": "Prima aggiungi l'app alla schermata Home (Condividi › Aggiungi alla schermata Home) e aprila da lì.", "non-supportate": "Questo browser non le supporta." }[st];
  return `${testaFoglio("Impostazioni", "Fatto", "chiudiFoglio")}
  <div class="dentro">
  <div class="card lista" style="margin-top:0">
    <div class="mov"><div class="ico">${ic("campanella")}</div><div class="nome"><div>Notifiche</div><div class="sotto" style="white-space:normal">${testoN}</div></div>
      ${st === "da-attivare" ? `<button class="btn si" style="flex:none;padding:8px 12px" data-a="attivaNotifiche">Attiva</button>` : ""}</div>
    <button class="mov" data-a="vistaImp" data-id="avviso"><div class="ico">${ic("orologio")}</div><div class="nome"><div>Avviso degli abbonamenti</div><div class="sotto">${esc(K.nomeAvviso(null))}</div></div>${ic("avanti")}</button>
    <button class="mov" data-a="vistaImp" data-id="saldo"><div class="ico">${ic("banconota")}</div><div class="nome"><div>Correggi il disponibile</div><div class="sotto">Oggi: ${K.euro(K.disponibile())}</div></div>${ic("avanti")}</button>
    <button class="mov" data-a="vistaImp" data-id="elenco"><div class="ico">${ic("piani")}</div><div class="nome"><div>Categorie</div><div class="sotto">Rinomina, cambia icona, nascondi, aggiungi</div></div>${ic("avanti")}</button>
    <button class="mov" data-a="andamento"><div class="ico">${ic("grafico")}</div><div class="nome"><div>Andamento</div><div class="sotto">Media dei guadagni, mesi, categorie</div></div>${ic("avanti")}</button>
  </div>
  <div class="card lista">
    <div class="mov"><div class="ico">${ic("persone")}</div><div class="nome"><div>${D.PROVA ? "Modalità prova" : esc(utente?.email || "")}</div><div class="sotto">${D.PROVA ? "Dati finti, solo su questo dispositivo" : "I dati si sincronizzano su tutti i tuoi dispositivi"}</div></div></div>
    ${D.PROVA ? `<button class="mov" data-a="azzeraProva"><div class="ico">${ic("ripeti")}</div><div class="nome"><div>Ricomincia la prova</div></div></button>`
      : `<button class="mov" data-a="esci"><div class="ico">${ic("esci")}</div><div class="nome"><div>Esci dall'account</div></div></button>`}
  </div>
  <p class="nota" style="text-align:center;margin:16px 0">Abundance · il denaro ama la chiarezza.</p></div>`;
}
function foglioSaldo() {
  return `<div class="testaFoglio"><button class="lato" data-a="vistaImp" data-id="">${ic("indietro")}</button><h2>Il disponibile</h2><span class="lato"></span></div>
  <p class="nota" style="text-align:center;margin-top:0">Quanto hai davvero sul conto adesso? Correggo la differenza (${K.euro(K.disponibile())} ora) senza toccare budget e medie.</p>
  <div class="importo">${mostraNp(U.f.np)}</div>${tasti()}<button class="salva" data-a="salvaSaldo">Correggi</button>`;
}
function foglioElencoCat() {
  const riga = c => `<button class="mov" data-a="modCat" data-id="${c.id}"><div class="ico ${c.tipo === "e" ? "e" : ""}">${ic(c.icona)}</div>
    <div class="nome"><div>${esc(c.nome)}</div>${c.nascosta ? '<div class="sotto">nascosta</div>' : ""}</div>${ic("avanti")}</button>`;
  return `<div class="testaFoglio"><button class="lato" data-a="vistaImp" data-id="">${ic("indietro")}</button><h2>Categorie</h2><span class="lato"></span></div>
  <div class="dentro">
  <div class="sezione" style="margin-top:4px">Uscite <button data-a="nuovaCatImp" data-id="u">${ic("piu")} Nuova</button></div><div class="card lista">${K.categorie("u", false).map(riga).join("")}</div>
  <div class="sezione">Entrate <button data-a="nuovaCatImp" data-id="e">${ic("piu")} Nuova</button></div><div class="card lista">${K.categorie("e", false).map(riga).join("")}</div></div>`;
}
function salvaCat() {
  const f = U.f, nc = f.nc, nome = nc.nome.trim();
  if (!nome) return toast("Dagli un nome");
  const id = nc.id || "c" + K.nuovoId(), tipo = nc.tipo || f.tipo;
  D.scrivi("cat:" + id, { ...(clona(D.leggi("cat:" + id)) || {}), id, nome, icona: nc.icona, tipo, nascosta: !!nc.nascosta });
  if (f.modo === "categorie") { f.vista = "elenco"; f.nc = null; }
  else { f.cat = id; f.vista = "mov"; f.nc = null; }
  disegnaFoglio();
}

// ================= ACCESSO E BENVENUTO =================
function accessoHtml() {
  const a = U.accesso;
  app.innerHTML = `<div class="corpo"><form class="accesso" id="formAccesso">
    <div class="logo">${ic("germoglio")}</div><h1>Abundance</h1><p class="frase">${esc(K.fraseDelGiorno())}</p>
    <label class="campo">${ic("persone")}<input id="accEmail" type="email" autocomplete="email" placeholder="Email" required></label>
    <label class="campo">${ic("chiave")}<input id="accPw" type="password" autocomplete="${a.nuovo ? "new-password" : "current-password"}" placeholder="Password" required minlength="6"></label>
    <button class="btn si pieno" type="submit">${a.nuovo ? "Crea l'account" : "Entra"}</button>
    <p class="errore">${esc(a.errore)}</p>
    <button type="button" class="saltaLink" data-a="cambiaAccesso">${a.nuovo ? "Ho già un account: entra" : "Non hai un account? Creane uno"}</button>
    <p class="nota" style="text-align:center">Puoi usare lo stesso account delle tue altre app.</p>
  </form></div>`;
  $("#formAccesso").onsubmit = async e => {
    e.preventDefault();
    a.errore = ""; $(".errore").textContent = "Un attimo…";
    try { await D.accedi($("#accEmail").value.trim(), $("#accPw").value, a.nuovo); dopoAccesso(); }
    catch (err) { a.errore = /Invalid login/i.test(err.message) ? "Email o password non corrette." : err.message; $(".errore").textContent = a.errore; }
  };
}
function benvenuto() {
  const b = U.benv ||= { passo: 1, saldo: "", budget: "" };
  U.f = { np: b.passo === 1 ? b.saldo : b.budget, zeroOk: true };
  app.innerHTML = `<div class="benvenuto"><div class="passi"><i class="${b.passo === 1 ? "on" : ""}"></i><i class="${b.passo === 2 ? "on" : ""}"></i></div>
    ${b.passo === 1 ? `<h1>Benvenuto in Abundance.</h1><p class="nota">Partiamo da dove sei. Quanto hai oggi sul conto?<br>(I risparmi li aggiungi dopo nei salvadanai.)</p>`
      : `<h1>Quanto vuoi spendere a settimana?</h1><p class="nota">Spesa, uscite, piccole cose. Lo potrai cambiare, o creare budget mensili e annuali.</p>`}
    <div class="importo" style="color:var(--verde)">${mostraNp(U.f.np)}</div>${tasti()}
    <button class="salva" style="background:var(--verde)" data-a="benvAvanti">${b.passo === 1 ? "Avanti" : "Inizia"}</button>
    ${b.passo === 2 ? `<button class="saltaLink" data-a="benvSalta">Per ora niente budget</button>` : ""}</div>`;
}
function fineBenvenuto(conBudget) {
  const b = U.benv, o = K.oggi();
  D.scrivi("profilo", { saldo: K.cent(b.saldo || "0"), dal: o, mediaMesi: 6, versione: 2, creato: adesso() });
  D.scrivi("busta:principale", { id: "principale", nome: "Principale", icona: "portafoglio", colore: K.COLORI_BUSTE[0], ordine: 0, creato: adesso() });
  D.scrivi("busta:risparmi", { id: "risparmi", nome: "Risparmi", icona: "salvadanaio", colore: K.COLORI_BUSTE[2], ordine: 1, iniziale: 0, creato: adesso() });
  const imp = K.cent(b.budget || "0");
  if (conBudget && imp > 0) { const id = K.nuovoId();
    D.scrivi("bud:" + id, { id, nome: "Budget della settimana", importo: imp, ogni: 1, unita: "s", inizio: K.lunedi(o), cats: [], principale: true, creato: adesso() }); }
  U.benv = null; U.f = null;
  guscio(); disegna();
  festa("Eccoci.", "Da oggi sai sempre dove sei.");
}
/** dal 2026-11-04: il vecchio salvadanaio «Risparmi» diventa una BUSTA (gli altri restano obiettivi) */
function migraBuste() {
  const p = K.profilo(); if (!p || (p.versione || 1) >= 2) return;
  D.senzaRegistro(() => {
    D.scrivi("busta:principale", { id: "principale", nome: "Principale", icona: "portafoglio", colore: K.COLORI_BUSTE[0], ordine: 0, creato: adesso() });
    const r = D.leggi("sal:risparmi");
    if (r) {
      D.scrivi("busta:risparmi", { id: "risparmi", nome: r.nome || "Risparmi", icona: "salvadanaio", colore: K.COLORI_BUSTE[2], iniziale: r.iniziale || 0, ordine: 1, creato: r.creato || adesso() });
      D.elenco("mov:").forEach(([k, m]) => { if (m.tipo === "v" && m.sal === "risparmi") { const n = clona(m); delete n.sal; D.scrivi(k, { ...n, tipo: "t", da: "principale", a: "risparmi" }); } });
      D.scrivi("sal:risparmi", null);
    }
    D.scrivi("profilo", { ...clona(K.profilo()), versione: 2 });
  });
}
function dopoAccesso() {
  if (D.PROVA && !K.profilo()) D.senzaRegistro(datiProva);
  migraBuste();
  if (!K.profilo()) return benvenuto();
  guscio(); disegna();
  if (statoNotifiche() === "attive") registraDispositivo().catch(() => {});
}

// ================= AVVISI A SCHERMO =================
let tToast;
function toast(testo, annulla = false) {
  const t = $("#toast"); if (!t) return;
  t.innerHTML = `<span>${esc(testo)}</span>${annulla && D.puoiAnnullare() ? `<button data-a="annulla">Annulla</button>` : ""}`;
  t.classList.add("via"); clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove("via"), 3500);
}
let tFesta;
function festa(titolo, testo, allarme = false) {
  const f = $("#festa"); if (!f) return;
  f.className = "festa" + (allarme ? " allarme" : "");
  f.innerHTML = `${esc(titolo)}${testo ? `<small>${esc(testo)}</small>` : ""}`;
  requestAnimationFrame(() => f.classList.add("via"));
  clearTimeout(tFesta); tFesta = setTimeout(() => f.classList.remove("via"), allarme ? 3200 : 2000);
}
function moneta(da, a) {
  if (!da || !a) return;
  const base = app.getBoundingClientRect(), r1 = da.getBoundingClientRect(), r2 = a.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    const m = document.createElement("div"); m.className = "moneta"; app.appendChild(m);
    const x0 = r1.left + r1.width / 2 - base.left - 13 + (i - 1) * 18, y0 = r1.top - base.top, x1 = r2.left + r2.width / 2 - base.left - 13, y1 = r2.top + r2.height / 2 - base.top - 13;
    m.animate([{ transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 0 }, { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 60}px) scale(1)`, opacity: 1, offset: .45 },
      { transform: `translate(${x1}px,${y1}px) scale(.5)`, opacity: .2 }], { duration: 700, delay: i * 90, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" }).onfinish = () => m.remove();
  }
}

// ================= AZIONI =================
const AZ = {
  scheda: el => { const id = el.dataset.id;
    if (U.scheda === id) { $("#corpo").scrollTo({ top: 0, behavior: "smooth" }); if (id === "calendario") { U.calMese = K.mese(K.oggi()); U.calGiorno = K.oggi(); disegna(); } }
    else { U.scheda = id; disegna(); $("#corpo").scrollTop = 0; }
    app.querySelector(`#tab [data-id="${id}"]`)?.classList.add("salta"); },
  nuovo: el => { const r = el.dataset.rip; nuovoMov({ tipo: el.dataset.tipo || "u", data: el.dataset.data || K.oggi(), rip: r ? { ogni: Number(r[0]), unita: r[1] } : null }); },
  frase: el => { el.style.opacity = 0; setTimeout(() => { U.spostFrase++; el.textContent = K.fraseDelGiorno(U.spostFrase); el.style.opacity = 1; }, 380); },
  chiudiFoglio, apriMov: el => apriMov(el.dataset.id), apriRic: el => apriRic(el.dataset.id),
  apriRicDaOcc: () => apriRic(U.f.ric),
  tasto: el => premi(el.dataset.k),
  tipo: el => { U.f.tipo = el.dataset.id; if (!K.categorie(U.f.tipo).some(c => c.id === U.f.cat)) U.f.cat = primaCat(U.f.tipo);
    if (!U.f.bustaScelta || U.f.busta === "dividi") U.f.busta = bustaPredefinita(U.f.tipo, U.f.cat); disegnaFoglio(); },
  cat: el => { U.f.cat = el.dataset.id; app.querySelectorAll("#strato .cat button").forEach(b => b.classList.toggle("on", b === el));
    if (U.f.tipo === "u" && !U.f.bustaScelta && $("#chipBusta")) { U.f.busta = bustaPerCat(U.f.cat); $("#chipBusta").innerHTML = chipBuste(U.f.busta, "fBusta"); } },
  vista: el => { U.f.vista = el.dataset.id; if (el.dataset.id === "nuovaCat") U.f.nc = null; disegnaFoglio(); },
  sceltaRip: el => { const s = [null, { ogni: 1, unita: "s" }, { ogni: 2, unita: "s" }, { ogni: 1, unita: "m" }, { ogni: 2, unita: "m" }, { ogni: 3, unita: "m" }, { ogni: 6, unita: "m" }, { ogni: 1, unita: "a" }][Number(el.dataset.id)];
    U.f.rip = s; U.f.vista = "mov"; disegnaFoglio(); },
  sceltaAvv: el => { const g = Number(el.dataset.id), prima = (U.f.modo === "categorie" ? K.avvisoPredefinito() : U.f.avviso) || K.avvisoPredefinito();
    scriviAvviso({ giorni: g, ora: prima.ora || "09:00" }); },
  avvBase: () => scriviAvviso(null),
  ncIcona: el => { U.f.nc.icona = el.dataset.id; disegnaFoglio(); },
  salvaCat, salvaMov, eliminaMov,
  modCatScelta: () => { const c = K.categoria(U.f.cat); U.f.nc = { ...c, tipo: c.tipo || U.f.tipo }; U.f.vista = "nuovaCat"; disegnaFoglio(); },
  eliminaCat: () => { const f = U.f, id = f.nc.id, base = K.CATEGORIE.some(c => c.id === id);
    if (base) D.scrivi("cat:" + id, { ...(clona(D.leggi("cat:" + id)) || {}), ...K.CATEGORIE.find(c => c.id === id), ...(clona(D.leggi("cat:" + id)) || {}), id, nascosta: true });
    else D.scrivi("cat:" + id, null);
    f.nc = null;
    if (f.modo === "categorie") f.vista = "elenco";
    else { f.vista = "mov"; if (f.cat === id) f.cat = primaCat(f.tipo); }
    disegnaFoglio(); toast(base ? "Tolta dall'elenco" : "Categoria eliminata", true); },
  eliminaSemplice: () => { D.scrivi("mov:" + U.f.m.id, null); chiudiFoglio(); disegna(); toast("Eliminato", true); },
  arrivati: el => { const m = K.trovaMov(el.dataset.id); if (!m) return;
    const v = { ...(clona(D.leggi("mov:" + m.id)) || {}), id: m.id, tipo: m.tipo, importo: m.importo, desc: m.desc, cat: m.cat, data: m.data, atteso: false, creato: adesso() };
    Object.assign(v, bustaDi({ tipo: "e", busta: m.busta || bustaPredefinita("e") }, m.importo, false));
    if (m.ric) v.ric = m.ric;
    D.scrivi("mov:" + m.id, v); disegna(); festa(caso(K.FRASI_ENTRATA), "+" + K.euro(m.importo)); },
  formBudget: el => formBudget(el.dataset.id), salvaBudget,
  eliminaBudget: () => { D.scrivi("bud:" + U.f.id, null); chiudiFoglio(); disegna(); toast("Budget eliminato", true); },
  bPer: el => { const k = el.dataset.id; if (k === "pers") U.f.personal = true; else { U.f.personal = false; U.f.ogni = Number(k[0]); U.f.unita = k[1]; } if (!U.f.inizioScelto) U.f.inizio = null; disegnaFoglio(); },
  bBusta: el => { U.f.busta = el.dataset.id; disegnaFoglio(); },
  bCat: el => { const c = el.dataset.id, l = U.f.cats; U.f.cats = l.includes(c) ? l.filter(x => x !== c) : [...l, c]; el.classList.toggle("on"); },
  formSal: el => formSal(el.dataset.id), salvaSal, apriSal: el => apriSal(el.dataset.id),
  fIcona: el => { U.f.icona = el.dataset.id; const d = $("#strato .dentro"), sc = d?.scrollTop; disegnaFoglio(); $("#strato .dentro").scrollTop = sc; $("#strato .bollo")?.classList.add("pulsa"); },
  fCol: el => { U.f.colore = el.dataset.id; const d = $("#strato .dentro"), sc = d?.scrollTop; disegnaFoglio(); $("#strato .dentro").scrollTop = sc; },
  entro: el => { const k = el.dataset.id; U.f.entroK = k; U.f.entro = k ? K.addM(K.oggi(), Number(k)) : ""; const d = $("#strato .dentro"), sc = d?.scrollTop; disegnaFoglio(); $("#strato .dentro").scrollTop = sc; },
  vistaSoldi: el => { U.vistaSoldi = el.dataset.id; disegna(); },
  formBusta: el => formBusta(el.dataset.id), salvaBusta,
  eliminaBusta: () => { const id = U.f.id, saldo = K.saldiBuste()[id] || 0;
    if (saldo) { const mid = K.nuovoId(); D.scrivi("mov:" + mid, { id: mid, tipo: "t", da: id, a: "principale", importo: saldo, data: K.oggi(), desc: `Chiusa la busta ${K.busta(id).nome}`, creato: adesso() }); }
    if (K.distribuzione().pct[id]) scriviDistribuzione(d => { delete d.pct[id]; });
    K.budgets().filter(b => b.busta === id).forEach(b => D.scrivi("bud:" + b.id, { ...clona(b), busta: null }));
    D.scrivi("busta:" + id, null); chiudiFoglio(); disegna(); toast("Busta eliminata", true); },
  sposta: () => { const lb = K.buste(); U.f = { modo: "sposta", da: "principale", a: lb.find(b => b.id !== "principale")?.id, np: "" }; apriFoglio(foglioSposta, () => ""); },
  sDa: el => { U.f.da = el.dataset.id; if (U.f.a === U.f.da) U.f.a = K.buste().find(b => b.id !== U.f.da)?.id; disegnaFoglio(); premi(""); },
  sA: el => { U.f.a = el.dataset.id; if (U.f.a === U.f.da) U.f.da = K.buste().find(b => b.id !== U.f.a)?.id; disegnaFoglio(); premi(""); },
  salvaSposta: () => { const f = U.f, imp = K.cent(f.np || "0"); if (imp <= 0 || f.da === f.a) return;
    const id = K.nuovoId(); D.scrivi("mov:" + id, { id, tipo: "t", da: f.da, a: f.a, importo: imp, data: K.oggi(), creato: adesso() });
    chiudiFoglio(); disegna(); toast(`${K.euro(imp)} in ${K.busta(f.a).nome}`, true); },
  dividi: () => { U.f = { modo: "dividi" }; apriFoglio(foglioDividi, () => ""); },
  fBusta: el => { U.f.busta = el.dataset.id; U.f.bustaScelta = true; $("#chipBusta").innerHTML = chipBuste(U.f.busta, "fBusta", { dividi: U.f.tipo === "e" }); },
  vBusta: el => { U.f.busta = el.dataset.id; disegnaFoglio(); premi(""); },
  rBusta: el => { U.f.busta = el.dataset.id; disegnaFoglio(); $("#strato .vaso")?.classList.add("rotto"); },
  rompi: el => rompi(el.dataset.id), esitoRompi: el => esitoRompi(el.dataset.id),
  eliminaRotto: el => { D.scrivi("sal:" + el.dataset.id, null); disegna(); toast("Tolto dalla lista", true); },
  eliminaSal: () => { const id = U.f.id, saldo = K.saldoSalvadanaio(id); U.vistaSoldi = "obiettivi";
    if (saldo) { const mid = K.nuovoId(); D.scrivi("mov:" + mid, { id: mid, tipo: "v", sal: id, importo: -saldo, data: K.oggi(), desc: "Chiuso il salvadanaio", creato: adesso() }); }
    D.scrivi("sal:" + id, null); chiudiFoglio(); disegna(); toast("Salvadanaio eliminato", true); },
  verso: el => { U.f.verso = Number(el.dataset.id); disegnaFoglio(); premi(""); },
  versa,
  chiudi: el => chiudiPeriodo(el.dataset.id, el.dataset.scelta),
  chiudiIn: el => chiudiPeriodo(U.f.bid, "obiettivo", el.dataset.id),
  giorno: el => { U.calGiorno = el.dataset.id; if (K.mese(U.calGiorno) !== U.calMese) U.calMese = K.mese(U.calGiorno); disegna(); },
  mese: el => { U.calMese = K.mese(K.addM(U.calMese + "-01", Number(el.dataset.id))); U.calGiorno = U.calMese === K.mese(K.oggi()) ? K.oggi() : U.calMese + "-01"; disegna(); },
  oggiCal: () => { U.calMese = K.mese(K.oggi()); U.calGiorno = K.oggi(); disegna(); },
  andamento: () => { U.cbSel = null; apriFoglio(foglioAndamento, () => "alto"); },
  cbTipo: el => { U.cbTipo = el.dataset.id; U.cbSel = null; disegnaFoglio(); },
  cbSel: el => { U.cbSel = U.cbSel === el.dataset.id ? null : el.dataset.id; const d = $("#strato .dentro"), sc = d?.scrollTop; disegnaFoglio(); const d2 = $("#strato .dentro"); if (d2) d2.scrollTop = sc; },
  mesiMedia: el => { D.scrivi("profilo", { ...clona(K.profilo()), mediaMesi: Number(el.dataset.id) }); disegnaFoglio(); disegna(); },
  tutti: () => { U.cerca = ""; apriFoglio(foglioTutti, () => "alto"); },
  impostazioni: () => { U.f = { modo: "categorie", vista: "" }; apriFoglio(foglioImpostazioni, () => "alto"); },
  vistaImp: el => { U.f.vista = el.dataset.id; if (el.dataset.id === "saldo") U.f.np = npDa(Math.max(0, K.disponibile())); disegnaFoglio(); },
  salvaSaldo: () => { const nuovo = K.cent(U.f.np || "0"), diff = nuovo - K.disponibile();
    if (diff) { const id = K.nuovoId(); D.scrivi("mov:" + id, { id, tipo: "r", importo: diff, data: K.oggi(), creato: adesso() }); }
    U.f.vista = ""; disegnaFoglio(); disegna(); toast("Disponibile: " + K.euro(nuovo), true); },
  modCat: el => { const c = K.categoria(el.dataset.id); U.f.nc = { ...c }; U.f.vista = "nuovaCat"; disegnaFoglio(); },
  nuovaCatImp: el => { U.f.nc = { nome: "", icona: "scintilla", tipo: el.dataset.id }; U.f.vista = "nuovaCat"; disegnaFoglio(); },
  attivaNotifiche: async () => { try { await attivaNotifiche(); toast("Notifiche attive"); programma(true); } catch (e) { toast(statoNotifiche() === "serve-installazione" ? "Prima aggiungi l'app alla schermata Home" : "Notifiche non attivate"); }
    if (U.foglio) disegnaFoglio(); disegna(); },
  noNotifiche: () => { memo.scrivi("noNotifiche", true); disegna(); },
  annulla: () => { if (D.annulla()) { disegna(); if (U.foglio) chiudiFoglio(); toast("Annullato"); } },
  esci: async () => { await D.esci(); U.foglio = null; U.netto = null; accessoHtml(); },
  azzeraProva: () => { try { localStorage.removeItem("abundance.prova"); } catch { /* niente */ } location.reload(); },
  cambiaAccesso: () => { U.accesso.nuovo = !U.accesso.nuovo; U.accesso.errore = ""; accessoHtml(); },
  benvAvanti: () => { const b = U.benv; if (b.passo === 1) { b.saldo = U.f.np; b.passo = 2; benvenuto(); } else { b.budget = U.f.np; fineBenvenuto(true); } },
  benvSalta: () => fineBenvenuto(false),
};

app.addEventListener("click", e => {
  const el = e.target.closest("[data-a]");
  if (!el || !app.contains(el)) return;
  if (el.tagName === "LABEL") return;
  const f = AZ[el.dataset.a];
  if (f) { e.preventDefault(); f(el, e); }
});
app.addEventListener("input", e => {
  const el = e.target, c = el.dataset.campo, f = U.f;
  if (!c) return;
  const v = el.type === "checkbox" ? el.checked : el.value;
  switch (c) {
    case "desc": f.desc = v; break;
    case "data": if (v) { f.data = v; disegnaFoglio(); } break;
    case "conferma": f.conferma = v; break;
    case "nelBudget": f.nelBudget = v; break;
    case "ripOgni": case "ripUnita": { const ogni = Number(c === "ripOgni" ? v : app.querySelector('[data-campo="ripOgni"]').value), unita = c === "ripUnita" ? v : app.querySelector('[data-campo="ripUnita"]').value;
      if (ogni > 0) f.rip = { ogni: Math.min(99, ogni), unita }; break; }
    case "avvOra": if (v) { const prima = (f.modo === "categorie" ? K.avvisoPredefinito() : f.avviso) || K.avvisoPredefinito();
      if (f.modo === "categorie") D.scrivi("profilo", { ...clona(K.profilo()), avviso: { ...prima, ora: v } }); else f.avviso = { ...prima, ora: v }; } break;
    case "ncNome": f.nc.nome = v; break;
    case "ncNascosta": f.nc.nascosta = v; break;
    case "bNome": f.nome = v; break;
    case "bImporto": f.np = v; break;
    case "bOgni": f.ogni = Math.max(1, Number(v) || 1); break;
    case "bUnita": f.unita = v; if (!f.inizioScelto) f.inizio = null; disegnaFoglio(); break;
    case "bInizio": if (v) { f.inizio = v; f.inizioScelto = true; disegnaFoglio(); } break;
    case "bTutte": f.tutte = v; disegnaFoglio(); break;
    case "bPrinc": f.principale = v; break;
    case "fNome": f.nome = v; break;
    case "sObiettivo": f.obiettivo = v; break;
    case "sEntro": if (v) { f.entro = v; f.entroK = "sc"; disegnaFoglio(); } break;
    case "pct": el.parentElement.querySelector("b").textContent = v + "%"; break;
    case "sIniziale": f.iniziale = v; break;
    case "cerca": U.cerca = v; { const l = $("#tuttiLista"), tmp = document.createElement("div"); tmp.innerHTML = foglioTutti(); l.innerHTML = tmp.querySelector("#tuttiLista").innerHTML; } break;
  }
});
app.addEventListener("change", e => {
  const c = e.target.dataset.campo;
  if (c === "distAttiva") { scriviDistribuzione(d => { d.attiva = e.target.checked; }); disegna(); if (U.foglio) disegnaFoglio(); return; }
  if (c === "pct") { const id = e.target.dataset.id, n = Number(e.target.value); scriviDistribuzione(d => { d.pct[id] = n; }); disegnaFoglio(); disegna(); return; } if (e.target.dataset.campo === "data" && e.target.value) { U.f.data = e.target.value; disegnaFoglio(); } });
app.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset?.campo === "desc") { e.preventDefault(); e.target.blur(); } });
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) {
    e.preventDefault(); if (e.shiftKey ? D.ripeti() : D.annulla()) { disegna(); if (U.foglio) disegnaFoglio(); }
  }
  if (e.key === "Escape" && U.foglio) chiudiFoglio();
});

// ================= NOTIFICHE PROGRAMMATE =================
let tProg;
function programma(subito = false) {
  if (statoNotifiche() !== "attive") return;
  clearTimeout(tProg);
  tProg = setTimeout(() => programmaAvvisi(K.avvisiProgrammati()).catch(() => {}), subito ? 0 : 4000);
}

// ================= DATI DI PROVA =================
function datiProva() {
  const o = K.oggi(), dal = K.addG(o, -150), w = (k, v) => D.scrivi(k, v), t = adesso();
  w("profilo", { saldo: 240000, dal, mediaMesi: 6, creato: t });
  const ric = (id, tipo, importo, desc, cat, inizio, ogni, unita, auto) => w("ric:" + id, { id, tipo, importo, desc, cat, inizio, dal, ogni, unita, auto, creato: t });
  const giorno = g => { const d = K.addM(K.primoMese(dal), 0); return d.slice(0, 8) + String(g).padStart(2, "0"); };
  ric("netflix", "u", 1299, "Netflix", "abbonamenti", giorno(7), 1, "m", true);
  ric("spotify", "u", 1099, "Spotify", "abbonamenti", giorno(15), 1, "m", true);
  ric("affitto", "u", 55000, "Affitto", "casa", giorno(1), 1, "m", true);
  ric("palestra", "u", 3900, "Palestra", "salute", giorno(5), 1, "m", true);
  ric("telefono", "u", 999, "Telefono", "bollette", giorno(20), 1, "m", true);
  ric("rossi", "e", 120000, "Studio Rossi", "lavoro", giorno(Number(o.slice(8)) <= 28 ? Number(o.slice(8)) : 10), 1, "m", false);
  let n = 0;
  const mov = (tipo, importo, desc, cat, data) => { const id = "p" + (n++); w("mov:" + id, { id, tipo, importo, desc, cat, data, creato: t }); };
  const spese = [["Spesa Conad", "spesa", 2500, 7000], ["Caffè", "bar", 120, 450], ["Pranzo fuori", "fuori", 1200, 2800], ["Benzina", "benzina", 4000, 6000],
    ["Cena con amici", "fuori", 2500, 4500], ["Farmacia", "salute", 800, 2500], ["Libro", "formazione", 1400, 2200], ["Aperitivo", "svago", 900, 1800]];
  let seme = 7; const rnd = () => (seme = (seme * 9301 + 49297) % 233280) / 233280;
  for (let d = dal; d <= o; d = K.addG(d, 1)) {
    const quante = rnd() < .35 ? 0 : rnd() < .7 ? 1 : 2;
    for (let i = 0; i < quante; i++) { const s = spese[Math.floor(rnd() * spese.length)]; mov("u", Math.round((s[2] + rnd() * (s[3] - s[2])) / 10) * 10, s[0], s[1], d); }
    if (rnd() < .08) mov("e", Math.round((30000 + rnd() * 120000) / 100) * 100, "Fattura " + ["Bianchi", "Verdi", "Neri", "Galli"][Math.floor(rnd() * 4)], "fatture", d);
  }
  for (const d of K.occorrenze(D.leggi("ric:rossi"), dal, K.addG(o, -1))) w(`mov:rossi@${d}`, { id: `rossi@${d}`, ric: "rossi", tipo: "e", importo: 120000, desc: "Studio Rossi", cat: "lavoro", data: d, atteso: false, creato: t });
  mov("e", 80000, "Fattura Bianchi", "fatture", K.addG(o, 11)); D.scrivi("mov:p" + (n - 1), { ...D.leggi("mov:p" + (n - 1)), atteso: true });
  mov("u", 32000, "Regalo per mamma", "regali", K.addG(o, 18));
  w("busta:principale", { id: "principale", nome: "Principale", icona: "portafoglio", colore: K.COLORI_BUSTE[0], ordine: 0, creato: t });
  w("busta:sfizi", { id: "sfizi", nome: "Sfizi", icona: "scintilla", colore: K.COLORI_BUSTE[1], ordine: 1, iniziale: 15000, creato: t });
  w("busta:risparmi", { id: "risparmi", nome: "Risparmi", icona: "salvadanaio", colore: K.COLORI_BUSTE[2], ordine: 2, iniziale: 520000, creato: t });
  w("memoria", { bustaCat: { fuori: "sfizi", bar: "sfizi", svago: "sfizi" } });
  D.elenco("mov:").forEach(([k, m]) => { if (m.tipo === "u" && ["fuori", "bar", "svago"].includes(m.cat)) w(k, { ...m, busta: "sfizi" }); });
  w("profilo", { ...D.leggi("profilo"), versione: 2, distribuzione: { attiva: true, pct: { principale: 70, sfizi: 20, risparmi: 10 } } });
  D.elenco("mov:").forEach(([k, m]) => { if (m.tipo === "e" && !m.atteso && m.data <= o) w(k, { ...m, busta: "dividi", divisione: K.dividi(m.importo) }); });
  w("ric:rossi", { ...D.leggi("ric:rossi"), busta: "dividi" });
  w("sal:giappone", { id: "giappone", nome: "Viaggio in Giappone", icona: "aereo", colore: K.COLORI_BUSTE[2], iniziale: 120000, obiettivo: 300000, entro: K.addM(o, 8), creato: t, ordine: 1 });
  w("sal:capodanno", { id: "capodanno", nome: "Capodanno", icona: "stella", colore: K.COLORI_BUSTE[4], iniziale: 10000, obiettivo: 10000, creato: t, ordine: 3 });
  w("sal:fondo", { id: "fondo", nome: "Fondo di sicurezza", icona: "scudo", colore: K.COLORI_BUSTE[0], iniziale: 150000, obiettivo: 600000, creato: t, ordine: 2 });
  w("bud:sett", { id: "sett", nome: "Budget della settimana", importo: 40000, ogni: 1, unita: "s", inizio: K.lunedi(dal), cats: [], principale: true, creato: K.addG(o, -8) + "T08:00:00Z" });
  w("bud:fuori", { id: "fuori", nome: "Budget degli sfizi", importo: 35000, ogni: 1, unita: "m", inizio: K.primoMese(dal), cats: [], busta: "sfizi", principale: false, creato: t });
}

// ================= AVVIO =================
D.suCambio(() => { if (K.profilo() && $("#corpo")) { disegna(); if (U.foglio && !app.querySelector("#strato input:focus")) disegnaFoglio(); } });
D.suStato(s => { const el = $("#sync"); if (el) el.classList.toggle("si", s === "offline"), el.textContent = s === "offline" ? "Senza rete: salvo sul telefono" : "Sincronizzo…"; });
let giornoVisto = K.oggi();
document.addEventListener("visibilitychange", () => { if (!document.hidden && K.oggi() !== giornoVisto && $("#corpo")) { giornoVisto = K.oggi(); disegna(); } });

if ("serviceWorker" in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
  let ricaricato = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!ricaricato && !U.foglio) { ricaricato = true; location.reload(); } });
}

(async () => {
  try { if (await D.avvia()) dopoAccesso(); else accessoHtml(); }
  catch (e) { console.error(e); accessoHtml(); }
})();
