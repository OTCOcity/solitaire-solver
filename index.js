const cardsInitial = [
    'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9'
];
const $field = document.getElementById('field');
const $slots = document.getElementById('slots');
const $new = document.getElementById('new');
const $solve = document.getElementById('solve');
const $loadInput = document.getElementById('load-input');
const $load = document.getElementById('load');
const $$move = $('#move');

let CONFIG_STEP_CLICK = false;

let field = [];
let slots = [];
let gameHistory = new Set();
let isGameEnd = false;
async function init() {
    isGameEnd = true;
    $new.disabled = true;
    await new Promise((resolve) => setTimeout(resolve, 300));
    hystory = new Set();
    // console.clear();
    isGameEnd = false;
    field = [];
    slots = ['S0', 'C0', 'D0', 'H0']
    const cards = [...cardsInitial];
    let index = 0;
    for (let i = 0; i < cardsInitial.length; i++) {
        if (!field[index]) field[index] = [];
        field[index].push(cards.splice(Math.floor(Math.random() * cards.length), 1)[0]);
        if (field[index].length === 3 || Math.random() > 1.5) index++;
    }

    const state = { field, slots };
    $loadInput.value = JSON.stringify(state);
    window.location.hash = JSON.stringify(state);

    render(field, slots);
    $new.disabled = false;
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
    $field.innerHTML = '';
    for (fieldItem of field) {
        const $block = document.createElement('div');
        $block.className = 'hand hhand-compact';
        for (filedCard of fieldItem) {
            $block.innerHTML += `<img class='card' src='${cardToSrc(filedCard)}'>`;
        }
        $field.append($block);
    }
    // Slots
    $slots.innerHTML = '';
    for (slotCard of slots) {
        const $slot = document.createElement('div');
        $slot.className = 'hand hhand-compact';
        $slot.innerHTML = `<img class='card' src='${cardToSrc(slotCard)}'>`;
        $slots.append($slot);
    }
}

function findMoves(field, slots) {
    const moves = [];
    for (fieldFromIndex in field) {
        const blockFrom = field[fieldFromIndex];
        const cardFrom = blockFrom[blockFrom.length - 1];
        const cardBeforeFrom = blockFrom[blockFrom.length - 2];
        if (!cardFrom) continue;
        //Check slots
        for (slotIndex in slots) {
            const slotCard = slots[slotIndex];
            if (cardFrom[0] === slotCard[0] && +cardFrom[1] === +slotCard[1] + 1) {
                const move = ['put', +fieldFromIndex, +slotIndex];
                const [fieldAfterMove, slotsAfterMove] = moveCards(field, slots, move, []);
                // const historySnapshot = fieldAfterMove.reduce((acc, val) => acc + val + '|', '');
                const historySnapshot = JSON.stringify({ field: fieldAfterMove, slots: slotsAfterMove });
                if (gameHistory.has(historySnapshot)) continue;

                moves.push(move);
                gameHistory.add(historySnapshot);
            }
        }

        // Туз нет смысла перекладывать
        if (cardFrom[1] === '1') continue;
        // Check fields
        for (fieldToIndex in field) {
            // Не перекладываем на саму себя или если это единственная карта
            if (fieldFromIndex === fieldToIndex || fieldToIndex === 0) continue;
            const blockTo = field[fieldToIndex];
            const cardTo = blockTo[blockTo.length - 1];
            if (cardTo && blockTo.length < 3 && cardFrom[1] === cardTo[1]) {
                const moveHash = `${cardFrom}-${cardTo}-${fieldToIndex}`;
                const move = ['move', +fieldFromIndex, +fieldToIndex, moveHash];
                // cardFrom[1] === cardBeforeFrom[1]

                const [fieldAfterMove, slotsAfterMove] = moveCards(field, slots, move, []);
                // const historySnapshot = fieldAfterMove.reduce((acc, val) => acc + val + '|', '');
                const historySnapshot = JSON.stringify({ field: fieldAfterMove, slots: slotsAfterMove });
                if (gameHistory.has(historySnapshot)) continue;


                moves.push(move);
                gameHistory.add(historySnapshot);
            }
        }

    }
    moves.sort(() => Math.random() - 0.5);
    return moves;
}

function moveCards(field, slots, move, path) {
    const fieldCopy = JSON.parse(JSON.stringify(field));
    const slotsCopy = [...slots];
    const pathCopy = [...path];

    // Put to slot
    if (move[0] === 'put') {
        slotsCopy[move[2]] = fieldCopy[move[1]].pop();
        pathCopy.push(cardToHuman(slotsCopy[move[2]]));
    }
    // Move to other block
    if (move[0] === 'move') {
        fieldCopy[move[2]].push(fieldCopy[move[1]].pop());
        const moveData = move[3].split('-');
        pathCopy.push(cardToHuman(moveData[0]) + '-' + cardToHuman(moveData[1]));
    }
    const isEnd = slotsCopy[0][1] === '9' && slotsCopy[1][1] === '9' && slotsCopy[2][1] === '9' && slotsCopy[3][1] === '9';
    return [fieldCopy, slotsCopy, pathCopy, isEnd];
}


let isDebug = false;
async function solve(field, slots, path = [], solveIndex = 0) {
    if (isGameEnd) {
        return;
    }
    if (isDebug) {
        debugger;
        isDebug = false;
    }
    const moves = findMoves(field, slots);
    console.log(`%cУровень #${solveIndex} / ${moves.length} вариантов`, 'color: red');
    console.log(gameHistory);

    // console.log(moves);
    let moveIndex = 0;
    for (let move of moves) {
        if (isGameEnd) return;
        // console.log('Move', move);
        if (CONFIG_STEP_CLICK) {
            await new Promise(resolve => {
                $$move.one('click', resolve);
            });
        }
        // await new Promise(resolve => setTimeout(resolve, 50));
        const [newField, newSlots, newPath, isEnd] = moveCards(field, slots, move, path);
        const historySnapshot = newField.reduce((acc, val) => acc + val + '|', '');
        moveIndex++;
        console.log(`  - Уровень #${solveIndex} - ${moveIndex} вариант из ${moves.length}`);

        // console.log(newPath);
        // render(newField, newSlots);
        if (isEnd) {
            isGameEnd = true;
            console.log(newPath.length);
            console.log(newPath);
            return;
        }
        if (isGameEnd) return;
        await solve(newField, newSlots, newPath, solveIndex + 1);
    }
}

// init()
preload()

$new.addEventListener('click', init);
$load.addEventListener('click', load);
$solve.addEventListener('click', () => solve(field, slots));


// Config
$('#config-step-click').click('click', function () {
    CONFIG_STEP_CLICK = this.checked;
});


// Utils
function cardToId(card) {
    const cardsVMap = [, 'A', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const [m, v] = card.split('');
    return cardsVMap[v] ? `${cardsVMap[v]}${m}` : `BLUE_BACK`;
}
function cardToHuman(card) {
    const cardsVMap = [, 'Т', '6', '7', '8', '9', '10', 'В', 'Д', 'К'];
    const cardsMMap = { S: '♠', C: '♣', D: '♦', H: '♥' };
    const [m, v] = card.split('');
    return cardsVMap[v] ? `${cardsVMap[v]}${cardsMMap[m]}` : `BLUE_BACK`;
}
function cardToSrc(card) {
    return `cards/${cardToId(card)}.svg`;
}
