const els = {
  categoryScreen: document.getElementById('categoryScreen'),
  categoryList: document.getElementById('categoryList'),
  studyPanel: document.getElementById('studyPanel'),
  bottomBar: document.getElementById('bottomBar'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsBackdrop: document.getElementById('settingsBackdrop'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsTabs: Array.from(document.querySelectorAll('.settings-tabs [role="tab"]')),
  settingsPanels: Array.from(document.querySelectorAll('.settings-tab-panels [role="tabpanel"]')),
  positionLabel: document.getElementById('positionLabel'),
  modeLabel: document.getElementById('modeLabel'),
  backToCategoriesBtn: document.getElementById('backToCategoriesBtn'),
  questionCard: document.getElementById('questionCard'),
  cardSideLabel: document.getElementById('cardSideLabel'),
  cardText: document.getElementById('cardText'),
  gestureHint: document.getElementById('gestureHint'),
  autoModeBtn: document.getElementById('autoModeBtn'),
  playBtn: document.getElementById('playBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  repeatBtn: document.getElementById('repeatBtn'),
  jaVoiceSelect: document.getElementById('jaVoiceSelect'),
  enVoiceSelect: document.getElementById('enVoiceSelect'),
  jaRateInput: document.getElementById('jaRateInput'),
  enRateInput: document.getElementById('enRateInput'),
  jaRateValue: document.getElementById('jaRateValue'),
  enRateValue: document.getElementById('enRateValue'),
  wakeLockBtn: document.getElementById('wakeLockBtn'),
  wakeLockStatus: document.getElementById('wakeLockStatus'),
  pairEditor: document.getElementById('pairEditor'),
  applyPairsBtn: document.getElementById('applyPairsBtn'),
  resetPairsBtn: document.getElementById('resetPairsBtn'),
  exportLogsBtn: document.getElementById('exportLogsBtn'),
  logOutput: document.getElementById('logOutput'),
  sheetIdInput: document.getElementById('sheetIdInput'),
  clientIdInput: document.getElementById('clientIdInput'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveGoogleConfigBtn: document.getElementById('saveGoogleConfigBtn'),
  loadSheetBtn: document.getElementById('loadSheetBtn'),
  syncLogsBtn: document.getElementById('syncLogsBtn'),
  googleStatus: document.getElementById('googleStatus')
};

let pairs = storage.getPairs();
let settings = storage.getSettings();
let activeCategory = '';
let order = [];
let index = 0;
let revealed = false;
let isAutoPlaying = false;
let isTransitioning = false;
let wakeLock = null;
let timer = null;
let sessionStartedAt = Date.now();
let studiedIds = new Set();

function normalizeCategory(category) {
  return String(category || '未分類').trim() || '未分類';
}

function activePairs() {
  if (!activeCategory) return [];
  return pairs.filter((pair) => normalizeCategory(pair.category) === activeCategory);
}

function currentPair() {
  const scopedPairs = activePairs();
  return scopedPairs[order[index]] || null;
}

function shuffleIndexes(length) {
  const indexes = Array.from({ length }, (_, i) => i);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

function rebuildOrder(keepCurrent = false) {
  const scopedPairs = activePairs();
  const currentId = currentPair() && currentPair().id;
  order = settings.shuffle ? shuffleIndexes(scopedPairs.length) : scopedPairs.map((_, i) => i);
  const nextIndex = keepCurrent ? order.findIndex((pairIndex) => scopedPairs[pairIndex].id === currentId) : 0;
  index = Math.max(0, nextIndex);
}

function renderCategories() {
  const categories = new Map();
  pairs.forEach((pair) => {
    const category = normalizeCategory(pair.category);
    categories.set(category, (categories.get(category) || 0) + 1);
  });

  els.categoryList.innerHTML = '';
  categories.forEach((count, category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-card';

    const textWrap = document.createElement('span');
    const name = document.createElement('span');
    const meta = document.createElement('span');
    const arrow = document.createElement('span');

    name.className = 'category-name';
    name.textContent = category;
    meta.className = 'category-meta';
    meta.textContent = `${count}問`;
    arrow.className = 'category-arrow';
    arrow.textContent = '›';

    textWrap.appendChild(name);
    textWrap.appendChild(meta);
    button.appendChild(textWrap);
    button.appendChild(arrow);
    button.addEventListener('click', () => startCategory(category));
    els.categoryList.appendChild(button);
  });
}

function setHint(message) {
  if (!els.gestureHint) return;
  els.gestureHint.textContent = message;
  window.clearTimeout(setHint.timer);
  setHint.timer = window.setTimeout(() => {
    els.gestureHint.textContent = '左右スワイプで前後、タップで答え';
  }, 1400);
}

function showCategoryScreen() {
  activeCategory = '';
  stopAll();
  renderCategories();
  els.categoryScreen.hidden = false;
  els.studyPanel.hidden = true;
  els.bottomBar.hidden = true;
}

function startCategory(category) {
  activeCategory = normalizeCategory(category);
  revealed = false;
  rebuildOrder();
  els.categoryScreen.hidden = true;
  els.studyPanel.hidden = false;
  els.bottomBar.hidden = false;
  render();
  if (settings.autoPlayback) startAutoPlayback();
  else speakJapanese();
}

function render() {
  renderCategories();
  const pair = currentPair();
  if (!pair) {
    showCategoryScreen();
    return;
  }

  els.cardSideLabel.textContent = revealed ? 'English' : '日本語';
  els.cardText.textContent = revealed ? pair.english : pair.japanese;
  els.questionCard.classList.toggle('answer', revealed);
  els.positionLabel.textContent = `${index + 1} / ${activePairs().length}`;
  els.modeLabel.textContent = settings.autoPlayback ? '自動' : '通常';
  els.autoModeBtn.setAttribute('aria-pressed', String(settings.autoPlayback));
  els.playBtn.disabled = !settings.autoPlayback;
  els.playBtn.setAttribute('aria-pressed', String(isAutoPlaying));
  els.playBtn.textContent = isAutoPlaying ? '■' : '▶';
  els.shuffleBtn.setAttribute('aria-pressed', String(settings.shuffle));
  els.repeatBtn.setAttribute('aria-pressed', String(settings.repeat));
  updateWakeLockUi();
}

function saveSessionLog() {
  const durationSec = Math.max(1, Math.floor((Date.now() - sessionStartedAt) / 1000));
  if (!studiedIds.size && durationSec < 10) return;
  storage.addLog({
    durationSec,
    itemCount: studiedIds.size,
    mode: isAutoPlaying ? 'auto' : 'manual',
    category: activeCategory,
    jaVoice: settings.jaVoice,
    enVoice: settings.enVoice,
    jaRate: settings.jaRate,
    enRate: settings.enRate
  });
  sessionStartedAt = Date.now();
  studiedIds = new Set();
  if (activeCategory) render();
}

function markStudied() {
  const pair = currentPair();
  if (pair) studiedIds.add(pair.id);
  if (activeCategory) render();
}

function stopAll() {
  isAutoPlaying = false;
  window.clearTimeout(timer);
  speechController.stop();
  if (activeCategory) render();
}

function updateWakeLockUi(message = null) {
  els.wakeLockBtn.setAttribute('aria-pressed', String(settings.keepAwake));
  els.wakeLockBtn.textContent = settings.keepAwake ? 'スリープ防止 ON' : 'スリープ防止 OFF';
  if (message) {
    els.wakeLockStatus.textContent = message;
  } else if (!settings.keepAwake) {
    els.wakeLockStatus.textContent = 'OFF';
  } else if (wakeLock) {
    els.wakeLockStatus.textContent = 'ON';
  } else if (!('wakeLock' in navigator)) {
    els.wakeLockStatus.textContent = 'この環境では未対応です';
  } else {
    els.wakeLockStatus.textContent = '待機中';
  }
}

async function requestWakeLock() {
  if (!settings.keepAwake) return;
  if (!('wakeLock' in navigator)) {
    updateWakeLockUi('この環境では未対応です');
    return;
  }
  if (document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
      updateWakeLockUi(settings.keepAwake ? '解除されました' : null);
    });
    updateWakeLockUi('ON');
  } catch (error) {
    wakeLock = null;
    updateWakeLockUi('取得できませんでした。低電力モードや端末設定を確認してください。');
  }
}

async function releaseWakeLock() {
  if (!wakeLock) {
    updateWakeLockUi();
    return;
  }
  const lock = wakeLock;
  wakeLock = null;
  await lock.release().catch(() => {});
  updateWakeLockUi();
}

function startAutoPlayback() {
  if (!activeCategory || !settings.autoPlayback || isAutoPlaying) return;
  isAutoPlaying = true;
  render();
  autoSequence();
}

function speakJapanese() {
  const pair = currentPair();
  if (!pair) return Promise.resolve();
  markStudied();
  return speechController.speak({
    text: pair.japanese,
    langPrefix: 'ja',
    rate: settings.jaRate,
    voiceName: settings.jaVoice
  }).catch(() => setHint('読み上げに失敗しました'));
}

function speakEnglish() {
  const pair = currentPair();
  if (!pair) return Promise.resolve();
  revealed = true;
  markStudied();
  render();
  return speechController.speak({
    text: pair.english,
    langPrefix: 'en',
    rate: settings.enRate,
    voiceName: settings.enVoice
  }).catch(() => setHint('読み上げに失敗しました'));
}

function japaneseWaitMs(text) {
  return settings.baseWaitMs + String(text).length * settings.perJapaneseCharMs;
}

function englishWaitMs(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return settings.baseWaitMs + words * settings.perEnglishWordMs;
}

function wait(ms) {
  return new Promise((resolve) => {
    timer = window.setTimeout(resolve, ms);
  });
}

async function autoSequence() {
  if (!isAutoPlaying) return;
  revealed = false;
  render();
  const pair = currentPair();
  if (!pair) return;
  await speakJapanese();
  if (!isAutoPlaying) return;
  await wait(japaneseWaitMs(pair.japanese));
  if (!isAutoPlaying) return;
  await speakEnglish();
  if (!isAutoPlaying) return;
  await wait(englishWaitMs(pair.english));
  if (!isAutoPlaying) return;
  goNext(true);
  autoSequence();
}

function goNext(fromAuto = false) {
  if (!activeCategory) return;
  revealed = false;
  if (index < order.length - 1) {
    index += 1;
  } else if (settings.repeat) {
    rebuildOrder(false);
  } else {
    stopAll();
    if (fromAuto) saveSessionLog();
  }
  render();
}

function advanceManualFlow() {
  if (!activeCategory) return;
  if (!revealed) {
    revealed = true;
    render();
    speakEnglish();
    return;
  }
  if (index >= order.length - 1) return;
  goNext();
  speakJapanese();
}

function goPrev() {
  if (!activeCategory) return;
  if (revealed) {
    revealed = false;
    render();
    speakJapanese();
    return;
  }
  index = Math.max(0, index - 1);
  revealed = true;
  render();
  speakEnglish();
}

function animateCardChange(direction) {
  if (!activeCategory || isTransitioning) return;
  if (
    direction === 'next' &&
    !settings.autoPlayback &&
    revealed &&
    index >= order.length - 1
  ) {
    setHint('最後の問題');
    return;
  }
  isTransitioning = true;
  const outClass = direction === 'next' ? 'swipe-next-out' : 'swipe-prev-out';
  const inClass = direction === 'next' ? 'swipe-next-in' : 'swipe-prev-in';

  els.questionCard.classList.add(outClass);
  window.setTimeout(() => {
    if (direction === 'next') {
      if (settings.autoPlayback) goNext();
      else advanceManualFlow();
    }
    else goPrev();
    els.questionCard.classList.remove(outClass);
    els.questionCard.classList.add(inClass);
    window.setTimeout(() => {
      els.questionCard.classList.remove(inClass);
      isTransitioning = false;
    }, 220);
  }, 120);
}

function setSetting(update) {
  settings = storage.saveSettings(update);
  if (activeCategory) render();
  else renderCategories();
}

function populateVoices() {
  const voices = speechController.getVoices();
  const jaVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('ja'));
  const enVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  fillVoiceSelect(els.jaVoiceSelect, jaVoices, settings.jaVoice, '日本語音声を自動選択');
  fillVoiceSelect(els.enVoiceSelect, enVoices, settings.enVoice, '英語音声を自動選択');
  applyPreferredDefaultVoices(jaVoices, enVoices);
}

function fillVoiceSelect(select, voices, selectedName, fallbackLabel) {
  select.innerHTML = '';
  const fallback = document.createElement('option');
  fallback.value = '';
  fallback.textContent = fallbackLabel;
  select.appendChild(fallback);
  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    select.appendChild(option);
  });
  select.value = selectedName;
}

