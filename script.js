/* Configurazione di Freecel*/
var SUITS = ['♠', '♥', '♣', '♦'];
var COLORS = { '♠': 'black', '♥': 'red', '♣': 'black', '♦': 'red' };
var NAMES = { 1: 'Asso', 11: 'Fante', 12: 'Regina', 13: 'Re' };
var SUIT_NAMES = { '♠': 'Picche', '♥': 'Cuori', '♣': 'Fiori', '♦': 'Quadri' };

// Stato del gioco
var gameState = {
    freecells: [null, null, null, null],
    foundations: [[], [], [], []],
    tableau: [],
    selected: null,
    seed: 1
};

// Undo Stack
var undoStack = [];

// Variabile per evitare input durante l'auto-finish
var isAutoFinishing = false;

var view = {
    scale: 1, 
    panning: false,
    pointX: 0,
    pointY: 0,
    startX: 0,
    startY: 0
};

var elWorld = document.getElementById('game-world');

/* --- RNG MICROSOFT COMPATIBILE --- */
var ms_rng_state;

function ms_srand(seed) {
    ms_rng_state = seed;
}

function ms_rand() {
    ms_rng_state = (ms_rng_state * 214013 + 2531011) | 0;
    return (ms_rng_state >> 16) & 0x7fff;
}

/* --- INIZIALIZZAZIONE --- */
function initGame() {
    if (loadGame()) {
        render();
    } else {
        var randomSeed = Math.floor(Math.random() * 32000) + 1;
        startNewGameLogic(randomSeed);
    }
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
}

function startNewGameLogic(seed) {
    isAutoFinishing = false;
    setupDeal(seed);
    undoStack = []; 
    saveGame();
    render();
    speakText("Partita numero " + seed);
}

/* --- GENERAZIONE MAZZO --- */
function setupDeal(seed) {
    gameState.seed = seed;
    gameState.freecells = [null, null, null, null];
    gameState.foundations = [[], [], [], []];
    gameState.tableau = [];
    gameState.selected = null;

    for (var i = 0; i < 8; i++) {
        gameState.tableau.push([]);
    }

    var deck = [];
    for (var i = 0; i < 52; i++) {
        deck.push(i);
    }

    ms_srand(seed);
    for (var i = 51; i > 0; i--) {
        var pos = ms_rand() % (i + 1);
        var temp = deck[i];
        deck[i] = deck[pos];
        deck[pos] = temp;
    }
    
    deck.reverse();

    var msToMySuits = [2, 3, 1, 0]; 

    for (var i = 0; i < 52; i++) {
        var val = deck[i];
        var rank = (val >> 2) + 1; 
        var msSuit = (val & 3); 
        var suitIdx = msToMySuits[msSuit];
        var suitChar = SUITS[suitIdx];

        var card = { 
            rank: rank, 
            suit: suitChar, 
            color: COLORS[suitChar],
            suitIdx: suitIdx
        };

        var col = i % 8;
        gameState.tableau[col].push(card);
    }
}

/* --- UNDO SYSTEM --- */
function pushUndo() {
    var stateStr = JSON.stringify(gameState);
    undoStack.push(stateStr);
    if (undoStack.length > 255) {
        undoStack.shift();
    }
}

function undoLastMove() {
    if (isAutoFinishing) return; // Blocca undo se sta finendo da sola
    
    if (undoStack.length === 0) {
        speakText("Nessuna mossa da annullare.");
        return;
    }
    
    var prevState = undoStack.pop();
    gameState = JSON.parse(prevState);
    
    saveGame();
    render();
    speakText("Mossa annullata.");
}

/* --- SALVATAGGIO --- */
function saveGame() {
    if (isAutoFinishing) return; // Non salvare durante l'animazione finale
    try {
        var jsonState = JSON.stringify(gameState);
        localStorage.setItem('freecell_grandfather_save', jsonState);

        var jsonUndo = JSON.stringify(undoStack);
        localStorage.setItem('freecell_grandfather_undo', jsonUndo);
    } catch(e) { console.error(e); }
}

