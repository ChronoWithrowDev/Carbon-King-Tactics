# Carbon King Tactics — Windows Build Kit

This kit packages the uploaded Vite/React/Three.js game as a Windows desktop app using Electron.

## What it builds

- `Carbon-King-Tactics-1.0.0-x64.exe` — NSIS setup installer.
- `Carbon-King-Tactics-Portable-1.0.0-x64.exe` — portable executable.

## Build with GitHub Actions

1. Create a new, empty GitHub repository.
2. Extract this ZIP.
3. Upload **everything inside this extracted folder** directly into the repository root. Do not upload the enclosing folder. The root should contain `package.json`, `package-lock.json`, `index.html`, `src`, `desktop`, and `.github`.
4. Commit the files.
5. Open the repository's **Actions** tab. The workflow named **Build Carbon King Tactics Windows Launcher** starts on pushes to `main` or `master`. You can also select it and use **Run workflow**.
6. When the run succeeds, open its **Summary** and download `Carbon-King-Tactics-Windows-Installers`.
7. Extract the artifact ZIP and run the Setup EXE, or launch the portable EXE.

## Notes

- Node.js is installed only on GitHub's hosted Windows build machine. The packaged desktop app includes Electron, so players do not need a separate Node.js installation.
- Save slots are stored by the game's existing save code in browser local storage, which Electron/Chromium persists in the app's user-data profile.
- The workflow uses `npm install` rather than `npm ci` because the build-kit adds Electron packaging dependencies to the existing project manifest; npm install reconciles the lockfile in the temporary GitHub runner.
- This kit has not been compiled into a Windows EXE in this environment. GitHub Actions is the build and verification step.
