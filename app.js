const state = {
  incidents: [],
  complications: [],
  contacts: [],
  mission: [],
  current: null,
  step: 0,
  resolved: 0,
  complication: false,
  previous: null,
  previousStep: 0,
  active: false,
};

const $ = (selector) => document.querySelector(selector);

async function loadJson(url) {
  try {
    const response = await fetch(url);
    if (response.ok) return response.json();
  } catch (error) {
    // In static hosting, fall back to local JSON copies.
  }

  const fallback = url.endsWith("incidentes")
    ? "./data/incidentes.json"
    : "./data/responsables.json";
  const response = await fetch(fallback);
  if (!response.ok) throw new Error(`No se pudo cargar ${fallback}`);
  return response.json();
}

async function initialize() {
  const [incidentData, contactData] = await Promise.all([
    loadJson("/api/incidentes"),
    loadJson("/api/responsables"),
  ]);
  state.incidents = incidentData.misiones || [];
  state.complications = incidentData.complicaciones || [];
  state.contacts = contactData.responsables || [];

  document.querySelectorAll("[data-start]").forEach((button) => button.addEventListener("click", startMission));
  startMission();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function startMission() {
  state.mission = shuffled(state.incidents).slice(0, 5);
  state.resolved = 0;
  state.step = 0;
  state.current = state.mission[0];
  state.complication = false;
  state.previous = null;
  state.previousStep = 0;
  state.active = true;
  renderCurrent();
}

function loseMission() {
  state.active = false;
  $("#status").textContent = "MISIÓN FALLIDA // PROTOCOLO INTERRUMPIDO";
  $("#incident-info").innerHTML = `
    <div class="incident-code">MISIÓN TERMINADA</div>
    <div class="incident-step">Decisión incorrecta</div>`;
  $("#decision").innerHTML = '<button class="decision-option" type="button" id="restart">INICIAR NUEVA MISIÓN</button>';
  $("#restart").addEventListener("click", startMission);
  clearMarker();
}

function winMission() {
  state.active = false;
  $("#status").textContent = "MISIÓN COMPLETADA // TODOS LOS SISTEMAS ESTABLES";
  $("#incident-info").innerHTML = `
    <div class="incident-code">OPERACIÓN FINALIZADA</div>
    <div class="incident-step">${state.resolved} incidentes resueltos</div>`;
  $("#decision").innerHTML = '<button class="decision-option" type="button" id="restart">NUEVA MISIÓN</button>';
  $("#restart").addEventListener("click", startMission);
  clearMarker();
}

function clearMarker() {
  $("#marker-layer").innerHTML = "";
}

function renderCurrent() {
  if (!state.current || !state.active) return;
  const step = state.current.pasos[state.step];
  $("#status").textContent = `INCIDENTES ${String(state.resolved).padStart(2, "0")}/${String(state.mission.length).padStart(2, "0")} // ${state.current.codigo}`;
  $("#incident-info").innerHTML = `
    <div class="incident-code">${state.current.codigo} · ${state.current.categoria.toUpperCase()}</div>
    <div class="incident-step">${step.titulo}</div>
    <div>${step.texto}</div>`;
  renderDecision(step);
  renderMarker(state.current);
}

function renderDecision(step) {
  const decision = $("#decision");
  decision.innerHTML = '<div class="decision-heading">DECISIÓN OPERATIVA</div>';

  if (step.tipo === "llamada") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "call-button";
    button.textContent = "DESPLEGAR TELÉFONO";
    button.addEventListener("click", openPhone);
    decision.append(button);
    return;
  }

  (step.opciones || []).forEach((text, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "decision-option";
    button.textContent = `${String.fromCharCode(65 + index)}  //  ${text}`;
    button.addEventListener("click", () => {
      if (index === step.respuesta_correcta) advanceStep();
      else loseMission();
    });
    decision.append(button);
  });
}

function advanceStep() {
  if (state.complication) {
    state.complication = false;
    state.current = state.previous;
    state.step = state.previousStep + 1;
    if (state.step < state.current.pasos.length) {
      renderCurrent();
      return;
    }
  } else {
    if (
      state.complications.length &&
      Math.random() < 0.28 &&
      !state.complication
    ) {
      state.previous = state.current;
      state.previousStep = state.step;
      state.current = shuffled(state.complications)[0];
      state.step = 0;
      state.complication = true;
      $("#status").textContent = "ALERTA SECUNDARIA // NUEVO EVENTO EN EL MAPA";
      renderCurrent();
      return;
    }
    state.step += 1;
  }

  if (state.step < state.current.pasos.length) {
    renderCurrent();
    return;
  }

  state.resolved += 1;
  const position = state.mission.indexOf(state.current);
  if (position >= 0 && position + 1 < state.mission.length) {
    state.current = state.mission[position + 1];
    state.step = 0;
    renderCurrent();
  } else {
    winMission();
  }
}