function applySettingsToControls() {
  els.jaRateInput.value = settings.jaRate;
  els.enRateInput.value = settings.enRate;
  els.jaRateValue.textContent = `${Number(settings.jaRate).toFixed(1)}x`;
  els.enRateValue.textContent = `${Number(settings.enRate).toFixed(1)}x`;
}

function applyPreferredDefaultVoices(jaVoices, enVoices) {
  const preferredJapanese = ['Kyoko', 'Otoya', 'Google 日本語', 'Japanese'];
  const preferredEnglish = ['Samantha', 'Google US English', 'Daniel', 'Karen', 'Moira', 'Alex'];
  if (!settings.jaVoice) {
    const voice = findPreferredVoice(jaVoices, preferredJapanese);
    if (voice) {
      settings = storage.saveSettings({ jaVoice: voice.name });
      els.jaVoiceSelect.value = voice.name;
    }
  }
  if (!settings.enVoice) {
    const voice = findPreferredVoice(enVoices, preferredEnglish);
    if (voice) {
      settings = storage.saveSettings({ enVoice: voice.name });
      els.enVoiceSelect.value = voice.name;
    }
  }
}

function findPreferredVoice(voices, preferredNames) {
  return preferredNames.map((name) => voices.find((voice) => voice.name.includes(name))).find(Boolean) || voices[0] || null;
}

