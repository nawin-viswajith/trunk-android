# Native build patches

`android/` is gitignored and fully disposable - `expo prebuild` (and
especially `expo prebuild --clean`) regenerates it from scratch, wiping any
hand-edit made directly inside it. The patches below are hand-edits, not
Expo config, so they must be manually re-applied after any such regen. This
file is tracked in git specifically so the exact text survives even if
`android/` doesn't.

## 1. Release signing (`android/app/build.gradle`)

Insert right before the `android {` block:

```groovy
// Release signing comes from android/keystore.properties (gitignored - see
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

## 2. Per-ABI release APK splits (`android/app/build.gradle`)

llama.rn's prebuilt native libs only actually ship for `arm64-v8a` (real
phones) and `x86_64` (emulators) - no armeabi-v7a/x86 - so a plain
`assembleRelease` produces one bloated "universal" APK bundling both.
Splitting gives testers/users a much smaller "optimised" arm64-only
download alongside a "full" universal one for anything else. Insert right
before the `signingConfigs { ... }` block:

```groovy
    splits {
        abi {
            reset()
            enable true
            universalApk true
            include "arm64-v8a", "x86_64"
        }
    }
```

Produces `app-arm64-v8a-release.apk` (ship this as "optimised"),
`app-x86_64-release.apk` (emulator-only, not distributed), and
`app-universal-release.apk` (ship this as "full") under
`android/app/build/outputs/apk/release/`.

## 3. Windows 260-char path-length fix

Windows' MAX_PATH limit breaks the native CMake build when source files live
deep in `node_modules` - both the app module's own autolinked-codegen CMake
project and llama.rn's mirror each source file's full absolute path under
`CMakeFiles/<target>.dir/`, pushing object file paths past 260 characters.

**`android/app/build.gradle`** - insert right before the closing `}` of the
`android { ... }` block:

```groovy
    // Windows-only: the app module's own autolinked-codegen CMake project
    // (react_codegen_rnscreens/rnsvg/safeareacontext etc.) mirrors each
    // source file's full absolute path under CMakeFiles/<target>.dir/ the
    // same way llama.rn's does (see the matching note in
    // android/build.gradle), and this project's deep node_modules path
    // pushes those object file paths past Windows' 260-char limit too. Must
    // be set here (during android{} configuration, not afterEvaluate) - by
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

**`android/build.gradle`** - insert after the `apply plugin:` lines at the
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

## 4. `largeHeap` (`android/app/src/main/AndroidManifest.xml`)

A loaded GGUF model's native context can resident several hundred MB to a
few GB - without this, Android's default per-app memory ceiling makes a
backgrounded Trunk process one of the first candidates the low-memory
killer reclaims, closing the app just from minimizing it. Not exposed by
`expo-build-properties` (checked its Android options - no `largeHeap`
field), so this is a manifest hand-edit like the others here, not
something `app.json` can express. Add `android:largeHeap="true"` to the
`<application ...>` tag:

```xml
<application android:name=".MainApplication" ... android:largeHeap="true">
```

## Verifying after reapplying

```bash
grep -c "hasReleaseKeystore" android/app/build.gradle   # expect 4
grep -c "rncxx" android/app/build.gradle android/build.gradle   # expect 1 each
grep -c "splits" android/app/build.gradle   # expect 1
grep -c "largeHeap" android/app/src/main/AndroidManifest.xml   # expect 1
```
