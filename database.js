const path = require('path');
const { postgresConfig } = require('./postgres-config');

function normalizeArgs(params, callback) {
    if (typeof params === 'function') {
        return { params: [], callback: params };
    }
    return { params: params || [], callback: callback || (() => {}) };
}

function postgresPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
}

function postgresSql(sql) {
    let converted = sql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
    const insertTarget = converted.match(/^\s*INSERT\s+INTO\s+(users|employees|evaluations)\b/i);
    if (insertTarget && !/\bRETURNING\b/i.test(converted)) {
        converted = `${converted.trim().replace(/;$/, '')} RETURNING id`;
    }
    return postgresPlaceholders(converted);
}

class PostgresDatabase {
    constructor(connectionString, callback) {
        const { Pool } = require('pg');
        this.pool = new Pool(postgresConfig(connectionString));
        this.serializing = false;
        this.serialQueue = Promise.resolve();

        this.pool.query('SELECT 1')
            .then(() => callback(null))
            .catch(callback);
    }

    serialize(work) {
        this.serializing = true;
        try {
            work();
        } finally {
            this.serializing = false;
        }
    }

    execute(sql, params) {
        const query = () => this.pool.query(postgresSql(sql), params);
        if (!this.serializing) return query();

        const pending = this.serialQueue.then(query, query);
        this.serialQueue = pending.catch(() => {});
        return pending;
    }

    run(sql, params, callback) {
        const args = normalizeArgs(params, callback);
        this.execute(sql, args.params)
            .then((result) => {
                const context = {
                    lastID: result.rows[0]?.id,
                    changes: result.rowCount
                };
                args.callback.call(context, null);
            })
            .catch((error) => args.callback.call({ lastID: undefined, changes: 0 }, error));
        return this;
    }

    get(sql, params, callback) {
        const args = normalizeArgs(params, callback);
        this.execute(sql, args.params)
            .then((result) => args.callback(null, result.rows[0]))
            .catch((error) => args.callback(error));
        return this;
    }

    all(sql, params, callback) {
        const args = normalizeArgs(params, callback);
        this.execute(sql, args.params)
            .then((result) => args.callback(null, result.rows))
            .catch((error) => args.callback(error));
        return this;
    }

    close(callback = () => {}) {
        this.pool.end().then(() => callback(null)).catch(callback);
    }
}

function createDatabase(callback) {
    if (process.env.DATABASE_URL) {
        return new PostgresDatabase(process.env.DATABASE_URL, callback);
    }

    const sqlite3 = require('sqlite3').verbose();
    const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, 'database.sqlite');
    return new sqlite3.Database(sqlitePath, callback);
}

module.exports = { createDatabase, postgresSql };
