# Android app and Google Play

The Android app is the **Play Store edition** of the game (`CLAUDE.md`, `src/edition.ts`) wrapped by
Capacitor. It plays offline from files inside the app. Nothing a learner enters leaves the device: there is
no class mode, no account, no analytics, and no ads.

## Name

The app is called **Factory Fun** (home-screen label and in the game, `GAME_NAME` in `src/edition.ts`); the web
game stays **TOC Factory**. Play's title can be longer and say what it teaches, up to 30 characters, for
example **Factory Fun: Learn Bottlenecks** (30) or **Factory Fun: Theory of Constraints** (too long: use
the description for that). Check the name is free in Play Console and that it doesn't copy someone's brand.

## What is built and what is left

Built: the edition, the Android project (`android/`), icons and splash, the back button, native sharing of
the certificate, and a CI build of a debug APK and the release bundle (`.github/workflows/android.yml`).

Not checked on a real phone (do this before the first upload, with the debug APK from the workflow's run):
- The game fills the screen under the status and navigation bars without hiding anything.
- The back button steps out of a level, the lab, free play, and the course guide, and closes the app from home.
- Passing the exam and tapping Save as PDF or Save as picture opens Android's share sheet with the file.
- The explainer video plays in the loading lab.
- Progress is still there after closing and reopening the app.
- A small phone and a tablet, portrait and landscape.

## What only the owner can do

1. **Google Play developer account** ($25 once). A personal account made recently must run a closed test with
   at least 12 testers for 14 days before it can publish to production.
2. **Upload keystore.** Make it once and keep a copy somewhere safe; losing it is painful.

   ```bash
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 upload.jks   # paste the output into the secret below
   ```

   Then add these repository secrets (Settings, Secrets and variables, Actions): `ANDROID_KEYSTORE_BASE64`,
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. The workflow then signs the
   bundle. Never commit the keystore. In Play Console, use Play App Signing.
3. **Confirm the app id** `com.tocfactory.game` (`capacitor.config.ts`, `android/app/build.gradle`). It cannot
   change after the first upload.
4. **Host the privacy policy** (`public/privacy.html`) at a public address and give Play that address.
5. **Store listing:** screenshots from a phone (and a tablet if offered), a 512 px icon (`public/icon-512.png`),
   a 1024 by 500 feature graphic, a short and a full description.

## Play Console answers

- Target audience: 13 and over (high school to adult). Not designed for children, so not in the Families program.
- Data safety: collects no data and shares none. (Android's automatic backup may keep a copy of the app's data in
  the user's own Google account; that is the user's backup, not the developer's.)
- Ads: none. Content rating: everyone (no violence, no user-to-user contact).
- Category: Education.

## Privacy policy

The policy is `public/privacy.html`: one page for the web game (TOC Factory) and both apps (Factory Fun, on iOS and
Android). Vite copies it into `dist/` and `dist-play/`, so the same file is served from the game's site and bundled
inside the apps. Give Play the public address where it is hosted (`/privacy.html` on the site, or
`/Toc/privacy.html` if Pages serves the project from a subpath). Edit that file rather than keeping a second copy
of the text here.