function loadGoogleConfigToForm() {
  const config = storage.getGoogleConfig();
  els.sheetIdInput.value = config.sheetId;
  els.clientIdInput.value = config.clientId;
  els.apiKeyInput.value = config.apiKey;
}

function bindEvents() {
  els.openSettingsBtn.addEventListener('click', openSettings);
  els.closeSettingsBtn.addEventListener('click', closeSettings);
  els.settingsBackdrop.addEventListener('click', closeSettings);
  els.settingsTabs.forEach((tab) => {
    tab.addEventListener('click', () => selectSettingsTab(tab.dataset.tab));
  });
  els.backToCategoriesBtn.addEventListener('click', () => {
    saveSessionLog();
    showCategoryScreen();
  });
  els.autoModeBtn.addEventListener('click', () => {
    const enabled = !settings.autoPlayback;
    setSetting({ autoPlayback: enabled });
    if (enabled) startAutoPlayback();
    else {
      stopAll();
      saveSessionLog();
    }
  });
  els.playBtn.addEventListener('click', () => {
    if (!settings.autoPlayback) return;
    if (isAutoPlaying) {
      stopAll();
      saveSessionLog();
      return;
    }
    startAutoPlayback();
  });
  els.shuffleBtn.addEventListener('click', () => {
    setSetting({ shuffle: !settings.shuffle });
    if (activeCategory) rebuildOrder(true);
    render();
  });
  els.repeatBtn.addEventListener('click', () => setSetting({ repeat: !settings.repeat }));
  els.wakeLockBtn.addEventListener('click', async () => {
    const enabled = !settings.keepAwake;
    settings = storage.saveSettings({ keepAwake: enabled });
    if (enabled) await requestWakeLock();
    else await releaseWakeLock();
    render();
  });
  els.jaVoiceSelect.addEventListener('change', () => setSetting({ jaVoice: els.jaVoiceSelect.value }));
  els.enVoiceSelect.addEventListener('change', () => setSetting({ enVoice: els.enVoiceSelect.value }));
  els.jaRateInput.addEventListener('input', () => {
    setSetting({ jaRate: Number(els.jaRateInput.value) });
    applySettingsToControls();
  });
  els.enRateInput.addEventListener('input', () => {
    setSetting({ enRate: Number(els.enRateInput.value) });
    applySettingsToControls();
  });
  els.applyPairsBtn.addEventListener('click', () => {
    const nextPairs = storage.parsePairsText(els.pairEditor.value);
    if (!nextPairs.length) {
      window.alert('カテゴリ[TAB]日本語[TAB]English の形式で入力してください');
      return;
    }
    pairs = nextPairs;
    storage.savePairs(pairs);
    showCategoryScreen();
  });
  els.resetPairsBtn.addEventListener('click', () => {
    pairs = storage.resetPairs();
    els.pairEditor.value = storage.pairsToText(pairs);
    showCategoryScreen();
  });
  els.exportLogsBtn.addEventListener('click', () => {
    els.logOutput.hidden = !els.logOutput.hidden;
    els.logOutput.textContent = JSON.stringify(storage.getLogs(), null, 2);
  });
  els.saveGoogleConfigBtn.addEventListener('click', () => {
    storage.saveGoogleConfig({
      sheetId: els.sheetIdInput.value,
      clientId: els.clientIdInput.value,
      apiKey: els.apiKeyInput.value
    });
    els.googleStatus.textContent = 'Google設定を保存しました';
  });
  els.loadSheetBtn.addEventListener('click', async () => {
    try {
      els.googleStatus.textContent = '例文を読み込んでいます';
      const loadedPairs = await googleSync.loadPairs(storage.getGoogleConfig());
      if (!loadedPairs.length) throw new Error('Sentencesシートに例文がありません。');
      pairs = loadedPairs;
      storage.savePairs(pairs);
      els.pairEditor.value = storage.pairsToText(pairs);
      showCategoryScreen();
      els.googleStatus.textContent = `${loadedPairs.length}件の例文を読み込みました`;
    } catch (error) {
      els.googleStatus.textContent = error.message || '読み込みに失敗しました';
    }
  });
  els.syncLogsBtn.addEventListener('click', async () => {
    try {
      els.googleStatus.textContent = 'ログを保存しています';
      const logs = storage.getLogs().slice(0, 20).reverse();
      await googleSync.appendLogs(storage.getGoogleConfig(), logs);
      els.googleStatus.textContent = `${logs.length}件のログを保存しました`;
    } catch (error) {
      els.googleStatus.textContent = error.message || 'ログ保存に失敗しました';
    }
  });
  bindGestures();
  window.addEventListener('beforeunload', saveSessionLog);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
}