function loadGame() {
    try {
        var jsonState = localStorage.getItem('freecell_grandfather_save');
        if (jsonState) {
            gameState = JSON.parse(jsonState);

            var jsonUndo = localStorage.getItem('freecell_grandfather_undo');
            if (jsonUndo) {
                undoStack = JSON.parse(jsonUndo);
            } else {
                undoStack = [];
            }
            return true;
        }
    } catch(e) { console.error(e); }
    return false;
}

function clearSave() {
    localStorage.removeItem('freecell_grandfather_save');
    localStorage.removeItem('freecell_grandfather_undo');
}

/* --- LOGICA DI GIOCO --- */
function handleCardClick(locationType, colIdx, cardIdx) {
    if (isAutoFinishing) return; // Blocca input se sta finendo

    // 1. Logica click intelligente (Smart Click) per singola carta
    if (!gameState.selected) {
        if (trySmartFoundationMove(locationType, colIdx, cardIdx)) {
            saveGame();
            render();
            checkAndTriggerAutoFinish(); // Controlla se QUESTA mossa ha sbloccato la vittoria
            return;
        }
    }

    // 2. Logica Standard di selezione/spostamento
    if (!gameState.selected) {
        trySelect(locationType, colIdx, cardIdx);
        return;
    }

    var sel = gameState.selected;
    if (sel.type === locationType && sel.colIdx === colIdx) {
        deselect();
        return;
    }

    if (tryMove(sel, locationType, colIdx)) {
        deselect();
        saveGame();
        render();
        checkAndTriggerAutoFinish(); // Controlla se QUESTA mossa ha sbloccato la vittoria
    } else {
        trySelect(locationType, colIdx, cardIdx);
    }
}

/* Sposta direttamente alla fondazione se possibile (Singolo click dell'utente) */
function trySmartFoundationMove(type, colIdx, cardIdx) {
    var card = null;
    
    if (type === 'freecell') {
        card = gameState.freecells[colIdx];
    } else if (type === 'tableau') {
        var col = gameState.tableau[colIdx];
        if (col.length > 0 && cardIdx === col.length - 1) {
            card = col[col.length - 1];
        }
    }

    if (!card) return false;

    // Recupera suitIdx se perso
    if (card.suitIdx === undefined) card.suitIdx = SUITS.indexOf(card.suit);
    var fIdx = card.suitIdx;

    var pile = gameState.foundations[fIdx];
    var canMove = false;

    if (pile.length === 0) {
        if (card.rank === 1) canMove = true;
    } else {
        var top = pile[pile.length - 1];
        if (top.rank === card.rank - 1) canMove = true;
    }

    if (canMove) {
        pushUndo();
        if (type === 'freecell') {
            gameState.freecells[colIdx] = null;
        } else {
            gameState.tableau[colIdx].pop();
        }
        gameState.foundations[fIdx].push(card);
        speakText(getCardName(card) + " in casa.");
        return true;
    }
    
    return false;
}

/* --- LOGICA AUTO-FINISH (SIMULAZIONE) --- */

// Questa funzione viene chiamata dopo ogni mossa.
// Simula la partita in avanti. Se la simulazione porta alla vittoria, attiva l'animazione reale.
function checkAndTriggerAutoFinish() {
    //se non sono state giocate almeno 30 mosse non finire in automatico la partita
    if (undoStack.length < 30) return;

    // 1. Clona lo stato attuale per non toccare quello vero
    var simState = JSON.parse(JSON.stringify(gameState));
    
    // 2. Esegui la simulazione
    var simulatedWin = runSimulation(simState);

    // 3. Se la simulazione dice che si vince, avvia la sequenza reale
    if (simulatedWin) {
        isAutoFinishing = true;
        deselect();
        // Avvia il loop di mosse reali con un piccolo ritardo
        setTimeout(playAutoFinishStep, 300);
    } else {
        // Se non vince automaticamente, controlla solo se abbiamo vinto manualmente
        checkWinNormal();
    }
}

