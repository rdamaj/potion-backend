import postgres from "postgres";

import { POSTGRES } from "../constants.js";

let sql = null;

const startConnection = async () => {
    if (sql == null) {
        // @ts-ignore
        sql = postgres(`postgresql://${POSTGRES.postgresUsername}:${POSTGRES.postgresPassword}@${POSTGRES.postgresURL}:${POSTGRES.postgresPort}/${POSTGRES.postgresDatabase}`, {
            prepare: false,
            connect_timeout: 12,
        });
    }
};

const getOneByID = async (tableName, data, idName = 'id') => {
    try {
        let result = await sql`
            SELECT *
            FROM ${sql(tableName)}
            ${
            data[idName]
                ? sql`where ${sql(idName)} = ${ data[idName] }`
                : sql``
        }
            `;
        return result[0];
    } catch(e) {
        console.error(e);
        return null;
    }
}

const selectMany = async (query) => {
    try {
        let result = await query;
        return result;
    } catch(e) {
        console.error(e);
        return null;
    }
}

const selectOne = async (query) => {
    try {
        let result = await query;
        return result[0];
    } catch(e) {
        console.error(e);
        return null;
    }
}

const insertOne = async (tableName, data, values, logError = false, idName = 'id') => {
    try {
        let result = await sql`
            INSERT INTO ${sql(tableName)} ${
                sql(data, values)
            } 
            RETURNING ${sql(idName)}`;
        return result[0][idName];
    } catch(e) {
        if(logError) {
            console.error(e);
        }
        return null;
    }
}

const insertMany = async (tableName, data) => {
    try {
        let result = await sql`
            INSERT INTO ${sql(tableName)} ${sql(data)} 
            RETURNING id`;
        return result;
    } catch(e) {
        console.error(e);
        return null;
    }
}

const upsertMany = async (tableName, data, uniqueColumns = ['id']) => {
    try {
        const updateColumns = Object.keys(data[0]).filter(col => !uniqueColumns.includes(col));
        const allColumns = Object.keys(data[0]);
        const query = `
            INSERT INTO "${tableName}" (${allColumns.map(col => `"${col}"`).join(', ')}) 
            VALUES ${data.map(row => 
                `(${Object.values(row).map(val => 
                    typeof val === 'string' ? `'${val}'` : val
                ).join(', ')})`
            ).join(', ')}
            ON CONFLICT ("${uniqueColumns.join('", "')}") 
            DO UPDATE SET ${updateColumns.map(col => `"${col}" = EXCLUDED."${col}"`).join(', ')}
            RETURNING id;
        `;        
        const result = await sql.unsafe(query);
        return result;
    } catch(e) {
        console.error('Error in upsertMany:', e);
        console.error('Error details:', e.message);
        return null;
    }
}

const upsertOne = async (tableName, data, uniqueColumns = ['id']) => {
    try {
        const updateColumns = Object.keys(data).filter(col => !uniqueColumns.includes(col));
        const allColumns = Object.keys(data);
        const query = `
            INSERT INTO "${tableName}" (${allColumns.map(col => `"${col}"`).join(', ')}) 
            VALUES (${Object.values(data).map(val => 
                typeof val === 'string' ? `'${val}'` : val
            ).join(', ')})
            ON CONFLICT ("${uniqueColumns.join('", "')}") 
            DO UPDATE SET ${updateColumns.map(col => `"${col}" = EXCLUDED."${col}"`).join(', ')}
            RETURNING id;
        `;
        const result = await sql.unsafe(query);
        return result[0].id;
    } catch(e) {
        console.error('Error in upsertOne:', e);
        console.error('Error details:', e.message);
        return null;
    }
}

const updateOne = async (tableName, id, data, values, idName = 'id') => {
    try {
        await sql`
            UPDATE ${sql(tableName)} 
            SET ${
            sql(data, values)
        }
            WHERE ${sql(idName)} = ${id}`
        return true;
    } catch(e) {
        console.error(e);
        return false;
    }
}

const endConnection = async () => {
    if(sql != null) {
        await sql.end();
        sql = null;
    }
};

export {
    sql,
    startConnection,
    endConnection,
    getOneByID,
    insertOne,
    insertMany,
    updateOne,
    selectOne,
    selectMany,
    upsertOne,
    upsertMany,
};
