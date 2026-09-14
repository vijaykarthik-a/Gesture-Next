// ============================================================
// SMART GLOVE - ESP32-S3 N16R8
// 3 Flex Sensors + BLE
// ============================================================
//
// GPIO 4 -> Flex Sensor 1 -> Threshold 280
// GPIO 5 -> Flex Sensor 2 -> Threshold 850
// GPIO 6 -> Flex Sensor 3 -> Threshold 850
//
// Gestures:
//
// GPIO 4 only       -> HELLO
// GPIO 5 + GPIO 6   -> HI
// GPIO 4 + GPIO 5   -> DID YOU EAT
//
// ============================================================

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>


// ============================================================
// FLEX SENSOR PINS
// ============================================================

const int FLEX1_PIN = 4;
const int FLEX2_PIN = 5;
const int FLEX3_PIN = 6;


// ============================================================
// THRESHOLDS
// ============================================================

const int THRESHOLD1 = 280;
const int THRESHOLD2 = 850;
const int THRESHOLD3 = 850;


// ============================================================
// BLE UUIDs
// ============================================================

#define SERVICE_UUID \
"7b7f0001-6f3e-4d9a-9b9f-4a7d6a4c1001"

#define CHARACTERISTIC_UUID \
"7b7f0002-6f3e-4d9a-9b9f-4a7d6a4c1001"


// ============================================================
// BLE VARIABLES
// ============================================================

BLECharacteristic* gestureCharacteristic = nullptr;

bool deviceConnected = false;

String lastGesture = "";


// ============================================================
// BLE CALLBACKS
// ============================================================

class ServerCallbacks : public BLEServerCallbacks {

  void onConnect(BLEServer* server) override {

    deviceConnected = true;

    Serial.println();
    Serial.println("BLE CLIENT CONNECTED");
  }

  void onDisconnect(BLEServer* server) override {

    deviceConnected = false;

    Serial.println();
    Serial.println("BLE CLIENT DISCONNECTED");

    BLEDevice::startAdvertising();
  }
};


// ============================================================
// SEND GESTURE
// ============================================================

void sendGesture(String gesture,
                 int flex1,
                 int flex2,
                 int flex3) {

  if (!deviceConnected) {
    Serial.println("BLE NOT CONNECTED");
    return;
  }

  String payload =
    "{\"gesture\":\"" + gesture +
    "\",\"f1\":" + String(flex1) +
    ",\"f2\":" + String(flex2) +
    ",\"f3\":" + String(flex3) +
    ",\"confidence\":100}";

  gestureCharacteristic->setValue(
    payload.c_str()
  );

  gestureCharacteristic->notify();

  Serial.print("BLE SENT: ");
  Serial.println(payload);
}


// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(1000);


  // Flex sensor pins

  pinMode(FLEX1_PIN, INPUT);
  pinMode(FLEX2_PIN, INPUT);
  pinMode(FLEX3_PIN, INPUT);


  // ==========================================================
  // BLE
  // ==========================================================

  BLEDevice::init("SMART GLOVE");

  BLEServer* server =
    BLEDevice::createServer();

  server->setCallbacks(
    new ServerCallbacks()
  );


  BLEService* service =
    server->createService(
      SERVICE_UUID
    );


  gestureCharacteristic =
    service->createCharacteristic(

      CHARACTERISTIC_UUID,

      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_NOTIFY

    );


  gestureCharacteristic->addDescriptor(
    new BLE2902()
  );


  gestureCharacteristic->setValue(
    "READY"
  );


  service->start();


  // ==========================================================
  // BLE ADVERTISING
  // ==========================================================

  BLEAdvertising* advertising =
    BLEDevice::getAdvertising();

  advertising->addServiceUUID(
    SERVICE_UUID
  );

  advertising->setScanResponse(true);

  advertising->setMinPreferred(0x06);

  advertising->setMinPreferred(0x12);

  BLEDevice::startAdvertising();


  // ==========================================================
  // INFORMATION
  // ==========================================================

  Serial.println();
  Serial.println("================================");
  Serial.println("       SMART GLOVE");
  Serial.println("================================");

  Serial.println("GPIO 4 Threshold = 280");
  Serial.println("GPIO 5 Threshold = 850");
  Serial.println("GPIO 6 Threshold = 850");

  Serial.println();

  Serial.println("GESTURES:");

  Serial.println("4 ONLY       -> HELLO");
  Serial.println("5 + 6        -> HI");
  Serial.println("4 + 5        -> DID YOU EAT");

  Serial.println();

  Serial.println("BLE READY");
  Serial.println("================================");
}


// ============================================================
// LOOP
// ============================================================

void loop() {

  // ==========================================================
  // READ SENSORS
  // ==========================================================

  int flex1 = analogRead(FLEX1_PIN);
  int flex2 = analogRead(FLEX2_PIN);
  int flex3 = analogRead(FLEX3_PIN);


  // ==========================================================
  // DETERMINE FOLDED / STRAIGHT
  // ==========================================================

  bool finger1 =
    flex1 >= THRESHOLD1;

  bool finger2 =
    flex2 >= THRESHOLD2;

  bool finger3 =
    flex3 >= THRESHOLD3;


  // ==========================================================
  // GESTURE
  // ==========================================================

  String detectedGesture = "";


  // ----------------------------------------------------------
  // DID YOU EAT
  //
  // GPIO 4 + GPIO 5
  // GPIO 6 must be straight
  // ----------------------------------------------------------

  if (
    finger1 &&
    finger2 &&
    !finger3
  ) {

    detectedGesture = "DID YOU EAT";
  }


  // ----------------------------------------------------------
  // HI
  //
  // GPIO 5 + GPIO 6
  // GPIO 4 must be straight
  // ----------------------------------------------------------

  else if (
    !finger1 &&
    finger2 &&
    finger3
  ) {

    detectedGesture = "HI";
  }


  // ----------------------------------------------------------
  // HELLO
  //
  // GPIO 4 ONLY
  // GPIO 5 and GPIO 6 must be straight
  // ----------------------------------------------------------

  else if (
    finger1 &&
    !finger2 &&
    !finger3
  ) {

    detectedGesture = "HELLO";
  }


  // ==========================================================
  // SEND ONLY ONCE
  // ==========================================================

  if (
    detectedGesture != "" &&
    detectedGesture != lastGesture
  ) {

    Serial.println();
    Serial.println("******** GESTURE ********");

    Serial.print("Gesture: ");
    Serial.println(detectedGesture);

    Serial.print("GPIO 4: ");
    Serial.println(flex1);

    Serial.print("GPIO 5: ");
    Serial.println(flex2);

    Serial.print("GPIO 6: ");
    Serial.println(flex3);

    Serial.println("*************************");


    sendGesture(
      detectedGesture,
      flex1,
      flex2,
      flex3
    );


    lastGesture =
      detectedGesture;
  }


  // ==========================================================
  // RESET AFTER RETURNING TO NEUTRAL
  // ==========================================================

  if (
    detectedGesture == ""
  ) {

    lastGesture = "";
  }


  // ==========================================================
  // DEBUG
  // ==========================================================

  static unsigned long lastPrint = 0;

  if (
    millis() - lastPrint >= 500
  ) {

    lastPrint = millis();

    Serial.print("F1=");
    Serial.print(flex1);

    Serial.print("  F2=");
    Serial.print(flex2);

    Serial.print("  F3=");
    Serial.print(flex3);

    Serial.print("  | Folded=");

    Serial.print(finger1);

    Serial.print(",");

    Serial.print(finger2);

    Serial.print(",");

    Serial.println(finger3);
  }


  delay(100);
}