function selectSettingsTab(tabName) {
  els.settingsTabs.forEach((tab) => {
    const selected = tab.dataset.tab === tabName;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  els.settingsPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabName;
  });
}

function bindGestures() {
  let startX = 0;
  let startY = 0;
  let startAt = 0;
  let latestX = 0;
  let dragging = false;
  els.studyPanel.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
    latestX = event.clientX;
    startAt = Date.now();
    dragging = false;
    els.questionCard.classList.add('dragging');
    els.studyPanel.setPointerCapture(event.pointerId);
  });
  els.studyPanel.addEventListener('pointermove', (event) => {
    if (!startAt || isTransitioning) return;
    latestX = event.clientX;
    const dx = latestX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 8 && !dragging) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    dragging = true;
    const clampedX = Math.max(-72, Math.min(72, dx * 0.72));
    const opacity = Math.max(.72, 1 - Math.abs(clampedX) / 220);
    els.questionCard.style.transform = `translateX(${clampedX}px)`;
    els.questionCard.style.opacity = String(opacity);
  });
  els.studyPanel.addEventListener('pointerup', (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const elapsed = Date.now() - startAt;
    els.questionCard.classList.remove('dragging');
    els.questionCard.style.transform = '';
    els.questionCard.style.opacity = '';
    startAt = 0;
    if (Math.abs(dx) > 48 && Math.abs(dy) < 70) {
      if (dx > 0) {
        animateCardChange('prev');
        setHint('前の問題');
      } else {
        animateCardChange('next');
        setHint(!settings.autoPlayback && !revealed ? '答え' : '次の問題');
      }
      return;
    }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && elapsed < 320) {
      if (revealed) {
        speakEnglish();
      } else {
        revealed = true;
        render();
        speakEnglish();
      }
    }
  });
  els.studyPanel.addEventListener('pointercancel', () => {
    startAt = 0;
    dragging = false;
    els.questionCard.classList.remove('dragging');
    els.questionCard.style.transform = '';
    els.questionCard.style.opacity = '';
  });
}

function openSettings() {
  els.settingsModal.hidden = false;
}

function closeSettings() {
  els.settingsModal.hidden = true;
}

function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  els.pairEditor.value = storage.pairsToText(pairs);
  applySettingsToControls();
  loadGoogleConfigToForm();
  speechController.waitForVoices(() => populateVoices());
  bindEvents();
  showCategoryScreen();
  updateWakeLockUi();
  requestWakeLock();
}

init();
