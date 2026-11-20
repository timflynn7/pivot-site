// Where orders are kept.
// With DATABASE_URL set (on Render), orders live in Postgres and survive deploys.
// Without it (on your own computer), they go in data/orders.json as before.
// Each order is stored whole as JSON, so adding a field to orders needs no
// database change.
const fs = require("fs");
const path = require("path");

function fileStore(dir) {
  const file = path.join(dir, "orders.json");
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return []; } };
  const write = (orders) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(orders, null, 2));
    fs.renameSync(file + ".tmp", file);
  };
  // One change at a time, so two quick updates can't overwrite each other.
  let queue = Promise.resolve();
  const serial = (fn) => (queue = queue.then(fn, fn));
  return {
    kind: "file",
    async init() {},
    async list() { return read().slice().reverse(); },
    async get(ref) { return read().find((o) => o.ref === ref) || null; },
    add: (order) => serial(() => { const all = read(); all.push(order); write(all); return order; }),
    update: (ref, change) => serial(() => {
      const all = read();
      const i = all.findIndex((o) => o.ref === ref);
      if (i < 0) return null;
      const next = change(structuredClone(all[i]));
      if (!next) return all[i];
      all[i] = next; write(all);
      return next;
    })
  };
}

function pgStore(url) {
  const { Pool } = require("pg");
  // Render's internal database address needs no SSL; set DATABASE_SSL=true
  // when connecting from outside Render with the external address.
  const pool = new Pool({ connectionString: url, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false, max: 5 });
  return {
    kind: "postgres",
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS orders (
        ref text PRIMARY KEY,
        created timestamptz NOT NULL DEFAULT now(),
        data jsonb NOT NULL)`);
    },
    async list() {
      const r = await pool.query("SELECT data FROM orders ORDER BY created DESC LIMIT 500");
      return r.rows.map((x) => x.data);
    },
    async get(ref) {
      const r = await pool.query("SELECT data FROM orders WHERE ref = $1", [ref]);
      return r.rows[0] ? r.rows[0].data : null;
    },
    async add(order) {
      await pool.query("INSERT INTO orders (ref, created, data) VALUES ($1, $2, $3)", [order.ref, order.created, order]);
      return order;
    },
    // Locks the row while it changes, so Stripe and the admin page can't clash.
    async update(ref, change) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const r = await c.query("SELECT data FROM orders WHERE ref = $1 FOR UPDATE", [ref]);
        if (!r.rows[0]) { await c.query("ROLLBACK"); return null; }
        const next = change(r.rows[0].data);
        if (next) await c.query("UPDATE orders SET data = $2 WHERE ref = $1", [ref, next]);
        await c.query("COMMIT");
        return next || r.rows[0].data;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
    end: () => pool.end()
  };
}

module.exports = function makeStore({ databaseUrl, dataDir }) {
  return databaseUrl ? pgStore(databaseUrl) : fileStore(dataDir);
};
