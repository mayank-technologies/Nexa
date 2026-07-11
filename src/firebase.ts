/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication & Firestore (Enterprise Database ID)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Explicitly set Local Persistence to guarantee session storage across refreshes and browser restarts
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("[Nexa Client] [LOG] Firebase Auth persistence set to local successfully.");
  })
  .catch((err) => {
    console.error("[Nexa Client] [LOG] Failed to set Firebase Auth persistence:", err);
  });

// Enable Firestore Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("[Firebase Persistence] Failed to enable persistence (multiple tabs open).");
  } else if (err.code === "unimplemented") {
    console.warn("[Firebase Persistence] The current browser does not support persistence.");
  }
});

// Connectivity Test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("[Firebase] Connection check: Client is offline. Please verify Firebase configuration.");
    }
  }
}

// Operational Types for Firestore Queries
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Unified Error Handler to assist diagnostics with raw Firestore rule exceptions
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Run connectivity check silently on bootstrap
testConnection();
