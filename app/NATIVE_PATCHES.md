# Native build patches

`android/` is gitignored and fully disposable — `expo prebuild` (and
especially `expo prebuild --clean`) regenerates it from scratch, wiping any
hand-edit made directly inside it. The two patches below are hand-edits, not
Expo config, so they must be manually re-applied after any such regen. This
file is tracked in git specifically so the exact text survives even if
`android/` doesn't.

## 1. Release signing (`android/app/build.gradle`)

Insert right before the `android {` block:

```groovy
// Release signing comes from android/keystore.properties (gitignored — see
// signing/README.md for why it lives outside the generated android/ folder
// and how to restore it after `expo prebuild --clean`). Falls back to debug
// signing when the file is absent so a fresh checkout can still build.
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
def hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `signingConfigs { debug { ... } }`, add after the `debug` block:

```groovy
        if (hasReleaseKeystore) {
            release {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
```

In `buildTypes { release { ... } }`, change the `signingConfig` line to:

```groovy
            signingConfig hasReleaseKeystore ? signingConfigs.release : signingConfigs.debug
```

Then copy `signing/keystore.properties` to `android/keystore.properties`.

## 2. Windows 260-char path-length fix

Windows' MAX_PATH limit breaks the native CMake build when source files live
deep in `node_modules` — both the app module's own autolinked-codegen CMake
project and llama.rn's mirror each source file's full absolute path under
`CMakeFiles/<target>.dir/`, pushing object file paths past 260 characters.

**`android/app/build.gradle`** — insert right before the closing `}` of the
`android { ... }` block:

```groovy
    // Windows-only: the app module's own autolinked-codegen CMake project
    // (react_codegen_rnscreens/rnsvg/safeareacontext etc.) mirrors each
    // source file's full absolute path under CMakeFiles/<target>.dir/ the
    // same way llama.rn's does (see the matching note in
    // android/build.gradle), and this project's deep node_modules path
    // pushes those object file paths past Windows' 260-char limit too. Must
    // be set here (during android{} configuration, not afterEvaluate) — by
    // the time afterEvaluate fires, AGP has already read and locked in the
    // default value. Must be re-added after a clean `expo prebuild`
    // regenerates this file.
    if (System.getProperty('os.name').toLowerCase().contains('windows')) {
        externalNativeBuild {
            cmake {
                buildStagingDirectory = new File("C:/rncxx/app")
            }
        }
    }
```

**`android/build.gradle`** — insert after the `apply plugin:` lines at the
top:

```groovy
// Windows-only: llama.rn's CMake project mirrors each source file's full
// absolute path under CMakeFiles/<target>.dir/, and this project's deep
// node_modules path pushes those object file paths past Windows' 260-char
// limit. A blanket subprojects{} loop fails because some Expo plugin
// subprojects are already-evaluated by the time this runs; scoping to just
// :llama.rn via afterEvaluate works since that project isn't evaluated yet
// at this point. Must be re-added after a clean `expo prebuild` regenerates
// this file.
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  project(':llama.rn').afterEvaluate { proj ->
    proj.android.externalNativeBuild.cmake.buildStagingDirectory = new File("C:/rncxx/llamarn")
  }
}
```

## Verifying after reapplying

```bash
grep -c "hasReleaseKeystore" android/app/build.gradle   # expect 4
grep -c "rncxx" android/app/build.gradle android/build.gradle   # expect 1 each
```
