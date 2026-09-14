/* BLE UUIDs shared by the SMART GLOVE ESP32-S3 firmware. */
const SERVICE_UUID = "7b7f0001-6f3e-4d9a-9b9f-4a7d6a4c1001";
const CHARACTERISTIC_UUID = "7b7f0002-6f3e-4d9a-9b9f-4a7d6a4c1001";

const BluetoothManager = (() => {
  let device = null, server = null, characteristic = null;
  const handlers = { message:null, status:null, error:null };

  const emitStatus = (status, extra={}) => handlers.status?.({ status, ...extra });
  const emitError = (error) => { handlers.error?.(error); };

  function supported() {
    return "bluetooth" in navigator;
  }
  async function connect() {
    if (!supported()) {
      const err = new Error("Bluetooth is not supported by this browser. Try Chrome or Edge on a supported device.");
      emitError(err); throw err;
    }
    if (SERVICE_UUID === "YOUR_SERVICE_UUID" || CHARACTERISTIC_UUID === "YOUR_CHARACTERISTIC_UUID") {
      const err = new Error("Set SERVICE_UUID and CHARACTERISTIC_UUID in bluetooth.js before connecting to your ESP32.");
      emitError(err); throw err;
    }
    try {
      emitStatus("connecting");
      device = await navigator.bluetooth.requestDevice({
        filters:[{ services:[SERVICE_UUID] }],
        optionalServices:[SERVICE_UUID]
      });
      device.addEventListener("gattserverdisconnected", onDisconnected);
      server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", onValueChanged);
      emitStatus("connected", { deviceName: device.name || "Smart Glove" });
      return device;
    } catch (e) {
      emitError(e); emitStatus("disconnected"); throw e;
    }
  }
  function onValueChanged(event) {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const text = new TextDecoder().decode(bytes);
    handlers.message?.(text);
  }
  function onDisconnected() {
    characteristic = null; server = null;
    emitStatus("disconnected");
  }
  async function disconnect() {
    try { if (device?.gatt?.connected) device.gatt.disconnect(); }
    finally { characteristic=null; server=null; emitStatus("disconnected"); }
  }
  return {
    supported, connect, disconnect,
    onMessage(fn){handlers.message=fn},
    onStatus(fn){handlers.status=fn},
    onError(fn){handlers.error=fn},
    getDevice(){return device}
  };
})();