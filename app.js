// --- CONFIGURAÇÃO & ESTADO INICIAL ---
const COUNTER_NAMESPACE = 'pente';
const COUNTER_KEY = 'pentevisits';
const COUNTER_API_KEY = 'ut_6fPQ5sPXcxYv7A4IIzYqtyXMlGf7BwoDyyndpkfG';
const ADMIN_SECRET = 'mysecret123';

let currentVisitCount = null;
let deferredPrompt = null;

const gameState = {
  team1Name: 'Nós',
  team2Name: 'Vós',
  maxScore: 10,
  team1Score: 0,
  team2Score: 0,
  team1NextPos: 1,
  team2NextPos: 1,
  team1Events: [],
  team2Events: [],
  history: []
};

// --- CICLO DE VIDA DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkIOSInstallPrompt();
  trackVisit();
  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registado com sucesso.'))
        .catch(err => console.error('Falha ao registar Service Worker:', err));
    });
  }
}

// --- BINDING DE EVENTOS ---
function initEventListeners() {
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-new-game').addEventListener('click', promptNewGame);
  document.getElementById('btn-undo').addEventListener('click', promptUndo);

  // Pontuação Equipa 1
  document.getElementById('btnT1_1').addEventListener('click', () => addScore(1, 1));
  document.getElementById('btnT1_2').addEventListener('click', () => addScore(1, 2));
  document.getElementById('btnT1_4').addEventListener('click', () => addScore(1, 4));

  // Pontuação Equipa 2
  document.getElementById('btnT2_1').addEventListener('click', () => addScore(2, 1));
  document.getElementById('btnT2_2').addEventListener('click', () => addScore(2, 2));
  document.getElementById('btnT2_4').addEventListener('click', () => addScore(2, 4));

  // PWA & Modais
  document.getElementById('pwa-install-toast').addEventListener('click', openInstallInstructions);
  document.getElementById('btn-close-toast').addEventListener('click', (e) => {
    e.stopPropagation();
    dismissInstallToast();
  });
  document.getElementById('btn-close-install-modal').addEventListener('click', closeInstallInstructions);

  // Secret Admin Click
  let titleClicks = 0;
  document.querySelector('.app-title').addEventListener('click', () => {
    titleClicks++;
    if (titleClicks >= 5) {
      if (currentVisitCount !== null) renderAdminBadge(currentVisitCount);
      else alert('A carregar contagem...');
      titleClicks = 0;
    }
  });

  window.addEventListener('resize', drawTrack);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('pwa-install-toast').classList.remove('hidden');
  });
}

// --- LÓGICA DO JOGO ---
function startGame() {
  const t1 = document.getElementById('inputTeam1').value.trim();
  const t2 = document.getElementById('inputTeam2').value.trim();
  const maxVal = parseInt(document.getElementById('inputMaxScore').value);

  gameState.team1Name = t1 || 'Nós';
  gameState.team2Name = t2 || 'Vós';
  gameState.maxScore = isNaN(maxVal) ? 10 : Math.max(maxVal, 1);

  dismissInstallToast();

  document.getElementById('display-team1-name').innerText = gameState.team1Name;
  document.getElementById('display-team2-name').innerText = gameState.team2Name;

  document.getElementById('btnT1_1').innerText = `${gameState.team1Name} +1`;
  document.getElementById('btnT1_2').innerText = `${gameState.team1Name} +2`;
  document.getElementById('btnT1_4').innerText = `${gameState.team1Name} +4`;

  document.getElementById('btnT2_1').innerText = `${gameState.team2Name} +1`;
  document.getElementById('btnT2_2').innerText = `${gameState.team2Name} +2`;
  document.getElementById('btnT2_4').innerText = `${gameState.team2Name} +4`;

  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');

  resetGame();
  requestAnimationFrame(drawTrack);
}

function addScore(team, points) {
  const currentScore = team === 1 ? gameState.team1Score : gameState.team2Score;
  if (currentScore >= gameState.maxScore) return;

  const added = Math.min(points, gameState.maxScore - currentScore);
  let event = null;

  if (team === 1) {
    const nextPos = gameState.team1NextPos;
    if (added === 1) { event = { type: 'single', pos: nextPos }; gameState.team1NextPos += 1; }
    else if (added === 2) { event = { type: 'double', pos1: nextPos, pos2: nextPos + 1 }; gameState.team1NextPos += 2; }
    else if (added === 4) { event = { type: 'quadruple', pos1: nextPos, pos2: nextPos + 3 }; gameState.team1NextPos += 4; }
    gameState.team1Score += added;
    if (event) gameState.team1Events.push(event);
  } else {
    const nextPos = gameState.team2NextPos;
    if (added === 1) { event = { type: 'single', pos: nextPos }; gameState.team2NextPos += 1; }
    else if (added === 2) { event = { type: 'double', pos1: nextPos, pos2: nextPos + 1 }; gameState.team2NextPos += 2; }
    else if (added === 4) { event = { type: 'quadruple', pos1: nextPos, pos2: nextPos + 3 }; gameState.team2NextPos += 4; }
    gameState.team2Score += added;
    if (event) gameState.team2Events.push(event);
  }

  gameState.history.push({ team, points: added, event });
  updateUI();
  checkWinner();
}

