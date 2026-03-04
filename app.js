const API_BASE = "http://localhost:3000/api";

const form = document.getElementById("formPedido");
const hint = document.getElementById("formHint");
const tableBody = document.querySelector("#pedidosTable tbody");
const statusFilter = document.getElementById("statusFilter");

const statTotal = document.getElementById("statTotal");
const statAbertas = document.getElementById("statAbertas");
const statConcluidas = document.getElementById("statConcluidas");

document.getElementById("year").textContent = new Date().getFullYear();

function badge(status){
  return `<span class="badge badge--${status}">${status}</span>`;
}

function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleString("pt-BR");
}

async function fetchPedidos(){
  const status = statusFilter.value;
  const url = new URL(`${API_BASE}/pedidos`);
  if (status) url.searchParams.set("status", status);

  const res = await fetch(url);
  if(!res.ok) throw new Error("Falha ao carregar pedidos");
  return res.json();
}

async function refresh(){
  const data = await fetchPedidos();

  tableBody.innerHTML = data.items.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.empresa}</td>
      <td>${p.cidade}</td>
      <td>${p.quantidade}</td>
      <td>${p.tipo}</td>
      <td>${badge(p.status)}</td>
      <td>${fmtDate(p.created_at)}</td>
    </tr>
  `).join("");

  statTotal.textContent = data.summary.total;
  statAbertas.textContent = data.summary.abertas;
  statConcluidas.textContent = data.summary.concluidas;
}

document.getElementById("btnRefresh").addEventListener("click", () => refresh());
statusFilter.addEventListener("change", () => refresh());

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hint.textContent = "Enviando...";

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.quantidade = Number(payload.quantidade);

  const res = await fetch(`${API_BASE}/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    hint.textContent = err.error || "Erro ao enviar.";
    return;
  }

  form.reset();
  hint.textContent = "Solicitação criada com sucesso.";
  await refresh();
});

refresh().catch(err => {
  console.error(err);
  hint.textContent = "Não consegui conectar no backend. Ele está rodando em localhost:3000?";
});