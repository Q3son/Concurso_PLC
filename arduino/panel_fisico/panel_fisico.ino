/*
  Botonera fisica para el tablero Smart Factory (opcional)
  ---------------------------------------------------------
  Placa: Arduino UNO / Nano / Mega
  Conexiones (todos los botones a GND, se usan las resistencias pull-up internas):
    D2  Boton START  (normalmente abierto)
    D3  Boton STOP   (normalmente abierto)
    D4  Boton RESET  (normalmente abierto)
    D5  Seta de EMERGENCIA (contacto NORMALMENTE CERRADO a GND)
        -> cerrado = LOW = normal; pulsado o cable cortado = HIGH = emergencia (fail-safe)
    D8  LED verde  (con resistencia de 220 ohm)
    D9  LED amarillo
    D10 LED rojo

  Protocolo serie 115200 baud (lineas de texto):
    Arduino -> PC : BTN:START | BTN:STOP | BTN:RESET | ESTOP:1 | ESTOP:0 | HB
    PC -> Arduino : L:gyr  (ej. "L:100" = verde encendido)

  AVISO: es una botonera didactica. Una parada de emergencia real debe cortar
  la energia por hardware (rele de seguridad de la categoria adecuada).
*/

const uint8_t PIN_START = 2, PIN_STOP = 3, PIN_RESET = 4, PIN_ESTOP = 5;
const uint8_t LED_G = 8, LED_Y = 9, LED_R = 10;
const unsigned long DEBOUNCE_MS = 30, HB_MS = 300, ESTOP_REPEAT_MS = 1000, LINK_TIMEOUT_MS = 2000;

struct Button {
  uint8_t pin;
  const char *msg;
  bool stable;
  bool last;
  unsigned long changedAt;
};

Button buttons[] = {
  { PIN_START, "BTN:START", HIGH, HIGH, 0 },
  { PIN_STOP,  "BTN:STOP",  HIGH, HIGH, 0 },
  { PIN_RESET, "BTN:RESET", HIGH, HIGH, 0 },
};

bool estopState = true;          // arranca en emergencia hasta leer el pin
unsigned long lastHb = 0, lastEstopTx = 0, lastRx = 0;
String rx;

void setup() {
  Serial.begin(115200);
  for (auto &b : buttons) pinMode(b.pin, INPUT_PULLUP);
  pinMode(PIN_ESTOP, INPUT_PULLUP);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_Y, OUTPUT);
  pinMode(LED_R, OUTPUT);
}

void loop() {
  unsigned long now = millis();

  // Botones con antirrebote: se envia el mensaje en el flanco de pulsacion
  for (auto &b : buttons) {
    bool raw = digitalRead(b.pin);
    if (raw != b.last) { b.last = raw; b.changedAt = now; }
    if (now - b.changedAt > DEBOUNCE_MS && raw != b.stable) {
      b.stable = raw;
      if (b.stable == LOW) Serial.println(b.msg);
    }
  }

  // Emergencia: se informa al cambiar y se repite periodicamente
  bool estop = digitalRead(PIN_ESTOP) == HIGH;
  if (estop != estopState || now - lastEstopTx > ESTOP_REPEAT_MS) {
    estopState = estop;
    lastEstopTx = now;
    Serial.println(estop ? "ESTOP:1" : "ESTOP:0");
  }

  // Latido para el watchdog del servidor
  if (now - lastHb > HB_MS) { lastHb = now; Serial.println("HB"); }

  // Lamparas desde el PC
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      if (rx.startsWith("L:") && rx.length() >= 5) {
        digitalWrite(LED_G, rx[2] == '1');
        digitalWrite(LED_Y, rx[3] == '1');
        digitalWrite(LED_R, rx[4] == '1');
        lastRx = now;
      }
      rx = "";
    } else if (c != '\r' && rx.length() < 16) {
      rx += c;
    }
  }

  // Sin datos del PC: parpadea el amarillo para indicar enlace perdido
  if (now - lastRx > LINK_TIMEOUT_MS) {
    digitalWrite(LED_G, LOW);
    digitalWrite(LED_R, LOW);
    digitalWrite(LED_Y, (now / 500) % 2);
  }
}
