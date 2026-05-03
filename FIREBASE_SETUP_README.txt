SWIFTBANK FIREBASE ONLINE DEMO SETUP

This version can sync across different phones because it uses Firebase Firestore.

IMPORTANT:
This is still a DEMO banking app. Do not use real money or real customer data.

SETUP STEPS:
1. Go to Firebase Console.
2. Create a new project.
3. Add a Web App.
4. Copy the Firebase config.
5. Open firebase-config.js.
6. Replace the placeholder values.
7. In Firebase, open Firestore Database.
8. Create Firestore database.
9. For demo testing only, use the rules inside:
   FIRESTORE_RULES_FOR_DEMO_ONLY.txt

HOW TRANSFER WORKS:
- David creates account on his phone.
- David gets account number.
- Nonso creates account on another phone.
- Nonso enters David username + David account number.
- Nonso enters amount and PIN.
- Nonso balance reduces online.
- David balance increases online.
- David sees the credit on his own phone.

WARNING:
The included Firestore rules are open for demo only.
For a real app, you must use Firebase Authentication, server-side validation, transaction security, hashed PINs, and proper rules.
