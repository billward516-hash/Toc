# Factory Fun: hand-off for publishing on Google Play

This is for whoever runs the Google Play side. You need the GitHub repository and a Google Play Console
account. You do not need to write code or install Android Studio: GitHub builds the app.

- Repository: https://github.com/billward516-hash/Toc
- Work branch: `claude/dazzling-cray-g1gajo` (the default branch does not have the Android app yet)
- Builds: https://github.com/billward516-hash/Toc/actions/workflows/android.yml
- Longer reference (store answers, privacy policy text): `docs/android-play-store.md`

**What the app is.** "Factory Fun" is a game that teaches the Theory of Constraints. It is the web game
(TOC Factory) wrapped as an Android app, with the classroom and trainer parts removed. It plays offline and
sends nothing anywhere: no account, no ads, no analytics. App id: `com.tocfactory.game` (permanent once
uploaded; the owner must approve it before the first upload).

## 1. Check the build is green (5 minutes)

1. Open the Builds link above and pick the newest run on branch `claude/dazzling-cray-g1gajo`.
2. Both jobs, **android** and **emulator**, must show a green tick. The emulator job installs the app on a
   virtual phone, plays it, tests the back button, the video, and the certificate share sheet.
3. Under **Artifacts** at the bottom you get:
   - `toc-factory-debug-apk`: an installable test version (see section 5).
   - `toc-factory-release-aab`: what Google Play takes. It is **unsigned** until section 3 is done.
   - `emulator-smoke-test`: screenshots and the app's log from the virtual phone.

If anything is red, stop and tell the owner; do not upload.

## 2. Create the app in Play Console

1. Create app: name **Factory Fun** (check it isn't taken; the store title can be longer, up to 30 characters,
   for example "Factory Fun: Learn Bottlenecks"). Default language English. App (not game, or game: either is
   fine, Education category works best as an app). Free.
2. Accept the declarations. Turn on **Play App Signing** when asked (Google keeps the real signing key; you
   keep only an upload key).

## 3. Make the upload key and let GitHub sign the build (once)

On a computer with Java:

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks
```

(On a Mac use `base64 -i upload.jks` instead.) Keep `upload.jks` and its passwords in a password manager.
**Never put the keystore or passwords in the repository.**

In the repository: Settings, Secrets and variables, Actions, New repository secret. Add four:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the long base64 text from the command above |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | the key password |

Then Actions, Android build, Run workflow, choose branch `claude/dazzling-cray-g1gajo`. When it is green, the
`toc-factory-release-aab` artifact is signed and its build number is higher than any earlier one (Play needs
that for every upload).

## 4. Fill in the store listing and policies

Answers (also in `docs/android-play-store.md`):

- **Target audience:** 13 and over. Not for children, so not in the Families program.
- **Ads:** none. **Content rating:** answer honestly: no violence, no user-to-user contact; expect "Everyone".
- **Data safety:** collects no data, shares none. The app has no account and makes no network calls. (Android may
  back up the app's data to the user's own Google account; that is theirs, not collected by us.)
- **Category:** Education.
- **Privacy policy:** a public web address is required. Host `public/privacy.html`, the one policy for the web
  game and both apps, and give the store that address. Any public page works, for example a page on the game's
  GitHub Pages site once that is turned on.
- **Store assets:** 512 px icon (`public/icon-512.png`), a 1024 by 500 feature graphic, at least 2 phone
  screenshots (take them from the debug APK; a tablet set helps), short description (80 characters), full
  description.

## 5. Try it on a real phone before uploading

Download `toc-factory-debug-apk`, unzip, send `app-debug.apk` to an Android phone, and install it (allow "install
unknown apps" for the app you opened it from). Check:

- The game fills the screen and nothing is hidden under the status or navigation bar.
- The back button steps out of a level, the loading lab, free play, and the course guide, and closes the app
  from the home screen.
- A level plays and explains a wrong answer; the loading lab's video plays.
- Exam, then **View my certificate**, then **Save or share the PDF** opens Android's share sheet and the PDF
  opens from there.
- Close the app completely and reopen it: the nickname and progress are still there.
- Portrait and landscape, on a small phone and, if you have one, a tablet.

Report anything off to the owner with the phone model and a screenshot.

## 6. Upload and test, in this order

1. Play Console, Testing, **Internal testing**: create a release, upload `app-release.aab`, add yourself and
   the owner as testers, install from the Play link. This proves the signed build works.
2. **Closed testing**: if the Play account is a personal one created recently, Google requires **at least 12
   testers who stay opted in for 14 days** before you can apply for production. Add the testers' Google
   accounts (or a Google Group) and share the opt-in link. Start this early; it is the longest wait.
3. Read the **Pre-launch report** Google generates for each upload. Fix anything it flags as a crash or an
   accessibility problem and tell the owner.
4. After the 14 days: Production, create release, apply for access, then roll out (start at 20 percent if you
   like).

## 7. Releasing an update later

Make the change in the repository (the owner or Claude), confirm both jobs are green, run the Android build
again, and upload the new `toc-factory-release-aab`. Each run has a higher build number automatically.

## Do not

- Change the app id `com.tocfactory.game` after the first upload.
- Commit a keystore, a password, or `keystore.properties` (the repository is public).
- Put the owner's personal details or any employer's name in the listing, the privacy policy, or the repository.
- Upload the unsigned bundle or the debug APK to Play.
