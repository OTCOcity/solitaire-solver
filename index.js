const cardsInitial = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "D7",
  "D8",
  "D9",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "H7",
  "H8",
  "H9",
];
const $field = document.getElementById("field");
const $slots = document.getElementById("slots");
const $new = document.getElementById("new");
const $solve = document.getElementById("solve");
const $loadInput = document.getElementById("load-input");
const $load = document.getElementById("load");
const $$move = $("#move");

const gui = new dat.GUI();
var config = {
  renderCards: false,
  stepsByClick: false,
  delay: 100,
  findMovesCount: 50,
};
gui.add(config, "renderCards").name("Двигать карты");
gui.add(config, "stepsByClick").name("Шаги по кнопе");
gui.add(config, "delay").min(0).max(1000).name("Задержка");
gui.add(config, "findMovesCount").min(0).max(100).name("Find count");

let field = [];
let slots = [];
let gameHistory = new Set();

let isGameEnd = false;
async function init() {
  isGameEnd = true;
  $new.disabled = true;
  await new Promise((resolve) => setTimeout(resolve, 300));
  gameHistory = new Set();
  // console.clear();
  isGameEnd = false;
  field = [];
  slots = ["S0", "C0", "D0", "H0"];
  const cards = [...cardsInitial];
  let index = 0;
  for (let i = 0; i < cardsInitial.length; i++) {
    if (!field[index]) field[index] = [];
    field[index].push(
      cards.splice(Math.floor(Math.random() * cards.length), 1)[0]
    );
    if (field[index].length === 3 || Math.random() > 1.5) index++;
  }

  const state = { field, slots };
  $loadInput.value = JSON.stringify(state);
  window.location.hash = JSON.stringify(state);

  render(field, slots);
  $new.disabled = false;
  return getFieldSnapshot(field, slots);
}

function preload() {
  const hash = decodeURI(window.location.hash.slice(1));
  if (hash) {
    try {
      const state = JSON.parse(hash);
      if (!state.field || !state.slots) return;
      $loadInput.value = hash;
      field = state.field;
      slots = state.slots;
      isGameEnd = false;
      render(field, slots);
    } catch (e) {
      console.log(e);
    }
  }
}

function load() {
  window.location.hash = $loadInput.value;
  preload();
}

function render(field, slots) {
  // console.log('Render');
  // Field
  $field.innerHTML = "";
  for (fieldItem of field) {
    const $block = document.createElement("div");
    $block.className = "hand hhand-compact";
    for (filedCard of fieldItem) {
      $block.innerHTML += `<img class='card' src='${cardToSrc(filedCard)}'>`;
    }
    $field.append($block);
  }
  // Slots
  $slots.innerHTML = "";
  for (slotCard of slots) {
    const $slot = document.createElement("div");
    $slot.className = "hand hhand-compact";
    $slot.innerHTML = `<img class='card' src='${cardToSrc(slotCard)}'>`;
    $slots.append($slot);
  }
}