// Ritorna TRUE se la simulazione riesce a mettere tutte e 52 le carte nelle fondazioni
function runSimulation(simState) {
    var moved = true;
    var loopCount = 0;
    
    // Continua finché ci sono mosse o raggiungiamo un limite di sicurezza
    while (moved && loopCount < 100) {
        moved = false;
        loopCount++;

        // Controlla Freecells
        for (var i = 0; i < 4; i++) {
            var card = simState.freecells[i];
            if (card) {
                if (isSafeToFoundation(card, simState.foundations)) {
                    simState.foundations[card.suitIdx].push(card);
                    simState.freecells[i] = null;
                    moved = true;
                }
            }
        }

        // Controlla Tableau
        for (var i = 0; i < 8; i++) {
            var col = simState.tableau[i];
            if (col.length > 0) {
                var card = col[col.length - 1];
                if (isSafeToFoundation(card, simState.foundations)) {
                    simState.foundations[card.suitIdx].push(card);
                    col.pop();
                    moved = true;
                }
            }
        }
    }

    // Conta le carte nelle fondazioni simulate
    var count = 0;
    for(var i=0; i<4; i++) count += simState.foundations[i].length;
    
    return (count === 52);
}

// Esegue UNA mossa automatica sulla partita REALE, poi richiama se stessa
function playAutoFinishStep() {
    var moved = false;
    
    // Cerca una mossa da fare (la stessa logica della simulazione, ma applicata al vero gameState)
    
    // 1. Cerca nelle Freecells
    for (var i = 0; i < 4; i++) {
        var card = gameState.freecells[i];
        if (card) {
            if (isSafeToFoundation(card, gameState.foundations)) {
                gameState.foundations[card.suitIdx].push(card);
                gameState.freecells[i] = null;
                moved = true;
                break; // Una mossa alla volta per l'animazione
            }
        }
    }

    // 2. Se non ha mosso dalle Freecells, cerca nel Tableau
    if (!moved) {
        for (var i = 0; i < 8; i++) {
            var col = gameState.tableau[i];
            if (col.length > 0) {
                var card = col[col.length - 1];
                if (isSafeToFoundation(card, gameState.foundations)) {
                    gameState.foundations[card.suitIdx].push(card);
                    col.pop();
                    moved = true;
                    break; 
                }
            }
        }
    }

    if (moved) {
        render(); // Aggiorna grafica
        // Richiama il prossimo passo tra 100ms (velocità animazione)
        setTimeout(playAutoFinishStep, 100); 
    } else {
        // Nessuna mossa trovata (dovrebbe essere finita se la simulazione era corretta)
        checkWinNormal();
    }
}

// Logica "Safe" (Sicura): Una carta può salire se le fondazioni di colore opposto sono pronte
function isSafeToFoundation(card, foundationsRef) {
    var fIdx = card.suitIdx;
    if (card.suitIdx === undefined) fIdx = SUITS.indexOf(card.suit);
    
    var currentPile = foundationsRef[fIdx];
    var nextRankNeeded = currentPile.length + 1;
    
    if (card.rank !== nextRankNeeded) return false; 
    
    // Assi e Due salgono sempre
    if (card.rank <= 2) return true;

    var isRed = (card.color === 'red');
    var minOppositeRank = 14; 
    
    for (var s = 0; s < 4; s++) {
        var suitColor = COLORS[SUITS[s]];
        if ((isRed && suitColor === 'black') || (!isRed && suitColor === 'red')) {
            var rank = foundationsRef[s].length;
            if (rank < minOppositeRank) minOppositeRank = rank;
        }
    }

    // Se la carta è X, i colori opposti devono essere almeno X-1 (o meglio X-2 per essere sicuri al 100%, ma X-1 è lo standard Windows)
    if (card.rank <= minOppositeRank + 1) {
        return true;
    }

    return false;
}

function trySelect(type, colIdx, cardIdx) {
    if (type === 'foundation') return;
    
    if (type === 'freecell') {
        var card = gameState.freecells[colIdx];
        if (!card) return;
        gameState.selected = { type: 'freecell', colIdx: colIdx, cardIdx: 0, count: 1 };
        speakCard(card);
        render();
        return;
    }

    if (type === 'tableau') {
        var col = gameState.tableau[colIdx];
        if (col.length === 0) return;
        if (cardIdx < 0) return; 

        if (isValidStack(col, cardIdx)) {
            var count = col.length - cardIdx;
            gameState.selected = { type: 'tableau', colIdx: colIdx, cardIdx: cardIdx, count: count };
            var card = col[cardIdx];
            if (count > 1) {
                speakText(count + " carte partendo da " + getCardName(card));
            } else {
                speakCard(card);
            }
            render();
        }
    }
}

function isValidStack(col, startIndex) {
    for (var i = startIndex; i < col.length - 1; i++) {
        var current = col[i];
        var next = col[i+1];
        if (current.color === next.color || current.rank !== next.rank + 1) {
            return false;
        }
    }
    return true;
}

function deselect() {
    gameState.selected = null;
    render();
}

function tryMove(source, destType, destIndex) {
    var cardsToMove = [];
    if (source.type === 'freecell') {
        cardsToMove.push(gameState.freecells[source.colIdx]);
    } else {
        var sCol = gameState.tableau[source.colIdx];
        cardsToMove = sCol.slice(source.cardIdx);
    }
    var movingCard = cardsToMove[0]; 

    if (destType === 'freecell') {
        if (cardsToMove.length > 1) {
            speakText("Solo una carta alla volta nelle celle.");
            return false;
        }
        if (gameState.freecells[destIndex] === null) {
            pushUndo(); 
            executeMove(source, destType, destIndex, cardsToMove);
            return true;
        }
        return false;
    }

    if (destType === 'foundation') {
        if (cardsToMove.length > 1) return false;
        var pile = gameState.foundations[destIndex];
        if (movingCard.suit !== SUITS[destIndex]) return false;

        if (pile.length === 0) {
            if (movingCard.rank === 1) {
                pushUndo();
                executeMove(source, destType, destIndex, cardsToMove);
                return true;
            }
        } else {
            var top = pile[pile.length - 1];
            if (movingCard.rank === top.rank + 1) {
                pushUndo();
                executeMove(source, destType, destIndex, cardsToMove);
                return true;
            }
        }
        return false;
    }

    if (destType === 'tableau') {
        var destCol = gameState.tableau[destIndex];
        var allowed = false;
        if (destCol.length === 0) {
            allowed = true; 
        } else {
            var destTop = destCol[destCol.length - 1];
            if (destTop.color !== movingCard.color && destTop.rank === movingCard.rank + 1) {
                allowed = true;
            }
        }

        if (!allowed) return false;

        var emptyFreecells = 0;
        for(var i=0; i<4; i++) if(gameState.freecells[i] === null) emptyFreecells++;

        var emptyCols = 0;
        for(var i=0; i<8; i++) {
            if (gameState.tableau[i].length === 0 && i !== destIndex) emptyCols++;
        }

        var maxCards = (1 + emptyFreecells) * Math.pow(2, emptyCols);
        
        if (cardsToMove.length > maxCards) {
            speakText("Spazio insufficiente per " + cardsToMove.length + " carte.");
            return false;
        }

        pushUndo();
        executeMove(source, destType, destIndex, cardsToMove);
        return true;
    }
    return false;
}

function executeMove(source, destType, destIndex, cards) {
    if (source.type === 'freecell') {
        gameState.freecells[source.colIdx] = null;
    } else {
        gameState.tableau[source.colIdx].splice(source.cardIdx, cards.length);
    }

    if (destType === 'freecell') {
        gameState.freecells[destIndex] = cards[0];
    } else if (destType === 'foundation') {
        gameState.foundations[destIndex].push(cards[0]);
    } else if (destType === 'tableau') {
        for(var i=0; i<cards.length; i++) {
            gameState.tableau[destIndex].push(cards[i]);
        }
    }
}

function checkWinNormal() {
    var count = 0;
    for(var i=0; i<4; i++) count += gameState.foundations[i].length;
    if (count === 52) {
        speakText("Vittoria!");
        clearSave();
        setTimeout(function() { alert("VITTORIA!"); }, 200);
    }
}

/* --- GESTIONE NUOVA PARTITA --- */
function askNewGame() {
    if (isAutoFinishing) return;
    var proposedSeed = Math.floor(Math.random() * 32000) + 1;
    var input = document.getElementById('seed-input');
    input.value = proposedSeed;
    
    document.getElementById('modal-overlay').style.display = 'flex';
    setTimeout(function() { input.select(); }, 100);
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function confirmNewGame() {
    var input = document.getElementById('seed-input');
    var seedVal = parseInt(input.value);
    
    if (isNaN(seedVal) || seedVal < 1) {
        seedVal = Math.floor(Math.random() * 32000) + 1;
    }

    closeModal();
    clearSave();
    startNewGameLogic(seedVal);
}

/* --- RENDERING --- */
function render() {

    var btnUndo = document.getElementById('btn-undo');
    if (btnUndo) {
        if (undoStack.length > 0) {
            btnUndo.style.display = 'block'; // Mostra se ci sono mosse
        } else {
            btnUndo.style.display = 'none';
        }
    }

    var elSeed = document.getElementById('game-seed-display');
    if (elSeed) {
        elSeed.innerText = "Partita: #" + (gameState.seed || 1);
    }

    var elFree = document.getElementById('freecells');
    elFree.innerHTML = '';
    gameState.freecells.forEach(function(card, idx) {
        var slot = createSlot(card, 'freecell', idx);
        elFree.appendChild(slot);
    });

    var elFound = document.getElementById('foundations');
    elFound.innerHTML = '';
    gameState.foundations.forEach(function(pile, idx) {
        var card = pile.length > 0 ? pile[pile.length - 1] : null;
        var slot = createSlot(card, 'foundation', idx);
        if (!card) {
            slot.style.opacity = '0.3';
            slot.innerHTML = '<div style="font-size:40px; text-align:center; line-height:140px; color:#FFF">' + SUITS[idx] + '</div>';
        }
        elFound.appendChild(slot);
    });

    var elTab = document.getElementById('tableau');
    elTab.innerHTML = '';
    gameState.tableau.forEach(function(col, colIdx) {
        var colDiv = document.createElement('div');
        colDiv.className = 'column';
        colDiv.onclick = function() { handleCardClick('tableau', colIdx, -1); };

        col.forEach(function(card, cardIdx) {
            var cDiv = createCardHTML(card);
            cDiv.style.top = (cardIdx * 35) + 'px'; 
            cDiv.classList.add('tableau-card');
            
            if (gameState.selected && 
                gameState.selected.type === 'tableau' && 
                gameState.selected.colIdx === colIdx && 
                cardIdx >= gameState.selected.cardIdx) {
                cDiv.classList.add('selected');
            }

            cDiv.onclick = function(e) {
                e.stopPropagation();
                handleCardClick('tableau', colIdx, cardIdx);
            };

            colDiv.appendChild(cDiv);
        });
        elTab.appendChild(colDiv);
    });
}

function createSlot(card, type, index) {
    var div = document.createElement('div');
    div.className = 'slot';
    div.onclick = function() { handleCardClick(type, index, 0); };
    
    if (card) {
        var cDiv = createCardHTML(card);
        cDiv.style.position = 'relative'; 
        cDiv.style.top = '0';
        cDiv.style.left = '0';
        
        if (gameState.selected && 
            gameState.selected.type === type && 
            gameState.selected.colIdx === index) {
            cDiv.classList.add('selected');
        }
        
        cDiv.onclick = function(e) {
            e.stopPropagation();
            handleCardClick(type, index, 0);
        };
        
        div.innerHTML = '';
        div.appendChild(cDiv);
    }
    return div;
}

function createCardHTML(card) {
    var div = document.createElement('div');
    div.className = 'card ' + card.color;
    
    var rankStr = card.rank;
    if (card.rank === 1) rankStr = 'A';
    if (card.rank === 11) rankStr = 'J';
    if (card.rank === 12) rankStr = 'Q';
    if (card.rank === 13) rankStr = 'K';

    div.innerHTML = 
        '<div class="card-corner">' + rankStr + ' ' + card.suit + '</div>' +
        '<div class="card-center"><span>' + rankStr + '</span><span>' + card.suit + '</span></div>' +
        '<div class="card-corner bottom">' + rankStr + ' ' + card.suit + '</div>';
    
    return div;
}

/* --- AUDIO & CONTROLLI --- */
function getCardName(card) {
    var rankName = NAMES[card.rank] || card.rank;
    return rankName + " di " + SUIT_NAMES[card.suit];
}

function speakCard(card) {
    speakText(getCardName(card));
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        var voices = window.speechSynthesis.getVoices();
        var itVoice = null;
        for(var i=0; i<voices.length; i++) {
            if (voices[i].lang.indexOf('it') >= 0) {
                itVoice = voices[i];
                break;
            }
        }
        var msg = new SpeechSynthesisUtterance(text);
        if (itVoice) msg.voice = itVoice;
        msg.lang = 'it-IT'; 
        window.speechSynthesis.speak(msg);
    }
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = function() {
        window.speechSynthesis.getVoices();
    };
}