function undoLastAction() {
  const last = gameState.history.pop();
  if (!last) return;

  if (last.team === 1) {
    gameState.team1Score = Math.max(0, gameState.team1Score - last.points);
    gameState.team1Events.pop();
    if (last.points === 1) gameState.team1NextPos -= 1;
    else if (last.points === 2) gameState.team1NextPos -= 2;
    else if (last.points === 4) gameState.team1NextPos -= 4;
  } else {
    gameState.team2Score = Math.max(0, gameState.team2Score - last.points);
    gameState.team2Events.pop();
    if (last.points === 1) gameState.team2NextPos -= 1;
    else if (last.points === 2) gameState.team2NextPos -= 2;
    else if (last.points === 4) gameState.team2NextPos -= 4;
  }
  updateUI();
}

function checkWinner() {
  if (gameState.team1Score >= gameState.maxScore) {
    showModal('Fim do Jogo!', `Parabéns, ${gameState.team1Name} venceu por ${gameState.team1Score}-${gameState.team2Score}!\n\nDeseja jogar novamente?`, resetGame, exitToMenu);
  } else if (gameState.team2Score >= gameState.maxScore) {
    showModal('Fim do Jogo!', `Parabéns, ${gameState.team2Name} venceu por ${gameState.team2Score}-${gameState.team1Score}!\n\nDeseja jogar novamente?`, resetGame, exitToMenu);
  }
}

function resetGame() {
  gameState.team1Score = 0; gameState.team2Score = 0;
  gameState.team1NextPos = 1; gameState.team2NextPos = 1;
  gameState.team1Events = []; gameState.team2Events = [];
  gameState.history = []; 
  updateUI();
}

function exitToMenu() {
  resetGame();
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('menu-screen').classList.remove('hidden');
}

function updateUI() {
  document.getElementById('display-team1-score').innerText = gameState.team1Score;
  document.getElementById('display-team2-score').innerText = gameState.team2Score;
  drawTrack();
}

// --- RENDERIZAÇÃO DO CANVAS ---
function drawTrack() {
  const canvas = document.getElementById('trackCanvas');
  if (!canvas) return;

  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;

  if (width === 0 || height === 0) {
    requestAnimationFrame(drawTrack);
    return;
  }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const paddingX = 20;
  const arrowWidth = width - (paddingX * 2);
  const arrowY = height / 2;

  const arrowHeadSize = 35;
  const numberOfVerticalLines = gameState.maxScore;
  const spaceBetweenLines = (arrowWidth - arrowHeadSize) / (numberOfVerticalLines + 1);
  const verticalLineHeightForArrow = height * 0.35;

  const engraveColor = '#E3D6C8';
  const team1Color = '#2ECC71';
  const team2Color = '#7FB3F5';

  ctx.clearRect(0, 0, width, height);

  ctx.beginPath(); ctx.strokeStyle = engraveColor; ctx.lineWidth = 3;
  ctx.moveTo(paddingX, arrowY); ctx.lineTo(paddingX + arrowWidth - arrowHeadSize, arrowY);
  ctx.stroke();

  for (let i = 0; i <= numberOfVerticalLines; i++) {
    const xPos = paddingX + (i * spaceBetweenLines);
    const lineHeight = (i === 0 || i === 5) ? verticalLineHeightForArrow * 1.4 : verticalLineHeightForArrow;
    ctx.beginPath(); ctx.strokeStyle = engraveColor; ctx.lineWidth = 2;
    ctx.moveTo(xPos, arrowY - lineHeight / 2); ctx.lineTo(xPos, arrowY + lineHeight / 2); ctx.stroke();
  }

  ctx.beginPath(); ctx.strokeStyle = engraveColor; ctx.lineWidth = 2.5;
  ctx.moveTo(paddingX + arrowWidth - arrowHeadSize, arrowY - arrowHeadSize / 2);
  ctx.lineTo(paddingX + arrowWidth, arrowY);
  ctx.lineTo(paddingX + arrowWidth - arrowHeadSize, arrowY + arrowHeadSize / 2); ctx.stroke();

  const dotRadius = 5;
  const eventLineWidth = 2.5;

  const yTeam1 = arrowY - verticalLineHeightForArrow / 2 - 8;
  gameState.team1Events.forEach(event => {
    ctx.fillStyle = team1Color; ctx.strokeStyle = team1Color; ctx.lineWidth = eventLineWidth;
    if (event.type === 'single') {
      const x = paddingX + (event.pos * spaceBetweenLines);
      ctx.beginPath(); ctx.arc(x, yTeam1, dotRadius, 0, Math.PI * 2); ctx.fill();
    } else {
      const x1 = paddingX + (event.pos1 * spaceBetweenLines);
      const x2 = paddingX + (event.pos2 * spaceBetweenLines);
      ctx.beginPath(); ctx.arc(x1, yTeam1, dotRadius, 0, Math.PI * 2);
      ctx.arc(x2, yTeam1, dotRadius, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x1, yTeam1); ctx.lineTo(x2, yTeam1); ctx.stroke();
    }
  });

  const yTeam2 = arrowY + verticalLineHeightForArrow / 2 + 8;
  gameState.team2Events.forEach(event => {
    ctx.fillStyle = team2Color; ctx.strokeStyle = team2Color; ctx.lineWidth = eventLineWidth;
    if (event.type === 'single') {
      const x = paddingX + (event.pos * spaceBetweenLines);
      ctx.beginPath(); ctx.arc(x, yTeam2, dotRadius, 0, Math.PI * 2); ctx.fill();
    } else {
      const x1 = paddingX + (event.pos1 * spaceBetweenLines);
      const x2 = paddingX + (event.pos2 * spaceBetweenLines);
      ctx.beginPath(); ctx.arc(x1, yTeam2, dotRadius, 0, Math.PI * 2);
      ctx.arc(x2, yTeam2, dotRadius, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x1, yTeam2); ctx.lineTo(x2, yTeam2); ctx.stroke();
    }
  });
}

