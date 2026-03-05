CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  empresa VARCHAR(120) NOT NULL,
  cidade VARCHAR(80) NOT NULL,
  quantidade INT NOT NULL CHECK (quantidade > 0),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('PBR','EURO','OUTRO')),
  status VARCHAR(12) NOT NULL CHECK (status IN ('ABERTO','EM_COLETA','CONCLUIDO')),

  observacoes TEXT NOT NULL DEFAULT '
  CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Opcional: se quiser que cada pedido tenha "dono"
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS user_id INT NULL REFERENCES users(id);
