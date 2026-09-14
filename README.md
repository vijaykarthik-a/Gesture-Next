# SMART GLOVE — Voice + Bluetooth Edition

A deploy-ready assistive communication website built with only HTML5, CSS3 and Vanilla JavaScript.

## Features
- Home-page voice input: click **Start Speaking**, talk, and your words appear immediately on screen.
- Click **🔊 Speak** to hear the displayed text using the browser's Text-to-Speech engine.
- Browser voice/language settings, speech rate and volume.
- Bluetooth Low Energy connection to an ESP32 using Web Bluetooth.
- Fully functional Demo Mode without hardware.
- Gesture recognition, confidence display, localStorage history, analytics and JSON/CSV export.
- Responsive mobile bottom navigation and desktop sidebar.
- Wi-Fi has been completely removed from this version.

## Deploy
The project is static and can be deployed directly to Vercel or Netlify.

### Local test
Open `index.html` for Demo Mode. For microphone and Web Bluetooth, Chrome/Edge permissions and browser security requirements apply; a deployed HTTPS site is recommended.

### ESP32 Bluetooth
Open `bluetooth.js` and replace:
- `YOUR_SERVICE_UUID`
- `YOUR_CHARACTERISTIC_UUID`

with the UUIDs used by your ESP32 firmware. No UUIDs are invented in this project.

## Voice input
The voice input uses the browser Web Speech Recognition API (`SpeechRecognition` / `webkitSpeechRecognition`). Chrome/Edge support is recommended. The exact available languages depend on the browser and device.


## New accessibility features
- Light/Dark mode toggle in the top bar and Settings.
- English (India) and Tamil (`ta-IN`) interface language switch.
- Tamil gesture labels/descriptions and Tamil browser Text-to-Speech.
- Voice input automatically follows the selected language.
- Recent voice interactions are saved alongside gesture interactions in History.
- History now shows both gesture and voice interactions.
- Settings and language/theme choices persist in browser localStorage.


## ESP32-S3 BLE integration

The website is configured for the following BLE UUIDs:

- Service: `7b7f0001-6f3e-4d9a-9b9f-4a7d6a4c1001`
- Characteristic: `7b7f0002-6f3e-4d9a-9b9f-4a7d6a4c1001`

Use `ESP32_S3_Smart_Glove_BLE.ino` with the ESP32-S3 N16R8.

Flex sensors:
- GPIO 4 -> threshold 800 -> HELLO when folded alone
- GPIO 5 -> threshold 1000
- GPIO 6 -> threshold 1000
- GPIO 5 + GPIO 6 -> HI
- GPIO 4 + GPIO 5 -> DID YOU EAT

The dashboard now has a prominent LIVE GESTURE display at the top. BLE messages update it immediately and, when Auto Speech is enabled, the browser reads the detected phrase aloud.


## 3D Avatar
The dashboard includes a full-body Mixamo FBX avatar. The model files are in `../models/` relative to this project package.

Voice mapping:
- Hello / Hi -> Shaking Hands 2
- Open the bottle -> Fishing Idle (current supplied animation)
- Run quickly / Emergency / Danger / Help / SOS -> Start Climbing Ladder (current supplied animation)

ESP32/demo mapping:
- HELLO or HI -> Shaking Hands 2
- WATER protocol key -> Open the bottle label / Fishing Idle animation
- EMERGENCY -> Start Climbing Ladder

The page loads Three.js, fflate (required by FBXLoader), and FBXLoader from jsDelivr, with unpkg fallbacks. Run the included `START_SMART_GLOVE.bat` so the site is served from localhost instead of opening the HTML as a `file://` URL.
