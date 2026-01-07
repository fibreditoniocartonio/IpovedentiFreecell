FreeCell per ipovedenti

Una versione accessibile e semplificata del classico FreeCell, progettata specificamente per persone ipovedenti e ottimizzata per hardware datato.

> **Obiettivo:** Permettere a mio nonno di continuare a giocare al suo passatempo preferito in autonomia, superando le barriere visive e le limitazioni tecnologiche del suo vecchio PC.

---

## ✨ Caratteristiche Principali

### 👁️ Accessibilità Visiva (Ipovisione)
- **Carte Giganti:** Renderizzate con dimensioni maggiorate (100x140px) e font in grassetto per massimizzare la leggibilità.
- **Alto Contrasto:** 
  - Sfondo verde scuro classico (`#006400`)
  - Semi rossi e neri ad alto contrasto.
  - Selezione evidenziata da un **bordo giallo brillante** impossibile da non notare.
- **Zoom e Panoramica:** 
  - **Zoom:** Rotella del mouse per ingrandire il tavolo fino al 400%.
  - **Pan:** Tasto destro del mouse premuto per spostarsi nel tavolo ingrandito.
- **Input Facilitato:** Modale per la selezione del numero partita con caratteri enormi (60px).

### 🔊 Supporto Vocale (Text-to-Speech)
- **Sintesi Vocale Italiana:** Il gioco utilizza le API del browser per "parlare".
- **Feedback Immediato:** 
  - Legge la carta cliccata (es. *"Asso di Picche"*).
  - Annuncia le quantità spostate (es. *"3 carte da..."*).
  - Segnala errori e celebra la vittoria.

### 🎮 Gameplay Semplificato
- **Point & Click:** Nessun trascinamento (drag & drop) per evitare errori motori. Si clicca la carta, poi si clicca la destinazione.
- **Logica Microsoft Originale:** Stesso algoritmo RNG di Windows. Le partite (es. Partita #1, #11982) corrispondono esattamente a quelle classiche.
- **Salvataggio Automatico:** Stato salvato in locale (`localStorage`) dopo ogni mossa. Resistente alla chiusura accidentale del browser.

### 💻 Compatibilità Legacy & Offline
- **Codice Vanilla ES5:** Scritto in JavaScript puro (senza sintassi moderna ES6+) per funzionare su vecchie versioni di Chrome (es. Win7/XP).
- **Totalmente Offline:** Nessuna dipendenza esterna, nessun font o libreria da scaricare. Sicuro per PC non connessi a internet.

---

## 🚀 Istruzioni per l'Installazione

1. Copiare la cartella del progetto sul desktop.
2. Assicurarsi che `index.html`, `style.css` e `script.js` siano nella stessa cartella.
3. Aprire `index.html` con il browser (Chrome/Firefox).
4. *(Consigliato)* Mettere il browser a schermo intero (F11) per la massima visibilità.

## 🛠️ Stack Tecnologico

- **HTML5**
- **CSS3** (Flexbox, Transforms)
- **JavaScript** (ES5, SpeechSynthesis API)