// --- MODAIS & HELPERS DE UI ---
function showModal(title, text, onConfirm, onCancel) {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-text').innerText = text;
  
  const btnSim = document.getElementById('modal-btn-sim');
  const btnNao = document.getElementById('modal-btn-nao');
  
  const newBtnSim = btnSim.cloneNode(true);
  const newBtnNao = btnNao.cloneNode(true);
  btnSim.parentNode.replaceChild(newBtnSim, btnSim);
  btnNao.parentNode.replaceChild(newBtnNao, btnNao);

  newBtnSim.onclick = () => { closeModal(); if(onConfirm) onConfirm(); };
  newBtnNao.onclick = () => { closeModal(); if(onCancel) onCancel(); };

  document.getElementById('modal-container').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal-container').classList.add('hidden'); }
function promptNewGame() { showModal('Novo Jogo', 'Gostaria de reiniciar o jogo?', resetGame, null); }
function promptUndo() { showModal('Anular Jogada', 'Tem a certeza que quer anular a última jogada?', undoLastAction, null); }

// --- PWA UI HELPERS ---
function checkIOSInstallPrompt() {
  const isIOS = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
  const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
  if (isIOS && !isInStandaloneMode) {
    const toast = document.getElementById('pwa-install-toast');
    document.getElementById('toast-text').innerHTML = '📱 Toque em <b>Partilhar</b> e selecione <b>Adicionar ao Ecrã Principal</b>';
    toast.classList.remove('hidden');
  }
}

function dismissInstallToast() {
  document.getElementById('pwa-install-toast').classList.add('hidden');
}

function openInstallInstructions() {
  const modal = document.getElementById('install-modal');
  const bodyDiv = document.getElementById('install-instructions-body');
  const isIOS = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());

  if (isIOS) {
    bodyDiv.innerHTML = `
      <ol style="padding-left: 20px; margin: 0;">
        <li>Abra esta página no <b>Safari</b>.</li>
        <li>Toque no botão de <b>Partilhar</b> <span style="font-size: 1.2rem;">⎋</span> na barra inferior.</li>
        <li>Deslize para baixo e selecione <b>"Adicionar ao Ecrã Principal"</b>.</li>
        <li>Toque em <b>Adicionar</b> no canto superior direito.</li>
      </ol>
    `;
  } else {
    bodyDiv.innerHTML = `
      <ol style="padding-left: 20px; margin: 0;">
        <li>Toque no menu do navegador (três pontos <b>⋮</b> no topo direito).</li>
        <li>Selecione <b>"Adicionar ao ecrã principal"</b> ou <b>"Instalar aplicação"</b>.</li>
        <li>Confirme ao selecionar <b>Instalar</b>.</li>
      </ol>
    `;
  }
  modal.classList.remove('hidden');
}

function closeInstallInstructions() {
  document.getElementById('install-modal').classList.add('hidden');
}

// --- CONTADOR DE VISITAS & ADMIN ---
async function trackVisit() {
  try {
    const res = await fetch(`https://api.counterapi.dev/v2/${COUNTER_NAMESPACE}/${COUNTER_KEY}/up`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${COUNTER_API_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    // A CounterAPI v2 devolve o valor no campo 'count' ou 'value'
    currentVisitCount = data.count ?? data.value ?? data.up;
  } catch (err) {
    console.warn('Contador externo indisponível. A usar backup local:', err);
    let localVisits = parseInt(localStorage.getItem('pente_local_visits') || '0') + 1;
    localStorage.setItem('pente_local_visits', localVisits);
    currentVisitCount = localVisits;
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('admin') === ADMIN_SECRET) {
    renderAdminBadge(currentVisitCount);
  }
}

function renderAdminBadge(count) {
  let badge = document.getElementById('admin-visit-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'admin-visit-badge';
    badge.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: #D4AF37;
      border: 1px solid #D4AF37;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: bold;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(badge);
  }
  badge.innerText = `👁 Visitas: ${count}`;
}