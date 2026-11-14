/*
 * Cepheus — Arduino UNO Q (STM32U585 MCU) Bedside Indicators & Physical Buttons
 *
 * Companion sketch for Trail #24:
 *   - Physical privacy/status LEDs (green = idle, blue = check-in active,
 *     warm light = gentle dim-room cue from /api/arduino/ingest, red = crisis)
 *   - Physical "Not today" button (lets an unwell patient skip without a screen)
 *   - Physical "Help / Crisis" button (always active, zero automated gating)
 *
 * Communicates with voice_kiosk.py on the Linux MPU over Serial (115200 baud)
 * or Arduino_RouterBridge.
 */

const int PIN_STATUS_IDLE = 2;     // Green LED: sensors idle
const int PIN_STATUS_ACTIVE = 3;   // Blue LED: local check-in active
const int PIN_LIGHT_CUE = 4;       // Warm desk ring-light relay / MOSFET
const int PIN_CRISIS_LED = 5;      // Red LED: human crisis support active

const int PIN_BTN_NOT_TODAY = 6;   // Active LOW with INPUT_PULLUP
const int PIN_BTN_CRISIS = 7;      // Active LOW with INPUT_PULLUP

unsigned long lastBtnMs = 0;

void clearAllLeds() {
  digitalWrite(PIN_STATUS_IDLE, LOW);
  digitalWrite(PIN_STATUS_ACTIVE, LOW);
  digitalWrite(PIN_LIGHT_CUE, LOW);
  digitalWrite(PIN_CRISIS_LED, LOW);
}

void handleCommand(const String& cmd) {
  if (cmd == "IDLE") {
    clearAllLeds();
    digitalWrite(PIN_STATUS_IDLE, HIGH);
  } else if (cmd == "ACTIVE") {
    clearAllLeds();
    digitalWrite(PIN_STATUS_ACTIVE, HIGH);
  } else if (cmd == "LIGHT_ON") {
    digitalWrite(PIN_STATUS_IDLE, HIGH);
    digitalWrite(PIN_LIGHT_CUE, HIGH);
  } else if (cmd == "LIGHT_OFF") {
    digitalWrite(PIN_LIGHT_CUE, LOW);
  } else if (cmd == "CRISIS") {
    clearAllLeds();
    digitalWrite(PIN_CRISIS_LED, HIGH);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_STATUS_IDLE, OUTPUT);
  pinMode(PIN_STATUS_ACTIVE, OUTPUT);
  pinMode(PIN_LIGHT_CUE, OUTPUT);
  pinMode(PIN_CRISIS_LED, OUTPUT);

  pinMode(PIN_BTN_NOT_TODAY, INPUT_PULLUP);
  pinMode(PIN_BTN_CRISIS, INPUT_PULLUP);

  handleCommand("IDLE");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      handleCommand(line);
    }
  }

  unsigned long now = millis();
  if (now - lastBtnMs > 300) {
    if (digitalRead(PIN_BTN_CRISIS) == LOW) {
      lastBtnMs = now;
      handleCommand("CRISIS");
      Serial.println("BTN_CRISIS");
    } else if (digitalRead(PIN_BTN_NOT_TODAY) == LOW) {
      lastBtnMs = now;
      Serial.println("BTN_NOT_TODAY");
    }
  }
}
