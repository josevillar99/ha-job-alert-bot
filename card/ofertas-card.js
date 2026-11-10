// Tarjeta "Ofertas" para Home Assistant: muestra las ofertas que guarda el bot de empleo en una lista
// de tareas, enteras (sin cortar el texto), ordenadas por nota. Al pulsar el título se abre la oferta.
//
// Instalación: copia la carpeta ofertas a /config/www/ y añade el recurso
//   /local/ofertas/ofertas-card.js?v=2   (tipo: Módulo JavaScript)
// Uso:
//   type: custom:ofertas-card
//   entity: todo.ofertas_empleo
//   titulo: Ofertas de empleo     (opcional)
//   completadas: false            (opcional; true para ver también las marcadas como vistas)
//
// Las que empiezan por "🔁" (empresa muy buena pero fuera de zona) salen en morado con la marca
// "Renegociar ubicación".
//
// "Ya vista" marca la oferta como completada: deja de salir, pero el bot la recuerda y no la repite.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ENLACE_MD = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/;
const ENLACE_SUELTO = /(https?:\/\/[^\s)]+)/;
const SIN_DATO = /^(no indicado|no indicada)$/i;

// Separa lo que escribe el bot: "78 % · Empresa – Puesto" y la descripción con el enlace y los datos
function trocea(item) {
  const m = /^\s*(\d{1,3})\s*%\s*·\s*(.*)$/.exec(item.summary || "");
  const nota = m ? Number(m[1]) : null;
  let titulo = (m ? m[2] : item.summary || "").trim();
  // "🔁" = oferta muy buena pero fuera de zona: habría que renegociar la ubicación o el remoto
  let renegociar = /^🔁\s*/.test(titulo);
  titulo = titulo.replace(/^🔁\s*/, "");
  const corte = titulo.indexOf(" – ");
  const empresa = corte > 0 ? titulo.slice(0, corte) : titulo;
  const puesto = corte > 0 ? titulo.slice(corte + 3) : "";

  let desc = item.description || "";
  let enlace = null;
  const md = ENLACE_MD.exec(desc);
  if (md) { enlace = md[2]; desc = desc.replace(md[0], ""); }
  else { const u = ENLACE_SUELTO.exec(desc); if (u) { enlace = u[1]; desc = desc.replace(u[0], ""); } }

  let resumen = "";
  const datos = [];
  for (const linea of desc.split("\n").map(s => s.trim()).filter(Boolean)) {
    if (/^[-*]\s+/.test(linea)) {
      const t = linea.replace(/^[-*]\s+/, "");
      const p = t.indexOf(": ");
      const k = p > 0 ? t.slice(0, p) : "";
      const v = p > 0 ? t.slice(p + 2) : t;
      if (!SIN_DATO.test(v.trim())) datos.push({ k, v });
    } else resumen += (resumen ? " " : "") + linea;
  }
  resumen = resumen.replace(/^\s*·\s*/, "").replace(/\s*·\s*$/, "").trim();
  if (/^🔁\s*Renegociar:?\s*/i.test(resumen)) { renegociar = true; resumen = resumen.replace(/^🔁\s*Renegociar:?\s*/i, ""); }
  return { uid: item.uid, hecha: item.status === "completed", nota, empresa, puesto, enlace, resumen, datos, renegociar };
}

const colorNota = (n, reneg) => (reneg ? "#b39ddb" : n == null ? "#9e9e9e" : n >= 80 ? "#3ddc84" : n >= 65 ? "#ffb74d" : "#9e9e9e");

class OfertasCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error("Falta entity (por ejemplo todo.ofertas_empleo)");
    const cambia = this._c && this._c.entity !== config.entity;
    this._c = { titulo: "Ofertas de empleo", completadas: false, ...config };
    if (cambia) { this._corta(); this._items = null; }
    this._suscribe();
    this._pinta();
  }

  set hass(h) { this._hass = h; this._suscribe(); }
  connectedCallback() { this._suscribe(); this._pinta(); }
  disconnectedCallback() { this._corta(); }
  getCardSize() { return 2 + 3 * ((this._items || []).length || 1); }
  getGridOptions() { return { columns: "full", min_columns: 6 }; }
  static getStubConfig() { return { entity: "todo.ofertas_empleo" }; }

  _corta() { if (this._unsub) { try { this._unsub(); } catch (e) {} } this._unsub = null; }

  // Se suscribe a la lista: cuando el bot añade una oferta o se marca una, se repinta sola
  async _suscribe() {
    if (!this._hass || !this._c || !this.isConnected || this._unsub || this._subiendo) return;
    this._subiendo = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        msg => { this._items = msg.items || []; this._error = null; this._pinta(); },
        { type: "todo/item/subscribe", entity_id: this._c.entity });
    } catch (e) {
      await this._lee();
    }
    this._subiendo = false;
  }

  async _lee() {
    try {
      const r = await this._hass.callWS({ type: "todo/item/list", entity_id: this._c.entity });
      this._items = r.items || []; this._error = null;
    } catch (e) { this._error = (e && e.message) || "No se pudo leer " + this._c.entity; }
    this._pinta();
  }

  async _marca(uid, hecha) {
    try {
      await this._hass.callService("todo", "update_item",
        { item: uid, status: hecha ? "completed" : "needs_action" }, { entity_id: this._c.entity });
      if (!this._unsub) await this._lee();
    } catch (e) { this._error = (e && e.message) || "No se pudo actualizar"; this._pinta(); }
  }

  _pinta() {
    if (!this._c) return;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    const todas = (this._items || []).map(trocea);
    const lista = todas.filter(o => this._c.completadas || !o.hecha)
      .sort((a, b) => (a.hecha - b.hecha) || ((b.nota ?? -1) - (a.nota ?? -1)));

    const fila = o => `
      <div class="of ${o.hecha ? "hecha" : ""}">
        <div class="nota" style="--c:${colorNota(o.nota, o.renegociar)}">${o.nota == null ? "–" : o.nota + "%"}</div>
        <div class="cuerpo">
          ${o.enlace
            ? `<a class="tit enl" href="${esc(o.enlace)}" target="_blank" rel="noopener noreferrer"><b>${esc(o.empresa)}</b>${o.puesto ? ` <span>· ${esc(o.puesto)}</span>` : ""} <i>↗</i></a>`
            : `<div class="tit"><b>${esc(o.empresa)}</b>${o.puesto ? ` <span>· ${esc(o.puesto)}</span>` : ""}</div>`}
          ${o.renegociar ? `<div class="reneg">🔁 Renegociar ubicación</div>` : ""}
          ${o.resumen ? `<div class="res">${esc(o.resumen)}</div>` : ""}
          ${o.datos.length ? `<ul>${o.datos.map(d => `<li>${d.k ? `<span class="k">${esc(d.k)}</span> ` : ""}${esc(d.v)}</li>`).join("")}</ul>` : ""}
          <div class="acc">
            <button class="vista" data-uid="${esc(o.uid)}" data-hecha="${o.hecha ? "0" : "1"}">${o.hecha ? "Recuperar" : "Ya vista"}</button>
          </div>
        </div>
      </div>`;

    const cuerpo = this._error ? `<div class="vacio err">${esc(this._error)}</div>`
      : this._items == null ? `<div class="vacio">Cargando…</div>`
      : lista.length ? lista.map(fila).join("")
      : `<div class="vacio">No hay ofertas nuevas.</div>`;
    const pendientes = todas.filter(o => !o.hecha).length;

    root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card, .card { display: block; padding: 16px; }
        .cab { display: flex; align-items: baseline; gap: 8px; margin: 0 0 8px; }
        .cab h2 { margin: 0; font-size: 1.15rem; font-weight: 600; color: var(--primary-text-color); }
        .cab .n { color: var(--secondary-text-color); font-size: .9rem; }
        .of { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--divider-color, rgba(127,127,127,.25)); }
        .of:first-of-type { border-top: 0; }
        .of.hecha { opacity: .55; }
        .nota { flex: 0 0 auto; min-width: 46px; height: 28px; padding: 0 6px; border-radius: 14px; display: flex;
                align-items: center; justify-content: center; font-weight: 700; font-size: .9rem;
                background: var(--c); color: #111; box-sizing: border-box; }
        .cuerpo { flex: 1; min-width: 0; }
        .tit { color: var(--primary-text-color); font-size: 1rem; line-height: 1.35; overflow-wrap: anywhere; }
        .tit span { font-weight: 400; }
        a.tit { display: block; text-decoration: none; }
        a.tit, a.tit span { color: var(--primary-color, #03a9f4); }
        a.tit i { font-style: normal; font-size: .9em; }
        .reneg { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 12px; font-size: .85rem;
                 background: rgba(179,157,219,.18); color: #b39ddb; }
        .res { color: var(--secondary-text-color); margin-top: 4px; line-height: 1.4; overflow-wrap: anywhere; }
        ul { margin: 6px 0 0; padding: 0; list-style: none; color: var(--secondary-text-color); font-size: .92rem; line-height: 1.45; }
        li { overflow-wrap: anywhere; }
        .k { color: var(--primary-text-color); opacity: .8; }
        .k::after { content: ":"; }
        .acc { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .vista { font: inherit; font-size: .9rem; border-radius: 18px; padding: 6px 14px; cursor: pointer; text-decoration: none; }
        .vista { background: transparent; color: var(--secondary-text-color); border: 1px solid var(--divider-color, rgba(127,127,127,.4)); }
        .vacio { color: var(--secondary-text-color); padding: 8px 0; }
        .err { color: var(--error-color, #db4437); }
      </style>
      <ha-card>
        <div class="card">
          <div class="cab"><h2>${esc(this._c.titulo)}</h2>${this._items ? `<span class="n">${pendientes} pendiente${pendientes === 1 ? "" : "s"}</span>` : ""}</div>
          ${cuerpo}
        </div>
      </ha-card>`;
    root.querySelectorAll("button.vista").forEach(b => b.addEventListener("click", () => this._marca(b.dataset.uid, b.dataset.hecha === "1")));
  }
}

if (!customElements.get("ofertas-card")) customElements.define("ofertas-card", OfertasCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === "ofertas-card"))
  window.customCards.push({ type: "ofertas-card", name: "Ofertas de empleo", description: "Ofertas del bot, enteras y con enlace" });
