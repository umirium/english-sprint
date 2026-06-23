const els = {
  categoryScreen: document.getElementById('categoryScreen'),
  categoryList: document.getElementById('categoryList'),
  studyPanel: document.getElementById('studyPanel'),
  bottomBar: document.getElementById('bottomBar'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsBackdrop: document.getElementById('settingsBackdrop'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  logPanel: document.getElementById('logPanel'),
  closeLogBtn: document.getElementById('closeLogBtn'),
  settingsTabs: Array.from(document.querySelectorAll('.settings-tabs [role="tab"]')),
  settingsPanels: Array.from(document.querySelectorAll('.settings-tab-panels [role="tabpanel"]')),
  categoryBackBtn: document.getElementById('categoryBackBtn'),
  categoryTitle: document.getElementById('categoryTitle'),
  categoryDescription: document.getElementById('categoryDescription'),
  appHomeBtn: document.getElementById('appHomeBtn'),
  positionLabel: document.getElementById('positionLabel'),
  questionCard: document.getElementById('questionCard'),
  cardText: document.getElementById('cardText'),
  commentText: document.getElementById('commentText'),
  autoModeBtn: document.getElementById('autoModeBtn'),
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
  googleStatus: document.getElementById('googleStatus')
};

let pairs = storage.getPairs();
let settings = storage.getSettings();
let activeMainCategory = '';
let activeSubCategory = '';
let order = [];
let index = 0;
let revealed = false;
let isAutoPlaying = false;
let isTransitioning = false;
let wakeLock = null;
let timer = null;
let sessionStartedAt = Date.now();
let studiedIds = new Set();

function normalizeCategory(category, fallback = '未分類') {
  return String(category || fallback).trim() || fallback;
}

function activeCategoryLabel() {
  return activeMainCategory && activeSubCategory ? `${activeMainCategory} / ${activeSubCategory}` : '';
}

function hasActiveLesson() {
  return Boolean(activeMainCategory && activeSubCategory);
}

function activePairs() {
  if (!activeMainCategory || !activeSubCategory) return [];
  return pairs.filter((pair) =>
    normalizeCategory(pair.mainCategory) === activeMainCategory &&
    normalizeCategory(pair.subCategory, '標準') === activeSubCategory
  );
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
  els.categoryList.innerHTML = '';
  els.categoryBackBtn.hidden = !activeMainCategory || Boolean(activeSubCategory);
  els.appHomeBtn.disabled = !activeMainCategory;

  if (!activeMainCategory) {
    els.categoryTitle.textContent = 'メインカテゴリ';
    els.categoryDescription.textContent = '学習するメインカテゴリを選択';
    renderCategoryButtons(groupByMainCategory(), (mainCategory) => {
      activeMainCategory = mainCategory;
      activeSubCategory = '';
      renderCategories();
    });
    return;
  }

  els.categoryTitle.textContent = activeMainCategory;
  els.categoryDescription.textContent = 'サブカテゴリを選択';
  renderCategoryButtons(groupBySubCategory(activeMainCategory), (subCategory) => {
    startCategory(activeMainCategory, subCategory);
  });
}

function groupByMainCategory() {
  const categories = new Map();
  pairs.forEach((pair) => {
    const mainCategory = normalizeCategory(pair.mainCategory);
    categories.set(mainCategory, (categories.get(mainCategory) || 0) + 1);
  });
  return categories;
}

function groupBySubCategory(mainCategory) {
  const categories = new Map();
  pairs.filter((pair) => normalizeCategory(pair.mainCategory) === mainCategory).forEach((pair) => {
    const subCategory = normalizeCategory(pair.subCategory, '標準');
    categories.set(subCategory, (categories.get(subCategory) || 0) + 1);
  });
  return categories;
}

function renderCategoryButtons(categories, onSelect) {
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
    button.addEventListener('click', () => onSelect(category));
    els.categoryList.appendChild(button);
  });
}

function setHint(message) {
}

function showCategoryScreen() {
  activeMainCategory = '';
  activeSubCategory = '';
  stopAll();
  renderCategories();
  els.categoryScreen.hidden = false;
  els.studyPanel.hidden = true;
  els.bottomBar.hidden = true;
}

function showSubCategoryScreen() {
  activeSubCategory = '';
  stopAll();
  renderCategories();
  els.categoryScreen.hidden = false;
  els.studyPanel.hidden = true;
  els.bottomBar.hidden = true;
}

