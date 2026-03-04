CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  empresa VARCHAR(120) NOT NULL,
  cidade VARCHAR(80) NOT NULL,
  quantidade INT NOT NULL CHECK (quantidade > 0),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('PBR','EURO','OUTRO')),
  status VARCHAR(12) NOT NULL CHECK (status IN ('ABERTO','EM_COLETA','CONCLUIDO')),
  observacoes TEXT NOT NULL DEFAULT '