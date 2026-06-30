import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;
let dbInstance: any = null;

export const getPool = () => {
  if (!poolInstance) {
    poolInstance = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 5,
      idleTimeoutMillis: 2000,
      connectionTimeoutMillis: 10000, // increased connection timeout for cold starts
    });
    poolInstance.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });

    // Wrap pool.query with transparent retry logic for cold starts
    const originalQuery = poolInstance.query.bind(poolInstance);
    poolInstance.query = async function (this: any, ...args: any[]) {
      let retries = 10;
      let delay = 1500;
      while (retries > 0) {
        try {
          return await originalQuery(...args);
        } catch (error: any) {
          const isConnectionError = 
            error.message?.includes("terminated") || 
            error.message?.includes("connection") || 
            error.message?.includes("timeout") ||
            error.code === "ECONNREFUSED" ||
            error.code === "57P01";
          
          if (isConnectionError && retries > 1) {
            console.warn(`[DB Cold Start] Query error, retrying in ${delay}ms... (Remaining retries: ${retries - 1}) Error:`, error.message);
            retries--;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 4000);
          } else {
            throw error;
          }
        }
      }
    } as any;

    // Wrap pool.connect with transparent retry logic for cold starts
    const originalConnect = poolInstance.connect.bind(poolInstance);
    poolInstance.connect = async function (this: any, ...args: any[]) {
      let retries = 10;
      let delay = 1500;
      while (retries > 0) {
        try {
          const client = await originalConnect(...args);
          const originalClientQuery = client.query.bind(client);
          client.query = async function (this: any, ...cArgs: any[]) {
            let cRetries = 3;
            let cDelay = 1000;
            while (cRetries > 0) {
              try {
                return await originalClientQuery(...cArgs);
              } catch (cError: any) {
                const isConnectionError = 
                  cError.message?.includes("terminated") || 
                  cError.message?.includes("connection") || 
                  cError.message?.includes("timeout");
                if (isConnectionError && cRetries > 1) {
                  cRetries--;
                  await new Promise((resolve) => setTimeout(resolve, cDelay));
                  cDelay *= 1.5;
                } else {
                  throw cError;
                }
              }
            }
          } as any;
          return client;
        } catch (error: any) {
          const isConnectionError = 
            error.message?.includes("terminated") || 
            error.message?.includes("connection") || 
            error.message?.includes("timeout") ||
            error.code === "ECONNREFUSED";
          
          if (isConnectionError && retries > 1) {
            console.warn(`[DB Cold Start] Client connect error, retrying in ${delay}ms... (Remaining retries: ${retries - 1}) Error:`, error.message);
            retries--;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 4000);
          } else {
            throw error;
          }
        }
      }
    } as any;
  }
  return poolInstance;
};

export const getDb = () => {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema, prepare: false } as any);
  }
  return dbInstance;
};

// Export db as a Proxy so existing imports continue to work seamlessly
export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