function startCategory(mainCategory, subCategory) {
  activeMainCategory = normalizeCategory(mainCategory);
  activeSubCategory = normalizeCategory(subCategory, '標準');
  revealed = false;
  rebuildOrder();
  els.appHomeBtn.disabled = false;
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

  els.cardText.textContent = revealed ? pair.english : pair.japanese;
  els.commentText.textContent = pair.comment || '';
  els.commentText.hidden = !revealed || !pair.comment;
  els.questionCard.classList.toggle('answer', revealed);
  els.positionLabel.textContent = `${index + 1} / ${activePairs().length}`;
  els.autoModeBtn.setAttribute('aria-pressed', String(settings.autoPlayback));
  els.autoModeBtn.textContent = isAutoPlaying ? '■A' : '▶︎A';
  els.shuffleBtn.setAttribute('aria-pressed', String(settings.shuffle));
  els.repeatBtn.setAttribute('aria-pressed', String(settings.repeat));
  updateWakeLockUi();
}

async function saveSessionLog() {
  const durationSec = Math.max(1, Math.floor((Date.now() - sessionStartedAt) / 1000));
  if (!studiedIds.size && durationSec < 10) return;
  const log = storage.addLog({
    durationSec,
    itemCount: studiedIds.size,
    mode: isAutoPlaying ? 'auto' : 'manual',
    category: activeCategoryLabel(),
    mainCategory: activeMainCategory,
    subCategory: activeSubCategory,
    jaVoice: settings.jaVoice,
    enVoice: settings.enVoice,
    jaRate: settings.jaRate,
    enRate: settings.enRate
  });
  syncLogToGoogle(log);
  sessionStartedAt = Date.now();
  studiedIds = new Set();
  if (activeMainCategory && activeSubCategory) render();
}

async function syncLogToGoogle(log) {
  const config = storage.getGoogleConfig();
  if (!config.sheetId || !config.clientId || !config.apiKey) return;
  if (!googleSync.isAuthorized()) return;
  try {
    await googleSync.appendLogs(config, [log], { interactive: false });
    els.googleStatus.textContent = '学習ログを自動保存しました';
  } catch (error) {
    els.googleStatus.textContent = error.message || 'ログ自動保存に失敗しました';
  }
}

function markStudied() {
  const pair = currentPair();
  if (pair) studiedIds.add(pair.id);
  if (activeMainCategory && activeSubCategory) render();
}

function stopAll() {
  isAutoPlaying = false;
  window.clearTimeout(timer);
  speechController.stop();
  if (activeMainCategory && activeSubCategory) render();
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
  if (!hasActiveLesson() || !settings.autoPlayback || isAutoPlaying) return;
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
  if (!hasActiveLesson()) return;
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
  if (!hasActiveLesson()) return;
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
  if (!hasActiveLesson()) return;
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
  if (!hasActiveLesson() || isTransitioning) return;
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
  if (hasActiveLesson()) render();
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

function describeError(error) {
  if (!error) return '不明なエラー';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function bindEvents() {
  els.openSettingsBtn.addEventListener('click', openSettings);
  els.closeSettingsBtn.addEventListener('click', closeSettings);
  els.settingsBackdrop.addEventListener('click', closeSettings);
  els.closeLogBtn.addEventListener('click', closeLogModal);
  els.settingsTabs.forEach((tab) => {
    tab.addEventListener('click', () => selectSettingsTab(tab.dataset.tab));
  });
  els.categoryBackBtn.addEventListener('click', () => {
    showCategoryScreen();
  });
  els.appHomeBtn.addEventListener('click', () => {
    if (els.appHomeBtn.disabled) return;
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
  els.shuffleBtn.addEventListener('click', () => {
    setSetting({ shuffle: !settings.shuffle });
    if (hasActiveLesson()) rebuildOrder(true);
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
      window.alert('メインカテゴリ[TAB]サブカテゴリ[TAB]日本語[TAB]English の形式で入力してください');
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
    els.logOutput.textContent = JSON.stringify(storage.getLogs(), null, 2);
    openLogModal();
  });
  els.saveGoogleConfigBtn.addEventListener('click', () => {
    const savedConfig = storage.saveGoogleConfig({
      sheetId: els.sheetIdInput.value,
      clientId: els.clientIdInput.value,
      apiKey: els.apiKeyInput.value
    });
    els.sheetIdInput.value = savedConfig.sheetId;
    els.clientIdInput.value = savedConfig.clientId;
    els.apiKeyInput.value = savedConfig.apiKey;
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
      console.error('Google Sheets load failed:', error);
      els.googleStatus.textContent = describeError(error);
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

function openLogModal() {
  els.logPanel.hidden = false;
}

function closeLogModal() {
  els.logPanel.hidden = true;
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
