import admin from "firebase-admin";
// import serviceAccount from "./serviceAccountKey.json" assert { type: 'json' };

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export default db;