function findMoves(field, slots, backMoveHistory) {
  const moves = [];
  const clonedBackMoveHistory = new Set(backMoveHistory);

  // Check force slots
  const minSlotAllowCard = slots.map((s) => +s[1]).sort()[0] + 1;
  const slotForceMoves = [];
  for (fieldFromIndex in field) {
    const blockFrom = field[fieldFromIndex];
    const cardFrom = blockFrom[blockFrom.length - 1];
    // Min card
    if (cardFrom && +cardFrom[1] === minSlotAllowCard) {
      slotForceMoves.push(["put", +fieldFromIndex, getCardSlotIndex(cardFrom)]);
      continue;
    }
    // Third card go to slot
    if (blockFrom.length === 3) {
      for (slotIndex in slots) {
        const slotCard = slots[slotIndex];
        if (cardFrom[0] === slotCard[0] && +cardFrom[1] === +slotCard[1] + 1) {
          const move = ["put", +fieldFromIndex, +slotIndex];
          slotForceMoves.push(["put", +fieldFromIndex, +slotIndex]);
        }
      }
    }
  }
  if (slotForceMoves.length) {
    return [[slotForceMoves], clonedBackMoveHistory];
  }

  for (fieldFromIndex in field) {
    const blockFrom = field[fieldFromIndex];
    const cardFrom = blockFrom[blockFrom.length - 1];
    const cardBeforeFrom = blockFrom[blockFrom.length - 2];
    if (!cardFrom) continue;

    // Check slots
    for (slotIndex in slots) {
      const slotCard = slots[slotIndex];
      if (cardFrom[0] === slotCard[0] && +cardFrom[1] === +slotCard[1] + 1) {
        const move = ["put", +fieldFromIndex, +slotIndex];
        const [fieldAfterMove, slotsAfterMove] = moveCards(
          field,
          slots,
          move,
          []
        );
        const historySnapshot = getFieldSnapshot(
          fieldAfterMove,
          slotsAfterMove
        );
        if (gameHistory.has(historySnapshot)) continue;

        moves.push([move]);
        gameHistory.add(historySnapshot);
      }
    }

    // Туз нет смысла перекладывать
    if (cardFrom[1] === "1") continue;
    // Check fields
    for (fieldToIndex in field) {
      // Не перекладываем на саму себя или если это единственная карта
      if (fieldFromIndex === fieldToIndex || fieldToIndex === 0) continue;
      const blockTo = field[fieldToIndex];
      const cardTo = blockTo[blockTo.length - 1];
      if (cardTo && blockTo.length < 3 && cardFrom[1] === cardTo[1]) {
        const moveHash = `${cardFrom}-${cardTo}-${fieldToIndex}`;
        const move = ["move", +fieldFromIndex, +fieldToIndex, moveHash];

        const [fieldAfterMove, slotsAfterMove] = moveCards(
          field,
          slots,
          move,
          []
        );
        // const historySnapshot = fieldAfterMove.reduce((acc, val) => acc + val + '|', '');
        const historySnapshot = getFieldSnapshot(
          fieldAfterMove,
          slotsAfterMove
        );
        const backMoveSnapshot = `${fieldToIndex} ${fieldFromIndex} ${cardFrom} ${cardTo}`;
        if (gameHistory.has(historySnapshot)) continue;
        if (clonedBackMoveHistory.has(backMoveSnapshot)) continue;

        if (cardBeforeFrom && cardFrom[1] === cardBeforeFrom[1]) {
          clonedBackMoveHistory.add(backMoveSnapshot);
        }

        moves.push([move]);
        gameHistory.add(historySnapshot);
      }
    }
  }
  moves.sort(() => Math.random() - 0.5);
  return [moves, clonedBackMoveHistory];
}

function moveCards(field, slots, moveList, path) {
  const fieldCopy = JSON.parse(JSON.stringify(field));
  const slotsCopy = [...slots];
  const pathCopy = [...path];
  if (!Array.isArray(moveList[0])) moveList = [moveList];
  for (move of moveList) {
    // Put to slot
    if (move[0] === "put") {
      slotsCopy[move[2]] = fieldCopy[move[1]].pop();
      pathCopy.push(cardToHuman(slotsCopy[move[2]]));
    }
    // Move to other block
    if (move[0] === "move") {
      fieldCopy[move[2]].push(fieldCopy[move[1]].pop());
      const moveData = move[3].split("-");
      pathCopy.push(cardToHuman(moveData[0]) + "-" + cardToHuman(moveData[1]));
    }
  }
  const isEnd =
    slotsCopy[0][1] === "9" &&
    slotsCopy[1][1] === "9" &&
    slotsCopy[2][1] === "9" &&
    slotsCopy[3][1] === "9";
  return [fieldCopy, slotsCopy, pathCopy, isEnd];
}

