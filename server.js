import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const PedidoSchema = z.object({
  empresa: z.string().min(2),
  cidade: z.string().min(2),
  quantidade: z.number().int().positive(),
  tipo: z.enum(["PBR", "EURO", "OUTRO"]),
  observacoes: z.string().optional().default("")
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

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

app.post("/api/pedidos", async (req, res) => {
  const parsed = PedidoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
  }

  const p = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO pedidos (empresa, cidade, quantidade, tipo, observacoes, status)
     VALUES ($1,$2,$3,$4,$5,'ABERTO')
     RETURNING id, empresa, cidade, quantidade, tipo, status, observacoes, created_at`,
    [p.empresa, p.cidade, p.quantidade, p.tipo, p.observacoes ?? ""]
  );

  res.status(201).json(rows[0]);
});

app.patch("/api/pedidos/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const StatusSchema = z.object({ status: z.enum(["ABERTO", "EM_COLETA", "CONCLUIDO"]) });

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