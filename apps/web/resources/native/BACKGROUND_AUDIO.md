# Native background audio (Capacitor)

The web player uses HTML5 `<audio>` with `playsinline` and `registerCapacitorBackgroundAudio()` so playback can continue when the app is backgrounded.

After `npx cap add ios` or `npx cap add android`, apply these native settings:

## iOS (`ios/App/App/Info.plist`)

Add inside `<dict>`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

## Android (`android/app/src/main/AndroidManifest.xml`)

Inside `<application>` ensure the WebView activity is not killed aggressively; for long sessions consider a foreground media service in a future native plugin.

Rebuild: `npx cap sync` then run from Xcode / Android Studio.
