import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  browserLocalPersistence, 
  setPersistence 
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

let databaseInstance;
let usePersistence = false;

try {
  // Check if we are inside an iframe or if IndexedDB is nested/sandboxed
  const isIFrame = window.self !== window.top;
  if (!isIFrame && typeof window.indexedDB !== "undefined") {
    usePersistence = true;
  }
} catch (e) {
  // Cross-origin frame or sandboxed environment
  usePersistence = false;
}

if (usePersistence) {
  try {
    databaseInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.warn(
      "Firestore persistent local cache failed to initialize. Falling back to standard memory/default storage.",
      e
    );
    databaseInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
} else {
  console.log("IFrame or sandboxed context detected. Disabling persistent local cache to ensure reliable connection.");
  databaseInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = databaseInstance;
export const auth = getAuth(app);

// Explicitly configure local persistence for Auth stability across redirect/reloads
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase Auth browserLocalPersistence explicitly set.");
  })
  .catch((err) => {
    console.error("Error setting absolute Firebase Auth persistence:", err);
  });

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
