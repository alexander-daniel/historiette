const { UART } = require("uart");
const { SPI } = require("spi");
const { Button } = require("button");

const DFPlayer = require("../kaluma-packages/dfplayer/index");
const RC522 = require("../kaluma-packages/mfrc522/index");

const TRACKS = require("./tracks.json");

const PLAY_BUTTON_PIN = 15;
const VOL_UP_BUTTON_PIN = 13;
const VOL_DOWN_BUTTON_PIN = 12;

const RC522_SPI_PORT = 0;
const RC522_CHIP_SELECT_PIN = 17;
const DFPLAYER_UART_PORT = 0;

const DFPLAYER_INITIAL_VOLUME = 15; // 0-30
const DFPLAYER_MAX_VOLUME = 25; // if you want to limit it
const DFPLAYER_MIN_VOLUME = 0;
const SCAN_INTERVAL = 1000;

const playPauseButton = new Button(PLAY_BUTTON_PIN);
const volUpButton = new Button(VOL_UP_BUTTON_PIN);
const volDownButton = new Button(VOL_DOWN_BUTTON_PIN);

const mfrc522 = new RC522(new SPI(RC522_SPI_PORT), RC522_CHIP_SELECT_PIN);
const dfPlayerUART = new UART(DFPLAYER_UART_PORT, {
  baudrate: 9600,
  bits: 8,
});

const player = new DFPlayer(dfPlayerUART);
global.player = player;

const state = {
  isPlaying: false,
  currentCard: null,
  volume: DFPLAYER_INITIAL_VOLUME,
};

// Reset -- might only need this for dev
player.reset();

// wait a bit for the player to reset
setTimeout(() => {
  player.setVolume(state.volume);
}, 500);

dfPlayerUART.on("data", (data) => {
  // read any data coming back FROM the mp3 player
});

playPauseButton.on("click", () => {
  if (!state.isPlaying) {
    if (!state.currentCard) {
      return;
    } else {
      state.isPlaying = true;
      player.play();
      console.log("Play");
      return;
    }
  }

  state.isPlaying = false;
  player.pause();
  console.log("Pause");
});

const setVolume = (volume) => {
  player.setVolume(volume);
  state.volume = volume;
  console.log("Volume: ", state.volume);
};

volUpButton.on("click", () => {
  setVolume(Math.min(state.volume + 1, DFPLAYER_MAX_VOLUME));
});

volDownButton.on("click", () => {
  setVolume(Math.max(state.volume - 1, DFPLAYER_MIN_VOLUME));
});

function loop() {
  // reset card scanner
  mfrc522.reset();

  // perform a scan
  let response = mfrc522.findCard();

  // No card found
  if (!response.status) {
    return setTimeout(loop, SCAN_INTERVAL);
  }

  // card found, get the UID of the card
  response = mfrc522.getUid();
  if (!response.status) return console.log("UID Scan Error");

  const uid = response.data;
  const [a, b, c, d] = uid;
  const cardId = `${a}:${b}:${c}:${d}`;

  if (state.currentCard === cardId && state.isPlaying) {
    console.log("Card already playing");
    return;
  }

  console.log("\n*\nNew card: ", cardId);

  if (!TRACKS[cardId]) {
    return console.log("No track found");
  }

  const { file, folder, name } = TRACKS[cardId];
  console.log(`Playing: ${name} \n${folder}/00${file}.mp3\n*\n`);

  // play new card
  state.currentCard = cardId;
  state.isPlaying = true;

  player.pause();
  player.setPlaybackFolder(folder, file);
  player.play();

  setTimeout(loop, SCAN_INTERVAL);
}

loop();
