import type postgres from "postgres";

type Client = ReturnType<typeof postgres>;

// Prepared statements let postgres.js skip the extra "describe" round trip it
// otherwise makes before every parameterized query, which halves the latency of
// almost every query. Supabase's transaction pooler (port 6543) cannot keep
// prepared statements, so they stay off there; the session pooler and direct
// connections support them.
export function canUsePreparedStatements(connectionString: string): boolean {
  try {
    return new URL(connectionString).port !== "6543";
  } catch {
    return false;
  }
}

// Drizzle runs every query through `client.unsafe()`, which postgres.js never
// prepares unless asked per call, so the client-level `prepare` option alone has
// no effect on Drizzle queries. Default `unsafe()` to prepared statements.
function preferPreparedUnsafe<T extends Client>(sql: T): T {
  const unsafe = sql.unsafe.bind(sql);
  sql.unsafe = ((query, parameters, options) =>
    unsafe(query, parameters ?? [], {
      prepare: true,
      ...options,
    })) as T["unsafe"];
  return sql;
}

// Also covers the handle Drizzle receives inside `db.transaction()`.
export function preferPreparedStatements(sql: Client): Client {
  preferPreparedUnsafe(sql);

  const begin = sql.begin.bind(sql) as (...args: unknown[]) => unknown;
  sql.begin = ((...args: unknown[]) => {
    const callbackIndex = args.findIndex((arg) => typeof arg === "function");
    const callback = args[callbackIndex] as (tx: Client) => unknown;
    args[callbackIndex] = (tx: Client) => callback(preferPreparedUnsafe(tx));
    return begin(...args);
  }) as Client["begin"];

  return sql;
}