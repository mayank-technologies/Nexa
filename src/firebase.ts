/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Nexa client-side Firebase is disabled per user request
export const FIREBASE_DISABLED = true;

// Mock empty exports to satisfy existing compilation imports cleanly
export const db = null as any;

export const auth = {
  currentUser: null,
  onAuthStateChanged: (callback: any) => {
    // Immediate callback with null to indicate guest mode
    callback(null);
    return () => {};
  },
  signOut: async () => {
    console.log("[Nexa Firebase Mock] signOut triggered");
  }
} as any;

// Silenced connectivity checker
export async function testConnection() {
  console.log("[Nexa Firebase Mock] testConnection called: Firebase is disabled.");
  return true;
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

// Unified Error Handler to assist diagnostics with raw Firestore rule exceptions
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.warn("[Nexa Firebase Mock] Firestore Error ignored because Firebase is disabled:", error);
}
