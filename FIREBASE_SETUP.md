# Firebase Setup

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com
2. Click **Add project**, give it a name (e.g. `psycho-timer`)
3. Disable Google Analytics (not needed), click **Create project**

## 2. Enable Anonymous sign-in

1. In your project, go to **Authentication → Sign-in method**
2. Enable **Anonymous**
3. Add your GitHub Pages domain to **Authorized domains**
   - e.g. `yourusername.github.io`

## 3. Create a Firestore database

1. Go to **Firestore Database → Create database**
2. Choose **Production mode**
3. Pick a region close to your user

## 4. Set Firestore security rules

In **Firestore → Rules**, replace the default with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This ensures each user can only access their own data.

## 5. Get your app config

1. Go to **Project settings** (gear icon) → **General**
2. Under **Your apps**, click **Add app → Web**
3. Register the app (no need to set up Firebase Hosting)
4. Copy the `firebaseConfig` object

## 6. Add config to the app

Open `js/firebase-config.js` and replace the placeholder values with your config:

```js
export const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...",
};
```

## 7. Deploy to GitHub Pages

Push to GitHub, then in your repo go to **Settings → Pages** and set the source
to the `main` branch, root folder. Your app will be live at:

```
https://yourusername.github.io/repo-name/
```

Add that URL to the Firebase **Authorized domains** list (step 2 above).
