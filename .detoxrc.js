/** @type {Detox.DetoxConfig} */
// Android-only: Detox's iOS path requires Xcode + iOS Simulator, which only run on
// macOS. This is a Windows machine, so there is no iOS configuration here — not an
// oversight, a hard platform constraint.
module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js'
    },
    jest: {
      setupTimeout: 120000
    }
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      // Windows: Detox spawns this via cmd.exe. Bare './gradlew.bat' fails (cmd doesn't
      // understand POSIX './'), and even bare 'gradlew.bat' fails on this machine because
      // NoDefaultCurrentDirectoryInExePath keeps cmd from searching cwd — '.\' is required.
      // Module-scoped (':app:...' not bare 'assembleAndroidTest'): the bare task name builds
      // an androidTest APK for EVERY autolinked library module, not just :app. Several of
      // those libraries (e.g. react-native-gesture-handler) aren't set up to have their own
      // instrumentation APK built standalone and fail on native-lib packaging conflicts
      // (duplicate libc++_shared.so) that never affect the real app build. We only need :app.
      build: 'cd android && .\\gradlew.bat :app:assembleDebug :app:assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [
        8081
      ]
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && .\\gradlew.bat assembleRelease assembleAndroidTest -DtestBuildType=release'
    }
  },
  devices: {
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*'
      }
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_8'
      }
    }
  },
  configurations: {
    'android.att.debug': {
      device: 'attached',
      app: 'android.debug'
    },
    'android.att.release': {
      device: 'attached',
      app: 'android.release'
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release'
    }
  }
};
