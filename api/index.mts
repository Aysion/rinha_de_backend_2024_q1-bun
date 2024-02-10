import { env } from 'bun'
import { Database } from 'bun:sqlite'

const db = new Database('./data/database.SQLite3')

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA threads = 4;');
db.exec('PRAGMA busy_timeout = 30000;');
db.exec('PRAGMA temp_store = MEMORY;');
db.exec('PRAGMA cache_size = 10000;');
db.exec('PRAGMA auto_vacuum = FULL;');
db.exec('PRAGMA automatic_indexing = TRUE;');
db.exec('PRAGMA count_changes = FALSE;');
db.exec('PRAGMA encoding = "UTF-8";');
db.exec('PRAGMA ignore_check_constraints = TRUE;');
db.exec('PRAGMA incremental_vacuum = 0;');
db.exec('PRAGMA legacy_file_format = FALSE;');
db.exec('PRAGMA optimize = On;');
db.exec('PRAGMA synchronous = NORMAL;');

db.exec(`DROP TABLE IF EXISTS clientes`)
db.exec(`DROP TABLE IF EXISTS transacoes`)
db.exec(`CREATE TABLE IF NOT EXISTS clientes (
	id INTEGER PRIMARY KEY,
	nome TEXT,
	limite INTEGER,
	saldo INTEGER DEFAULT 0
)`)
db.exec(`CREATE TABLE IF NOT EXISTS transacoes (
	id INTEGER PRIMARY KEY,
	cliente_id INTEGER,
	valor INTEGER,
	tipo TEXT,
	descricao TEXT,
	realizada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`)
db.exec(`INSERT INTO clientes (nome, limite) VALUES
	('o barato sai caro', 1000 * 100),
	('zan corp ltda', 800 * 100),
	('les cruders', 10000 * 100),
	('padaria joia de cocaia', 100000 * 100),
	('kid mais', 5000 * 100)`)

const server = Bun.serve({
	port: env.PORT,
	async fetch(req) {
		const url = new URL(req.url)
		const urlParams = url.pathname.split('/').slice(1)
		const body = req.method == 'POST' ? await req.json() : null
		const { code, data } = await processRequest({ method: req.method, urlParams, body })

		return new Response(JSON.stringify(data), { status: code, headers: { 'Content-Type': 'application/json' } })
	},
})

console.log(`Listening on http://localhost:${ server.port } ...`)

async function processRequest({ method, urlParams, body }: { method: string, urlParams: string[], body: any }): Promise<{ code: number, data: any }> {
	if (urlParams[0] === 'clientes') {
		const id = parseInt(urlParams[1])

		if (id > 0 && id < 6) {
			if (urlParams[2] === 'extrato' && method === 'GET') return clientes.extrato(id)
			else if (urlParams[2] === 'transacoes' && method === 'POST') return clientes.transacoes(id, body)
		}
	}

	return { code: 404, data: '' }
}

const clientes = {
	async transacoes(id: number, body: { valor: number, tipo: 'c' | 'd', descricao: string }) {
		if (body.valor < 0 || parseInt(body.valor as any) != body.valor) return { code: 422, data: null }
		if (!['c', 'd'].includes(body.tipo)) return { code: 422, data: null }
		if (!body.descricao || body.descricao.length === 0 || body.descricao.length > 10) return { code: 422, data: null }

		let query = db.prepare('SELECT * FROM clientes WHERE id = ?')
		const cliente = query.get(id) as { saldo: number, limite: number }
		query.finalize()

		if (body.tipo === 'c') cliente.saldo += +body.valor
		else {
			cliente.saldo -= body.valor

			if (cliente.saldo < -cliente.limite) return { code: 422, data: null }
		}

		query = db.prepare('UPDATE clientes SET saldo = ? WHERE id = ?')
		query.run(cliente.saldo, id)
		query.finalize()

		query = db.prepare('INSERT INTO transacoes (cliente_id, valor, tipo, descricao) VALUES (?, ?, ?, ?)')
		query.run(id, body.valor, body.tipo, body.descricao)
		query.finalize()

		return {
			code: 200,
			data: {
				limite: cliente.limite,
				saldo: cliente.saldo,
			}
		}
	},
	async extrato(id: number) {
		let query = db.prepare('SELECT * FROM clientes WHERE id = ?')
		const cliente = query.get(id) as { saldo: number, limite: number }
		query.finalize()

		query = db.prepare('SELECT * FROM transacoes WHERE cliente_id = ? ORDER BY ID DESC LIMIT 10')
		const transacoes = query.all(id)
		query.finalize()

		return {
			code: 200,
			data: {
				saldo: {
					total: cliente.saldo,
					data_extrato: new Date().toISOString(),
					limite: cliente.limite
				},
				ultimas_transacoes: transacoes,
			},
		}
	},
}
