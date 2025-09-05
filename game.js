  (function(){
    // ----- Configuración -----
    const PALOS = ['amarillo','magenta','verde','azul'];
    const FRACCIONES = ['1/2','1/3','2/3','1/4','3/4','2/5','3/5','1/6','5/6','3/10','7/10','3/8','5/8','1/8','1/5','4/5','7/8'];
    const CARTAS_POR_MANO = 4;
    const MATCH_TARGET = 68; // objetivo de la partida

    // ----- Estado global del match -----
    let playerScore = 0;
    let machineScore = 0;
    let roundNum = 0;

    // ----- Estado por ronda -----
    let deck = [];
    let table = [];
    let playerHand = [];
    let machineHand = [];
    let playerCaptured = [];
    let machineCaptured = [];
    let playerIntegersMade = 0; // cantidad de jugadas que resultaron en entero (opcional)
    let machineIntegersMade = 0;
    // NUEVAS variables: totales de enteros por ronda y escobas por ronda
    let playerIntegerPointsRound = 0; // suma de valores enteros obtenidos en la ronda (ej: 3,2,1 sumados)
    let machineIntegerPointsRound = 0;
    let playerEscobasRound = 0;
    let machineEscobasRound = 0;

    let nextId = 1;
    let specialFrac = null; // carta especial para la ronda

    // selecciones
    let selectedHandId = null;
    let selectedTableIds = new Set();

    // DOM refs
    const startBtn = document.getElementById('startBtn');
    const playBtn = document.getElementById('playBtn');
    const passBtn = document.getElementById('passBtn');
    const restartBtn = document.getElementById('restartBtn');
	const nextRoundBtn = document.getElementById('nextRoundBtn'); // 👈 nuevo
    const tableDiv = document.getElementById('table');
    const handDiv = document.getElementById('hand');
    const roundInfo = document.getElementById('roundInfo');
    const deckInfo = document.getElementById('deckInfo');
    const message = document.getElementById('message');
    const board = document.getElementById('board');
    const machineInfo = document.getElementById('machineInfo');
    const logDiv = document.getElementById('log');
    const playerScoreEl = document.getElementById('playerScore');
    const machineScoreEl = document.getElementById('machineScore');
    const specialDisplay = document.getElementById('specialDisplay');
    const scoreLines = document.getElementById('scoreLines');

    // ----- Funciones aritméticas exactas para fracciones -----
    function parseFrac(s){ const [a,b] = s.split('/').map(Number); return {n:a,d:b}; }
    function gcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){ const t=a%b; a=b; b=t;} return a; }
    function reduce(fr){ if(fr.n===0) return {n:0,d:1}; const g=gcd(fr.n,fr.d); return {n:fr.n/g,d:fr.d/g}; }
    function add(fr1,fr2){ const n = fr1.n*fr2.d + fr2.n*fr1.d; const d = fr1.d*fr2.d; return reduce({n,d}); }
    function sumFracs(arr){ return arr.reduce((acc,f)=>add(acc,f), {n:0,d:1}); }
    function isIntegerFrac(fr){ return fr.d===1 || (fr.n % fr.d === 0); }
    function fracToString(fr){ if(isIntegerFrac(fr)) return String(fr.n/fr.d); return fr.n+"/"+fr.d; }
    function integerValueOf(fr){ return fr.n / fr.d; } // devuelve número entero (asumiendo que isIntegerFrac=true)

    // ----- Creación de cartas y mazo -----
    function makeCard(fracStr,palo){ const fr=parseFrac(fracStr); return {id: nextId++, fracStr, fr, palo}; }
    function buildDeck(){ deck=[]; nextId=1; for(const palo of PALOS){ for(const f of FRACCIONES){ deck.push(makeCard(f,palo)); } } shuffle(deck); deckInfo.textContent = `Mazo: ${deck.length} cartas`; }
    function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }

    // ----- Renderizar UI -----
    function render(){ 
      roundInfo.textContent = `Ronda ${roundNum}`; 
      deckInfo.textContent = `Mazo: ${deck.length} cartas`; 
      message.textContent='';
      machineInfo.textContent = `Máquina: ${machineHand.length} en mano • Capturadas: ${machineCaptured.length}`;

      tableDiv.innerHTML=''; for(const c of table){ tableDiv.appendChild(makeCardElement(c,true)); }
      handDiv.innerHTML=''; for(const c of playerHand){ handDiv.appendChild(makeCardElement(c,false)); }

      playBtn.disabled = !(selectedHandId!==null && selectedTableIds.size>0);
      passBtn.disabled = !(selectedHandId!==null);
      board.hidden=false;

      updateScoreDisplay();
      specialDisplay.textContent = specialFrac ? specialFrac : '-';
    }

    function makeCardElement(card,isTable){ 
      const el=document.createElement('div'); 
      el.className='carta '+card.palo; 
      el.dataset.id=card.id; 
      el.textContent=card.fracStr; 
      el.title=`${card.fracStr} de ${card.palo}`;
      if(!isTable && selectedHandId===card.id) el.classList.add('selected');
      if(isTable && selectedTableIds.has(card.id)) el.classList.add('selected');
      el.onclick = ()=>{ if(isTable) toggleTableSelection(card.id); else selectHand(card.id); };
      return el; 
    }

    // ----- Selecciones -----
    function selectHand(id){ 
      if(selectedHandId===id) selectedHandId=null; else selectedHandId=id; 
      render(); 
    }
    function toggleTableSelection(id){ 
      if(selectedTableIds.has(id)) selectedTableIds.delete(id); else selectedTableIds.add(id); 
      render(); 
    }

    // ----- Registro de jugadas (mostrando solo jugadas) -----
    function appendLog(text){
      const p = document.createElement('div');
      p.textContent = text;
      const lower = text.toLowerCase();
      if(lower.startsWith('jugador') || lower.includes(' jugador') ) p.className = 'log-player';
      else if(lower.startsWith('máquina') || lower.includes(' máquina') || lower.includes('maquina')) p.className = 'log-machine';
      else p.className = 'log-system';
      logDiv.appendChild(p);
      logDiv.scrollTop = logDiv.scrollHeight;
    }

    // ----- Score summary (separado del log) -----
    function appendScoreSummary(line){
      const p = document.createElement('div');
      p.textContent = line;
      scoreLines.appendChild(p);
      scoreLines.scrollTop = scoreLines.scrollHeight;
    }
    function clearScoreSummary(){ scoreLines.innerHTML = ''; }

    // ----- Puntuación UI helpers -----
    function updateScoreDisplay(){
      playerScoreEl.textContent = playerScore;
      machineScoreEl.textContent = machineScore;
    }
	
	function disableActions(){
	// Deshabilita acciones del jugador hasta que la máquina juegue
	playBtn.disabled = true;
	passBtn.disabled = true;
	// Limpia selección para que no queden botones habilitados por el observer
	selectedHandId = null;
	selectedTableIds.clear();
	render();
	}
    // ----- Control de match / rondas -----
    function startMatch(){
      // inicio del match completo
      playerScore = 0;
      machineScore = 0;
      roundNum = 0;
      clearScoreSummary();
      appendLog('Iniciando match. Objetivo: ' + MATCH_TARGET + ' puntos.');
      startNewRound();
      startBtn.disabled=true;
      restartBtn.style.display='inline-block';
    }

    function startNewRound(){
      roundNum++;
      // reset por ronda
      playerCaptured = [];
      machineCaptured = [];
      playerIntegersMade = 0;
      machineIntegersMade = 0;
      // reset totales por ronda (enteros y escobas)
      playerIntegerPointsRound = 0;
      machineIntegerPointsRound = 0;
      playerEscobasRound = 0;
      machineEscobasRound = 0;

      // construir mazo nuevo para la ronda
      buildDeck();
      // elegir carta especial de la ronda
      specialFrac = FRACCIONES[Math.floor(Math.random()*FRACCIONES.length)];
      appendScoreSummary(`--- Ronda ${roundNum} — carta especial: ${specialFrac} ---`);
      // repartir inicial (mesa incluida)
      dealRoundInitial();
      appendLog(`Comienza ronda ${roundNum}. Carta especial: ${specialFrac}.`);
      // alternancia: si la ronda es par, empieza la máquina
      if(roundNum % 2 === 0){
        appendLog('Comienza la ronda con la Máquina (turno inicial).');
        setTimeout(machineTurn, 650);
      } else {
        appendLog('Comienza la ronda con el Jugador (turno inicial).');
      }
      render();
    }

    // ----- Reparto / Rondas (funciones de reparto) -----
    function dealRound(initial=false){ 
      // repartir manos (hasta CARTAS_POR_MANO si hay suficientes)
      playerHand = []; machineHand = [];
      for(let i=0;i<CARTAS_POR_MANO && deck.length>0;i++){ playerHand.push(deck.shift()); }
      for(let i=0;i<CARTAS_POR_MANO && deck.length>0;i++){ machineHand.push(deck.shift()); }

      if(initial){ 
        table=[]; 
        for(let i=0;i<4 && deck.length>0;i++) table.push(deck.shift()); 
      }

      selectedHandId=null; selectedTableIds.clear(); 
      render(); 
    }

    function dealRoundInitial(){ 
      playerHand=[]; machineHand=[]; table=[];
      for(let i=0;i<CARTAS_POR_MANO && deck.length>0;i++) playerHand.push(deck.shift());
      for(let i=0;i<CARTAS_POR_MANO && deck.length>0;i++) machineHand.push(deck.shift());
      for(let i=0;i<4 && deck.length>0;i++) table.push(deck.shift());
      selectedHandId=null; selectedTableIds.clear(); 
      render(); 
    }

    // ----- Jugada del jugador -----
    function tryPlayerPlay(){ 
      if(selectedHandId===null){ message.textContent='Seleccioná una carta de tu mano.'; return; }
      if(selectedTableIds.size===0){ message.textContent='Seleccioná al menos una carta de la mesa.'; return; }
      const handCard = playerHand.find(c=>c.id===selectedHandId);
      if(!handCard){ message.textContent='Carta de mano inválida.'; return; }
      const tableIds = Array.from(selectedTableIds); 
      const tableCards = tableIds.map(id=>table.find(c=>c.id===id));
      const sum = sumFracs([handCard.fr, ...tableCards.map(c=>c.fr)]);
      if(isIntegerFrac(sum)){
        // calcular valor entero real (ej. 3)
        const intVal = integerValueOf(sum);
        // registrar contador de enteros de la ronda (jugadas)
        playerIntegersMade++;
        // registrar suma de enteros en la ronda (valor real)
        playerIntegerPointsRound += intVal;
        // sumar puntos inmediatos por entero (cantidad de enteros) al marcador del match
        playerScore += intVal;
        // LOG: mostrar únicamente la jugada (no el detalle de puntos aquí)
        appendLog(`Jugador sumó ${fracToString(sum)} con ${handCard.fracStr} y ${tableCards.map(c=>c.fracStr).join(', ')}.`);
        // eliminar cartas de mesa por id (del array table)
        for(const id of tableIds){ const idx=table.findIndex(c=>c.id===id); if(idx!==-1) table.splice(idx,1); }
        // eliminar carta de mano
        const hidx = playerHand.findIndex(c=>c.id===handCard.id); if(hidx!==-1) playerHand.splice(hidx,1);
        // añadir a capturadas de la ronda
        playerCaptured.push(handCard, ...tableCards);
        // si mesa queda vacía -> escoba (+1)
        if(table.length===0){
          playerEscobasRound++;
          playerScore += 1;
          appendLog('Jugador dejó la mesa vacía — ESC OBA (+1).');
        }
        message.textContent = `¡Jugada válida! Sumaste ${fracToString(sum)}. (Puntos por entero: ${intVal}${table.length===0 ? ' +1 por escoba' : ''})`;
        updateScoreDisplay();
      } else {
        message.textContent = `La suma ${fracToString(sum)} no es un entero.`; 
        return; 
      }
      selectedHandId=null; selectedTableIds.clear(); 
      render(); 
      setTimeout(machineTurn,650);
    }

    function playerPass(){ 
      if(selectedHandId===null){ message.textContent='Seleccioná una carta de tu mano para pasar.'; return; }
      const idx = playerHand.findIndex(c=>c.id===selectedHandId); 
      if(idx===-1){ message.textContent='Carta no encontrada.'; return; }
      const card = playerHand.splice(idx,1)[0]; 
      table.push(card); 
      selectedHandId=null; selectedTableIds.clear(); 
      render(); 
      appendLog(`Jugador pasó carta ${card.fracStr} a la mesa.`);
      setTimeout(machineTurn,650);
    }

    // ----- Turno de la máquina -----
    function machineTurn(){ 
      machineInfo.textContent='La máquina está pensando...'; 
      let played=false;
      for(let mIdx=0;mIdx<machineHand.length && !played;mIdx++){
        const mCard = machineHand[mIdx];
        const subsets = getAllSubsets(table);
        // priorizar capturar más cartas
        subsets.sort((a,b)=>b.length - a.length);
        for(const subset of subsets){ 
          if(subset.length===0) continue; 
          const sum = sumFracs([mCard.fr, ...subset.map(x=>x.fr)]);
          if(isIntegerFrac(sum)){
            // registrar entero logrado (contador)
            machineIntegersMade++;
            // registrar suma de enteros en la ronda (valor real)
            const intVal = integerValueOf(sum);
            machineIntegerPointsRound += intVal;
            // sumar puntos inmediatos por la cantidad entera
            machineScore += intVal;
            // LOG restored to show the play (not the point)
            appendLog(`Máquina sumó ${fracToString(sum)} con ${mCard.fracStr} y ${subset.map(x=>x.fracStr).join(', ')}.`);
            // ejecutar jugada (eliminar de mesa)
            for(const sc of subset){ const ti = table.findIndex(t=>t.id===sc.id); if(ti!==-1) table.splice(ti,1); }
            machineHand.splice(mIdx,1);
            machineCaptured.push(mCard, ...subset);
            // si mesa queda vacía -> escoba (+1)
            if(table.length===0){
              machineEscobasRound++;
              machineScore += 1;
              appendLog('Máquina dejó la mesa vacía — ESC OBA (+1).');
            }
            machineInfo.textContent = `La máquina sumó ${fracToString(sum)} con ${mCard.fracStr} y ${subset.map(x=>x.fracStr).join(', ')}.`;
            updateScoreDisplay();
            played=true; 
            break;
          }
        }
      }
      if(!played){ 
        if(machineHand.length>0){ 
          const c = machineHand.shift(); 
          table.push(c); 
          machineInfo.textContent = `La máquina no pudo sumar; colocó ${c.fracStr} en la mesa.`; 
          appendLog(`Máquina no pudo sumar; colocó ${c.fracStr} en la mesa.`);
        } else { 
          machineInfo.textContent = 'La máquina no tiene cartas.'; 
          appendLog('La máquina no tiene cartas.'); 
        } 
      }
      render(); 
      checkRoundEnd(); 
    }

    // ----- Generadores de subconjuntos -----
    function getAllSubsets(arr){ 
      const results=[[]]; 
      for(const el of arr){ 
        const cur = results.map(r=>r.concat([el])); 
        results.push(...cur); 
      } 
      return results; 
    }

    // ----- Fin de ronda y cierre de partida (lógica de ronda completa) -----
    function checkRoundEnd(){ 
  // Cuando ambas manos quedan vacías:
  if(playerHand.length===0 && machineHand.length===0){
    if(deck.length>0){
      // seguir repartiendo dentro de la misma ronda (mismo mazo)
      const toGive = Math.min(CARTAS_POR_MANO, Math.floor(deck.length/2));
      playerHand = []; 
      machineHand = [];
      for(let i=0;i<toGive && deck.length>0;i++) playerHand.push(deck.shift());
      for(let i=0;i<toGive && deck.length>0;i++) machineHand.push(deck.shift());
      selectedHandId=null; selectedTableIds.clear(); 
      appendLog(`Se reparten nuevas manos dentro de la Ronda ${roundNum}.`);
      render();
	  // 👇 acá entra la lógica de rondas pares
  if(roundNum % 2 === 0){
    appendLog("Ronda par: la máquina comienza esta mano.");
    disableActions();
    setTimeout(machineTurn, 800);
  }
    } else {
      // fin de la ronda: aplicar bonificaciones de la ronda y comprobar match
      appendScoreSummary(`--- Finaliza ronda ${roundNum} — aplicando bonos ---`);
      appendScoreSummary(`Enteros en la ronda — Jugador: ${playerIntegerPointsRound}, Máquina: ${machineIntegerPointsRound}.`);
      appendScoreSummary(`Escobas en la ronda — Jugador: ${playerEscobasRound}, Máquina: ${machineEscobasRound}.`);
      applyEndOfRoundBonuses();

      if(playerScore >= MATCH_TARGET || machineScore >= MATCH_TARGET){
        finishMatch();
      } else {
        // ✅ NO iniciar automáticamente: mostrar botón
        appendScoreSummary(`Puntuación acumulada — Jugador: ${playerScore}, Máquina: ${machineScore}.`);
        appendLog(`Fin de la ronda ${roundNum}. Pulsá "Siguiente ronda" para continuar.`);
        nextRoundBtn.style.display = 'inline-block';
      }
    }
  }
}

    // ----- Cálculo final de bonificaciones (puntos 2..5) -----
    function applyEndOfRoundBonuses(){
      // 2..5: usar datos de la ronda actual (playerCaptured, playerIntegerPointsRound, etc.)
      // 2. Mayor cantidad de cartas
      const playerCards = playerCaptured.length;
      const machineCards = machineCaptured.length;
      if(playerCards > machineCards){ playerScore++; appendScoreSummary(`Jugador obtiene +1 por tener más cartas (${playerCards} vs ${machineCards}).`); }
      else if(machineCards > playerCards){ machineScore++; appendScoreSummary(`Máquina obtiene +1 por tener más cartas (${machineCards} vs ${playerCards}).`); }
      else appendScoreSummary(`Empate en cantidad de cartas (${playerCards}). Ninguno recibe punto.`);

      // 3. Bonus cartas amarillas
      const playerYellow = playerCaptured.filter(c=>c.palo==='amarillo').length;
      const machineYellow = machineCaptured.filter(c=>c.palo==='amarillo').length;
      if(playerYellow > machineYellow){ playerScore++; appendScoreSummary(`Jugador obtiene +1 por más cartas amarillas (${playerYellow} vs ${machineYellow}).`); }
      else if(machineYellow > playerYellow){ machineScore++; appendScoreSummary(`Máquina obtiene +1 por más cartas amarillas (${machineYellow} vs ${playerYellow}).`); }
      else appendScoreSummary(`Empate en cartas amarillas (${playerYellow}). Ninguno recibe punto.`);

      // 4. Carta especial (fracción specialFrac): quien tenga más de esa fracción
      if(specialFrac){
        const playerSpecialCount = playerCaptured.filter(c=>c.fracStr===specialFrac).length;
        const machineSpecialCount = machineCaptured.filter(c=>c.fracStr===specialFrac).length;
        if(playerSpecialCount > machineSpecialCount){ playerScore++; appendScoreSummary(`Jugador obtiene +1 por tener más cartas especiales (${playerSpecialCount} vs ${machineSpecialCount}).`); }
        else if(machineSpecialCount > playerSpecialCount){ machineScore++; appendScoreSummary(`Máquina obtiene +1 por tener más cartas especiales (${machineSpecialCount} vs ${playerSpecialCount}).`); }
        else appendScoreSummary(`Empate en carta especial (${playerSpecialCount}). Ninguno recibe punto.`);
      } else {
        appendScoreSummary('No hay carta especial definida.');
      }

      // 5. Mayor cantidad de enteros logrados en la ronda (usar SUMA de enteros, no cantidad de jugadas)
      if(playerIntegerPointsRound > machineIntegerPointsRound){
        playerScore++;
        appendScoreSummary(`Jugador obtiene +1 por más enteros logrados en la ronda (${playerIntegerPointsRound} vs ${machineIntegerPointsRound}).`);
      } else if(machineIntegerPointsRound > playerIntegerPointsRound){
        machineScore++;
        appendScoreSummary(`Máquina obtiene +1 por más enteros logrados en la ronda (${machineIntegerPointsRound} vs ${playerIntegerPointsRound}).`);
      } else {
        appendScoreSummary(`Empate en enteros logrados (${playerIntegerPointsRound}). Ninguno recibe punto.`);
      }

      updateScoreDisplay();
    }

    function finishMatch(){ 
      board.hidden=true; 
      startBtn.disabled=false; 
      restartBtn.style.display='inline-block'; 
      message.textContent = `Fin del match. Puntuación final — Jugador: ${playerScore}, Máquina: ${machineScore}.`; 
      appendScoreSummary('Fin del match.');
      appendScoreSummary(`Puntuación final — Jugador: ${playerScore}, Máquina: ${machineScore}.`);
      if(playerScore > machineScore) appendScoreSummary('Resultado: Ganó el Jugador.');
      else if(machineScore > playerScore) appendScoreSummary('Resultado: Ganó la Máquina.');
      else appendScoreSummary('Resultado: Empate.');
      appendLog('Match finalizado.');
    }

    // ----- Bind events -----
    startBtn.addEventListener('click', ()=>{ startMatch(); });
    playBtn.addEventListener('click', tryPlayerPlay);
    passBtn.addEventListener('click', playerPass);
    restartBtn.addEventListener('click', ()=>location.reload());
	nextRoundBtn.addEventListener('click', () => {
	nextRoundBtn.style.display = 'none';
	startNewRound();
	});

    // habilitar botones según selección
    const obs = new MutationObserver(()=>{
      playBtn.disabled = !(selectedHandId!==null && selectedTableIds.size>0); 
      passBtn.disabled = !(selectedHandId!==null); 
    });
    obs.observe(handDiv,{childList:true,subtree:true}); 
    obs.observe(tableDiv,{childList:true,subtree:true});

    // ----- helpers debugging (console) -----
    window.__eoap = { get deck(){return deck}, get playerHand(){return playerHand}, get machineHand(){return machineHand}, get table(){return table}, get playerScore(){return playerScore}, get machineScore(){return machineScore} };

  })();