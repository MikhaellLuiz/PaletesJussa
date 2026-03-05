import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { pool } from "./db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Auth helpers ----------
function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET não configurado no .env");
  }
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ---------- Schemas ----------
const PedidoSchema = z.object({
  empresa: z.string().min(2),
  cidade: z.string().min(2),
  quantidade: z.coerce.number().int().positive(), // aceita number ou string do frontend
  tipo: z.enum(["PBR", "EURO", "OUTRO"]),
  observacoes: z.string().optional().default(""),
});

// ---------- Health ----------
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------- AUTH ROUTES ----------
app.post("/api/auth/register", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const { name, email, password } = parsed.data;

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) return res.status(409).json({ error: "Email já cadastrado" });

  const password_hash = await bcrypt.hash(password, 10);

  const created = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, password_hash]
  );

  const user = created.rows[0];
  const token = signToken(user);
  res.status(201).json({ user, token });
});

app.post("/api/auth/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const { email, password } = parsed.data;

  const found = await pool.query(
    "SELECT id, name, email, password_hash FROM users WHERE email = $1",
    [email]
  );

  if (!found.rows.length) return res.status(401).json({ error: "Credenciais inválidas" });

  const userRow = found.rows[0];
  const ok = await bcrypt.compare(password, userRow.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const user = { id: userRow.id, name: userRow.name, email: userRow.email };
  const token = signToken(user);
  res.json({ user, token });
});

// ---------- Pedidos ----------
app.get("/api/pedidos", async (req, res) => {
  const status = req.query.status?.toString();

  const values = [];
  let where = "";
  if (status) {
    values.push(status);
    where = `WHERE status = $1`;
  }

  const { rows } = await pool.query(
    `SELECT id, empresa, cidade, quantidade, tipo, status, observacoes, created_at
     FROM pedidos
     ${where}
     ORDER BY created_at DESC
     LIMIT 100`,
    values
  );

  const summaryRes = await pool.query(`
    SELECT
      COUNT(*)::int as total,
      SUM(CASE WHEN status = 'ABERTO' THEN 1 ELSE 0 END)::int as abertas,
      SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END)::int as concluidas
    FROM pedidos
  `);

  res.json({ items: rows, summary: summaryRes.rows[0] });
});

// Protegido: precisa estar logado para criar pedido
app.post("/api/pedidos", requireAuth, async (req, res) => {
  const parsed = PedidoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
  }

  const p = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO pedidos (empresa, cidade, quantidade, tipo, observacoes, status, user_id)
     VALUES ($1,$2,$3,$4,$5,'ABERTO',$6)
     RETURNING id, empresa, cidade, quantidade, tipo, status, observacoes, created_at`,
    [p.empresa, p.cidade, p.quantidade, p.tipo, p.observacoes ?? "", req.user.sub]
  );

  res.status(201).json(rows[0]);
});

app.patch("/api/pedidos/:id/status", async (req, res) => {
  const id = Number(req.params.id);

  const StatusSchema = z.object({
    status: z.enum(["ABERTO", "EM_COLETA", "CONCLUIDO"]),
  });

  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Status inválido" });

  const { rows } = await pool.query(
    `UPDATE pedidos SET status = $1
     WHERE id = $2
     RETURNING id, status`,
    [parsed.data.status, id]
  );

  if (rows.length === 0) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(rows[0]);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API rodando em http://localhost:${port}`));