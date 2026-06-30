import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import config from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(config);

// Auth Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db: any = { __mock_db: true };

// Database ref token cache
let idToken: string | null = null;
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      idToken = await user.getIdToken();
    } catch (e) {
      console.error("Error getting ID token:", e);
    }
  } else {
    idToken = null;
  }
});

async function getAuthHeader() {
  if (!idToken && auth.currentUser) {
    try {
      idToken = await auth.currentUser.getIdToken();
    } catch (e) {
      console.error("Error getting ID token inside getter:", e);
    }
  }
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

async function fetchWithTimeout(url: string, options: any = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Local Mode detection
export function isLocalMode() {
  return localStorage.getItem("compass_local_mode") === "true";
}

// Intercept and wrap Firestore functions for local resilience or Cloud SQL Proxy
export function doc(database: any, ...pathSegments: string[]): any {
  const fullPath = pathSegments.join("/");
  const id = pathSegments[pathSegments.length - 1];
  const collectionPath = pathSegments.slice(0, pathSegments.length - 1).join("/");
  return {
    __db_ref: true,
    type: "document",
    path: fullPath,
    id: id,
    collectionPath: collectionPath,
  };
}

export function collection(database: any, ...pathSegments: string[]): any {
  const fullPath = pathSegments.join("/");
  return {
    __db_ref: true,
    type: "collection",
    path: fullPath,
  };
}

export function query(collectionRef: any, ...constraints: any[]): any {
  return {
    __db_ref: true,
    type: "query",
    collectionRef,
    constraints,
  };
}

export function where(field: string, op: string, value: any): any {
  return { type: "where", field, op, value };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc"): any {
  return { type: "orderBy", field, direction };
}

export async function setDoc(docRef: any, data: any, options?: any): Promise<void> {
  if (isLocalMode()) {
    const dbKey = `compass_db_${docRef.collectionPath}`;
    const raw = localStorage.getItem(dbKey);
    const list = raw ? JSON.parse(raw) : [];
    
    const existingIndex = list.findIndex((item: any) => item.id === docRef.id);
    const newData = { ...data, id: docRef.id };
    
    if (existingIndex > -1) {
      if (options?.merge) {
        list[existingIndex] = { ...list[existingIndex], ...newData };
      } else {
        list[existingIndex] = newData;
      }
    } else {
      list.push(newData);
    }
    
    localStorage.setItem(dbKey, JSON.stringify(list));
    return;
  }

  // Cloud SQL Production Mode
  const headers = await getAuthHeader();
  const res = await fetchWithTimeout("/api/db/set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ path: docRef.path, data, options }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Database setDoc error: ${errorText}`);
  }
}

export async function getDoc(docRef: any): Promise<any> {
  if (isLocalMode()) {
    const dbKey = `compass_db_${docRef.collectionPath}`;
    const raw = localStorage.getItem(dbKey);
    const list = raw ? JSON.parse(raw) : [];
    const item = list.find((x: any) => x.id === docRef.id);
    
    return {
      exists: () => !!item,
      data: () => item || null,
      id: docRef.id,
    };
  }

  // Cloud SQL Production Mode
  const headers = await getAuthHeader();
  const res = await fetchWithTimeout("/api/db/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ path: docRef.path }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Database getDoc error: ${errorText}`);
  }

  const { data } = await res.json();
  return {
    exists: () => data !== null && data !== undefined,
    data: () => data,
    id: docRef.id,
  };
}

export async function getDocs(queryOrCollection: any): Promise<any> {
  if (isLocalMode()) {
    let collectionPath = "";
    let constraints: any[] = [];
    
    if (queryOrCollection.type === "query") {
      collectionPath = queryOrCollection.collectionRef.path;
      constraints = queryOrCollection.constraints || [];
    } else if (queryOrCollection.type === "collection") {
      collectionPath = queryOrCollection.path;
    }
    
    const dbKey = `compass_db_${collectionPath}`;
    const raw = localStorage.getItem(dbKey);
    let list = raw ? JSON.parse(raw) : [];
    
    for (const c of constraints) {
      if (c?.type === "where") {
        const { field, op, value } = c;
        if (op === "==") {
          list = list.filter((item: any) => item[field] === value);
        } else if (op === "in") {
          list = list.filter((item: any) => Array.isArray(value) && value.includes(item[field]));
        } else if (op === "<") {
          list = list.filter((item: any) => item[field] < value);
        } else if (op === ">") {
          list = list.filter((item: any) => item[field] > value);
        } else if (op === "<=") {
          list = list.filter((item: any) => item[field] <= value);
        } else if (op === ">=") {
          list = list.filter((item: any) => item[field] >= value);
        }
      } else if (c?.type === "orderBy") {
        const { field, direction } = c;
        list.sort((a: any, b: any) => {
          const valA = a[field];
          const valB = b[field];
          if (valA < valB) return direction === "asc" ? -1 : 1;
          if (valA > valB) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }
    }
    
    const docs = list.map((item: any) => ({
      id: item.id,
      data: () => item,
    }));
    
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
    };
  }

  // Cloud SQL Production Mode
  let collectionPath = "";
  let constraints: any[] = [];
  
  if (queryOrCollection.type === "query") {
    collectionPath = queryOrCollection.collectionRef.path;
    constraints = queryOrCollection.constraints || [];
  } else if (queryOrCollection.type === "collection") {
    collectionPath = queryOrCollection.path;
  }

  const headers = await getAuthHeader();
  const res = await fetchWithTimeout("/api/db/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ path: collectionPath, constraints }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Database getDocs error: ${errorText}`);
  }

  const { data } = await res.json();
  const docs = (data || []).map((item: any) => ({
    id: item.id || item.goalId,
    data: () => item,
  }));

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
  };
}

export async function addDoc(collectionRef: any, data: any): Promise<any> {
  const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docRef = {
    __db_ref: true,
    type: "document",
    path: `${collectionRef.path}/${id}`,
    id,
    collectionPath: collectionRef.path,
  };
  await setDoc(docRef, data);
  return docRef;
}

export async function updateDoc(docRef: any, data: any): Promise<void> {
  if (isLocalMode()) {
    const dbKey = `compass_db_${docRef.collectionPath}`;
    const raw = localStorage.getItem(dbKey);
    const list = raw ? JSON.parse(raw) : [];
    
    const existingIndex = list.findIndex((item: any) => item.id === docRef.id);
    if (existingIndex > -1) {
      list[existingIndex] = { ...list[existingIndex], ...data };
      localStorage.setItem(dbKey, JSON.stringify(list));
    }
    return;
  }

  // Cloud SQL Production Mode
  const headers = await getAuthHeader();
  const res = await fetchWithTimeout("/api/db/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ path: docRef.path, data }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Database updateDoc error: ${errorText}`);
  }
}

export async function deleteDoc(docRef: any): Promise<void> {
  if (isLocalMode()) {
    const dbKey = `compass_db_${docRef.collectionPath}`;
    const raw = localStorage.getItem(dbKey);
    const list = raw ? JSON.parse(raw) : [];
    
    const newList = list.filter((item: any) => item.id !== docRef.id);
    localStorage.setItem(dbKey, JSON.stringify(newList));
    return;
  }

  // Cloud SQL Production Mode
  const headers = await getAuthHeader();
  const res = await fetchWithTimeout("/api/db/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ path: docRef.path }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Database deleteDoc error: ${errorText}`);
  }
}

export function writeBatch(database: any): any {
  const operations: Array<{ type: "set" | "update" | "delete"; path: string; data?: any; options?: any }> = [];
  
  return {
    set(docRef: any, data: any, options?: any) {
      operations.push({ type: "set", path: docRef.path, data, options });
    },
    update(docRef: any, data: any) {
      operations.push({ type: "update", path: docRef.path, data });
    },
    delete(docRef: any) {
      operations.push({ type: "delete", path: docRef.path });
    },
    async commit() {
      if (isLocalMode()) {
        for (const op of operations) {
          const docRef = { collectionPath: op.path.split("/").slice(0, -1).join("/"), id: op.path.split("/").pop() };
          if (op.type === "set") {
            await setDoc(docRef, op.data, op.options);
          } else if (op.type === "update") {
            await updateDoc(docRef, op.data);
          } else if (op.type === "delete") {
            await deleteDoc(docRef);
          }
        }
        return;
      }

      const headers = await getAuthHeader();
      const res = await fetchWithTimeout("/api/db/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ operations }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Database batch commit error: ${errorText}`);
      }
    }
  };
}

export function serverTimestamp(): any {
  return new Date().toISOString();
}

// Auth wrappers
export { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword };
