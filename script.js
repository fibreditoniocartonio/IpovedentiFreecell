/* Configurazione di Gioco */
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
    // Aggiornamento stato: (state * 214013 + 2531011) modulo 2^32
    // | 0 forza la conversione a intero 32-bit con segno, replicando il comportamento C
    ms_rng_state = (ms_rng_state * 214013 + 2531011) | 0;
    
    // Output: (state >> 16) & 0x7fff
    return (ms_rng_state >> 16) & 0x7fff;
}

/* --- INIZIALIZZAZIONE --- */
function initGame() {
    if (loadGame()) {
        render();
        speakText("Bentornato nonno, partita recuperata.");
    } else {
        var randomSeed = Math.floor(Math.random() * 32000) + 1;
        startNewGameLogic(randomSeed);
    }
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
}

function startNewGameLogic(seed) {
    setupDeal(seed);
    saveGame();
    render();
    speakText("Partita numero " + seed);
}

/* --- GENERAZIONE MAZZO (LOGICA MICROSOFT CORRETTA) --- */
function setupDeal(seed) {
    gameState.seed = seed;
    gameState.freecells = [null, null, null, null];
    gameState.foundations = [[], [], [], []];
    gameState.tableau = [];
    gameState.selected = null;

    for (var i = 0; i < 8; i++) {
        gameState.tableau.push([]);
    }

    // 1. Inizializza il mazzo (0-51)
    var deck = [];
    for (var i = 0; i < 52; i++) {
        deck.push(i);
    }

    // 2. Mescola (Algoritmo Microsoft Backward Shuffle)
    ms_srand(seed);
    for (var i = 51; i > 0; i--) {
        var pos = ms_rand() % (i + 1);
        
        // Scambia deck[i] con deck[pos]
        var temp = deck[i];
        deck[i] = deck[pos];
        deck[pos] = temp;
    }
    
    // 3. Inverte il mazzo (Microsoft distribuisce dalla fine)
    deck.reverse();

    // 4. Distribuisci le carte nel Tableau
    // Ordine Semi MS: 0=Fiori(♣), 1=Quadri(♦), 2=Cuori(♥), 3=Picche(♠)
    var msToMySuits = [2, 3, 1, 0]; 

    for (var i = 0; i < 52; i++) {
        var val = deck[i];
        
        // Decodifica MS (Rank Major)
        // 0-3 = Assi, 4-7 = Due ...
        var rank = (val >> 2) + 1; 
        var msSuit = (val & 3); 

        var suitIdx = msToMySuits[msSuit];
        var suitChar = SUITS[suitIdx];

        var card = { 
            rank: rank, 
            suit: suitChar, 
            color: COLORS[suitChar] 
        };

        var col = i % 8;
        gameState.tableau[col].push(card);
    }
}

/* --- SALVATAGGIO --- */
function saveGame() {
    try {
        var json = JSON.stringify(gameState);
        localStorage.setItem('freecell_grandfather_save', json);
    } catch(e) { console.error(e); }
}

function loadGame() {
    try {
        var json = localStorage.getItem('freecell_grandfather_save');
        if (json) {
            gameState = JSON.parse(json);
            return true;
        }
    } catch(e) { console.error(e); }
    return false;
}

function clearSave() {
    localStorage.removeItem('freecell_grandfather_save');
}

/* --- LOGICA DI GIOCO --- */
function handleCardClick(locationType, colIdx, cardIdx) {
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
        checkWin();
    } else {
        trySelect(locationType, colIdx, cardIdx);
    }
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
                speakText(count + " carte da " + getCardName(card));
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
            executeMove(source, destType, destIndex, cardsToMove);
            return true;
        }
        return false;
    }

    if (destType === 'foundation') {
        if (cardsToMove.length > 1) return false;
        var pile = gameState.foundations[destIndex];
        if (pile.length === 0) {
            if (movingCard.rank === 1) {
                executeMove(source, destType, destIndex, cardsToMove);
                return true;
            }
        } else {
            var top = pile[pile.length - 1];
            if (top.suit === movingCard.suit && movingCard.rank === top.rank + 1) {
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

function checkWin() {
    var count = 0;
    for(var i=0; i<4; i++) count += gameState.foundations[i].length;
    if (count === 52) {
        speakText("Vittoria! Bravo nonno!");
        clearSave();
        alert("VITTORIA!");
    }
}

/* --- GESTIONE NUOVA PARTITA --- */
function askNewGame() {
    // Genera un seme casuale da proporre
    var proposedSeed = Math.floor(Math.random() * 32000) + 1;
    var input = document.getElementById('seed-input');
    input.value = proposedSeed;
    
    document.getElementById('modal-overlay').style.display = 'flex';
    // Metti il focus così può digitare direttamente se vuole
    setTimeout(function() { input.select(); }, 100);
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function confirmNewGame() {
    var input = document.getElementById('seed-input');
    var seedVal = parseInt(input.value);
    
    // Se vuoto o non valido, usa un random
    if (isNaN(seedVal) || seedVal < 1) {
        seedVal = Math.floor(Math.random() * 32000) + 1;
    }

    closeModal();
    clearSave();
    startNewGameLogic(seedVal);
}

/* --- RENDERING --- */
function render() {
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