async function solve(
  field,
  slots,
  path = [],
  solveIndex = 0,
  backMoveHistory = new Set()
) {
  // !solveIndex && console.clear();

  if (isGameEnd) {
    return;
  }

  // Check unresolved
  const isUnresolved = checkUnresolved(field);
  if (isUnresolved) {
    if (solveIndex === 0) {
      console.log("Нет решений by checkUnresolved");
    }
    return;
  }

  const [moves, newBackMoveHistory] = findMoves(field, slots, backMoveHistory);
  if (gameHistory.size > 0 && gameHistory.size % 1000 === 0) {
    console.log(gameHistory.size);
  }

  // console.log(moves);
  let moveIndex = 0;
  for (let move of moves) {
    if (isGameEnd) return;
    if (config.stepsByClick) {
      await new Promise((resolve) => {
        $$move.one("click", resolve);
      });
    }
    const [newField, newSlots, newPath, isEnd] = moveCards(
      field,
      slots,
      move,
      path
    );
    if (config.renderCards) {
      await new Promise((resolve) => setTimeout(resolve, config.delay));
      render(newField, newSlots);
    }
    moveIndex++;
    if (isEnd) {
      isGameEnd = true;
      globalPath = [...newPath];
      console.log(newPath);
      return;
    }
    if (isGameEnd) return;
    await solve(
      newField,
      newSlots,
      newPath,
      solveIndex + 1,
      newBackMoveHistory
    );
  }
  if (!isGameEnd && solveIndex === 0) {
    console.log("Нет решений!");
  }
}

// init()
preload();

$new.addEventListener("click", () => {
  console.clear();
  init();
});
$load.addEventListener("click", load);
$solve.addEventListener("click", () => {
  console.clear();
  gameHistory = new Set();
  solve(field, slots);
  isGameEnd = false;
});

// Utils
function cardToId(card) {
  const cardsVMap = [, "A", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const [m, v] = card.split("");
  return cardsVMap[v] ? `${cardsVMap[v]}${m}` : `BLUE_BACK`;
}
function cardToHuman(card) {
  const cardsVMap = [, "Т", "6", "7", "8", "9", "10", "В", "Д", "К"];
  const cardsMMap = { S: "♠", C: "♣", D: "♦", H: "♥" };
  const [m, v] = card.split("");
  return cardsVMap[v] ? `${cardsVMap[v]}${cardsMMap[m]}` : `BLUE_BACK`;
}
function cardToSrc(card) {
  return `cards/${cardToId(card)}.svg`;
}

function getFieldSnapshot(field, slots) {
  return JSON.stringify({ field, slots });
  const filteredField = field.filter((v) => v.length > 0);
  filteredField.sort(
    (a, b) =>
      a[0].charCodeAt(0) * 1000 +
      a[0].charCodeAt(1) -
      b[0].charCodeAt(0) * 1000 +
      b[0].charCodeAt(1)
  );
  return filteredField.reduce((acc, v) => acc + "|" + v.join(""), "").slice(1);
}

function getCardSlotIndex(card) {
  if (card[0] === "S") return 0;
  if (card[0] === "C") return 1;
  if (card[0] === "D") return 2;
  if (card[0] === "H") return 3;
}

// Unresolve utils
function checkUnresolved(field) {
  let blockIndex = 0;
  for (block of field) {
    if (
      isOverlaped(block[0], block[1]) &&
      !canReplaceCard(field, block[1], blockIndex)
    ) {
      return true;
    }
    if (
      isOverlaped(block[0], block[2]) &&
      !canReplaceCard(field, block[2], blockIndex)
    ) {
      return true;
    }
    if (
      isOverlaped(block[1], block[2]) &&
      !canReplaceCard(field, block[2], blockIndex)
    ) {
      return true;
    }
    blockIndex++;
  }
}
function isOverlaped(card1, card2) {
  if (!card1 || !card2) return false;
  return card1[0] === card2[0] && +card1[1] < +card2[1];
}
function canReplaceCard(field, card, blockIndex) {
  const cardVal = card[1];
  for (i = 0; i < field.length; i++) {
    if (i === blockIndex) continue;
    const card1Val = field[i][0]?.[1];
    const card2Val = field[i][1]?.[1];
    if (cardVal === card1Val || cardVal === card2Val) {
      return true;
    }
  }
  // console.log(`Cant replace: ${cardToHuman(card)}`);
  return false;
}

// Auto find
var globalPath = [];
$("#find").click(async function () {
  globalPath = [];
  let snapshot;
  while (
    globalPath.length < config.findMovesCount ||
    gameHistory.size < 10_000
  ) {
    console.clear();
    snapshot = await init();
    await new Promise((resolve) => setTimeout(resolve, 100));
    isGameEnd = false;
    globalPath = [];
    await solve(field, slots);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log(snapshot);
});