function renderMarker(incident) {
  const layer = $("#marker-layer");
  layer.innerHTML = "";
  const position = incident.posicion || [500, 350];
  const x = Math.max(55, Math.min(945, position[0] * 2.1));
  const y = Math.max(55, Math.min(645, position[1] * 2.1));

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "event-marker");
  group.innerHTML = `
    <circle class="marker-pulse" cx="${x}" cy="${y}" r="18" fill="none" stroke="#d65a5a" stroke-width="3"/>
    <circle cx="${x}" cy="${y}" r="14" fill="#d65a5a" stroke="#ffd1cb" stroke-width="3"/>
    <text x="${x}" y="${y + 6}" text-anchor="middle" fill="#fff" font-size="20" font-weight="bold">!</text>
    <rect x="${Math.min(690, x + 25)}" y="${Math.max(20, y - 74)}" width="260" height="82" rx="3" fill="#171c18" stroke="#d65a5a" stroke-width="2"/>
    <text x="${Math.min(690, x + 25) + 12}" y="${Math.max(20, y - 74) + 22}" fill="#ffccb9" font-size="13" font-weight="bold">${incident.codigo}</text>
    <text x="${Math.min(690, x + 25) + 12}" y="${Math.max(20, y - 74) + 48}" fill="#edf0e4" font-size="12">${incident.titulo}</text>`;
  layer.append(group);
}

function openPhone() {
  const dialog = $("#phone-dialog");
  resetPhone();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function resetPhone() {
  $("#dial-number").textContent = "";
  $("#call-state").textContent = "SIN LLAMADA";
  $("#call-response").textContent = "";
  $("#agenda-view").innerHTML = "";
  state.contacts.forEach((contact) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "agenda-contact";
    button.innerHTML = `<strong>${contact.nombre}</strong><span>${contact.telefono} · ${contact.area}</span>`;
    button.addEventListener("click", () => callContact(contact));
    $("#agenda-view").append(button);
  });
  showDial();
}

function showDial() {
  $("#dial-view").classList.remove("hidden");
  $("#agenda-view").classList.add("hidden");
  $("#dial-tab").classList.add("active");
  $("#agenda-tab").classList.remove("active");
}

function showAgenda() {
  $("#dial-view").classList.add("hidden");
  $("#agenda-view").classList.remove("hidden");
  $("#dial-tab").classList.remove("active");
  $("#agenda-tab").classList.add("active");
}

function callContact(contact) {
  $("#dial-number").textContent = contact.telefono;
  $("#call-state").textContent = "LLAMANDO...";
  $("#call-response").textContent = "";
  window.setTimeout(() => answerCall(contact), 700);
}

function answerCall(contact) {
  const step = state.current.pasos[state.step];
  if (contact.nombre === step.responsable) {
    $("#call-state").textContent = "RESPUESTA RECIBIDA";
    $("#call-response").textContent = contact.respuesta;
    window.setTimeout(() => {
      $("#phone-dialog").close();
      advanceStep();
    }, 1800);
  } else {
    $("#call-state").textContent = "CONEXIÓN ESTABLECIDA";
    $("#call-response").textContent = "Aquí no es el área correspondiente.";
  }
}

function setupPhone() {
  $("#dial-tab").addEventListener("click", showDial);
  $("#agenda-tab").addEventListener("click", showAgenda);
  $("#hangup-key").addEventListener("click", () => $("#phone-dialog").close());
  document.querySelectorAll("[data-digit]").forEach((key) => {
    key.addEventListener("click", () => {
      $("#dial-number").textContent += key.dataset.digit;
    });
  });
  $("#backspace-key").addEventListener("click", () => {
    $("#dial-number").textContent = $("#dial-number").textContent.slice(0, -1);
  });
  $("#call-key").addEventListener("click", () => {
    const number = $("#dial-number").textContent.trim();
    const contact = state.contacts.find((item) => item.telefono === number);
    if (contact) callContact(contact);
    else {
      $("#call-state").textContent = "NÚMERO NO DISPONIBLE";
      $("#call-response").textContent = "El número no figura en la agenda.";
    }
  });
}

function updateClock() {
  const now = new Date();
  $("#clock").textContent = now.toLocaleTimeString("es-ES", { hour12: false });
}

setupPhone();
initialize().catch((error) => {
  $("#status").textContent = "ERROR DE CARGA";
  $("#incident-info").innerHTML = `<div class="incident-step">${error.message}</div>`;
});
setInterval(updateClock, 1000);