window.addEventListener('wheel', function(e) {
    e.preventDefault();
    var delta = e.deltaY * -0.001;
    view.scale += delta;
    if (view.scale < 1) view.scale = 1;
    if (view.scale > 4) view.scale = 4;
    enforceBounds();
    updateView();
}, { passive: false });

window.addEventListener('contextmenu', function(e) { e.preventDefault(); });
window.addEventListener('mousedown', function(e) {
    if (e.button === 2) { 
        view.panning = true;
        view.startX = e.clientX - view.pointX;
        view.startY = e.clientY - view.pointY;
        elWorld.style.cursor = 'move';
    }
});
window.addEventListener('mousemove', function(e) {
    if (view.panning) {
        e.preventDefault();
        view.pointX = e.clientX - view.startX;
        view.pointY = e.clientY - view.startY;
        enforceBounds();
        updateView();
    }
});
window.addEventListener('mouseup', function(e) {
    if (e.button === 2) {
        view.panning = false;
        elWorld.style.cursor = 'default';
    }
});

function enforceBounds() {
    var boardW = 1000 * view.scale;
    var boardH = 1000 * view.scale; 
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    
    if (boardW <= winW) {
        if (view.pointX < 0) view.pointX = 0; 
    } else {
        if (view.pointX > 50) view.pointX = 50; 
        if (view.pointX < (winW - boardW - 50)) view.pointX = (winW - boardW - 50);
    }
    if (view.pointY > 50) view.pointY = 50;
    if (view.pointY < (winH - boardH)) view.pointY = (winH - boardH);
}

function updateView() {
    elWorld.style.transform = 'translate(' + view.pointX + 'px, ' + view.pointY + 'px) scale(' + view.scale + ')';
}

window.onload = initGame;
window.onresize = function() { enforceBounds(); updateView(); };
