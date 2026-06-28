import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection as realCollection,
  doc as realDoc,
  setDoc as realSetDoc,
  getDoc as realGetDoc,
  getDocs as realGetDocs,
  addDoc as realAddDoc,
  updateDoc as realUpdateDoc,
  deleteDoc as realDeleteDoc,
  query as realQuery,
  where as realWhere,
  orderBy as realOrderBy,
  serverTimestamp as realServerTimestamp,
  writeBatch as realWriteBatch,
} from "firebase/firestore";
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

// Services
const dbId = (config as any).firestoreDatabaseId || "(default)";
export const db = getFirestore(app, dbId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Local Mode detection
export function isLocalMode() {
  return localStorage.getItem("compass_local_mode") === "true";
}

// Intercept and wrap Firestore functions for local resilience
export function doc(database: any, ...pathSegments: string[]): any {
  if (isLocalMode()) {
    const fullPath = pathSegments.join("/");
    const id = pathSegments[pathSegments.length - 1];
    const collectionPath = pathSegments.slice(0, pathSegments.length - 1).join("/");
    return {
      __mock: true,
      type: "document",
      path: fullPath,
      id: id,
      collectionPath: collectionPath,
    };
  }
  return realDoc(database, ...pathSegments as [any, string, ...string[]]);
}

export function collection(database: any, ...pathSegments: string[]): any {
  if (isLocalMode()) {
    const fullPath = pathSegments.join("/");
    return {
      __mock: true,
      type: "collection",
      path: fullPath,
    };
  }
  return realCollection(database, ...pathSegments as [any, string, ...string[]]);
}

export function query(collectionRef: any, ...constraints: any[]): any {
  if (isLocalMode() || collectionRef?.__mock) {
    return {
      __mock: true,
      type: "query",
      collectionRef,
      constraints,
    };
  }
  return realQuery(collectionRef, ...constraints);
}

export function where(field: string, op: string, value: any): any {
  if (isLocalMode()) {
    return { type: "where", field, op, value };
  }
  return realWhere(field, op as any, value);
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc"): any {
  if (isLocalMode()) {
    return { type: "orderBy", field, direction };
  }
  return realOrderBy(field, direction);
}

export async function setDoc(docRef: any, data: any, options?: any): Promise<void> {
  if (isLocalMode() || docRef?.__mock) {
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
  return realSetDoc(docRef, data, options);
}

export async function getDoc(docRef: any): Promise<any> {
  if (isLocalMode() || docRef?.__mock) {
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
  return realGetDoc(docRef);
}

export async function getDocs(queryOrCollection: any): Promise<any> {
  if (isLocalMode() || queryOrCollection?.__mock) {
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
    
    // Apply query filters/constraints
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
  return realGetDocs(queryOrCollection);
}

export async function addDoc(collectionRef: any, data: any): Promise<any> {
  if (isLocalMode() || collectionRef?.__mock) {
    const id = `local_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docRef = {
      __mock: true,
      type: "document",
      path: `${collectionRef.path}/${id}`,
      id,
      collectionPath: collectionRef.path,
    };
    await setDoc(docRef, data);
    return docRef;
  }
  return realAddDoc(collectionRef, data);
}

export async function updateDoc(docRef: any, data: any): Promise<void> {
  if (isLocalMode() || docRef?.__mock) {
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
  return realUpdateDoc(docRef, data);
}

export async function deleteDoc(docRef: any): Promise<void> {
  if (isLocalMode() || docRef?.__mock) {
    const dbKey = `compass_db_${docRef.collectionPath}`;
    const raw = localStorage.getItem(dbKey);
    const list = raw ? JSON.parse(raw) : [];
    
    const newList = list.filter((item: any) => item.id !== docRef.id);
    localStorage.setItem(dbKey, JSON.stringify(newList));
    return;
  }
  return realDeleteDoc(docRef);
}

export function writeBatch(database: any): any {
  if (isLocalMode()) {
    const operations: Array<() => void> = [];
    return {
      set(docRef: any, data: any) {
        operations.push(() => {
          setDoc(docRef, data);
        });
      },
      update(docRef: any, data: any) {
        operations.push(() => {
          updateDoc(docRef, data);
        });
      },
      delete(docRef: any) {
        operations.push(() => {
          deleteDoc(docRef);
        });
      },
      async commit() {
        for (const op of operations) {
          op();
        }
      }
    };
  }
  return realWriteBatch(database);
}

export function serverTimestamp(): any {
  if (isLocalMode()) {
    return new Date().toISOString();
  }
  return realServerTimestamp();
}
