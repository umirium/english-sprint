const storage = (() => {
  const keys = {
    pairs: 'english_sprint_pairs',
    settings: 'english_sprint_settings',
    logs: 'english_sprint_logs',
    google: 'english_sprint_google_config'
  };

  const samplePairs = [
    { id: 'sample-1', category: '基本文型', japanese: '私は毎朝コーヒーを飲みます。', english: 'I drink coffee every morning.', tags: 'daily' },
    { id: 'sample-2', category: '基本文型', japanese: '彼女は昨日その本を読み終えました。', english: 'She finished reading the book yesterday.', tags: 'past' },
    { id: 'sample-3', category: '基本文型', japanese: '彼は今キッチンで夕食を作っています。', english: 'He is cooking dinner in the kitchen now.', tags: 'progressive' },
    { id: 'sample-4', category: '基本文型', japanese: '私は先週新しい靴を買いました。', english: 'I bought new shoes last week.', tags: 'past' },
    { id: 'sample-5', category: '基本文型', japanese: '私たちは日曜日によく公園へ行きます。', english: 'We often go to the park on Sundays.', tags: 'frequency' },
    { id: 'sample-6', category: '疑問文', japanese: '駅まで歩くのにどのくらいかかりますか？', english: 'How long does it take to walk to the station?', tags: 'question' },
    { id: 'sample-7', category: '疑問文', japanese: 'あなたは昨日誰に会いましたか？', english: 'Who did you meet yesterday?', tags: 'question' },
    { id: 'sample-8', category: '疑問文', japanese: 'この近くに郵便局はありますか？', english: 'Is there a post office near here?', tags: 'question' },
    { id: 'sample-9', category: '接続詞', japanese: 'もし時間があれば、あとで電話します。', english: 'If I have time, I will call you later.', tags: 'if' },
    { id: 'sample-10', category: '接続詞', japanese: '雨が降っていたので、私は家にいました。', english: 'Because it was raining, I stayed home.', tags: 'because' },
    { id: 'sample-11', category: '接続詞', japanese: '彼女が到着したら、教えてください。', english: 'Please tell me when she arrives.', tags: 'when' },
    { id: 'sample-12', category: '助動詞', japanese: '私は英語をもっと自然に話せるようになりたいです。', english: 'I want to be able to speak English more naturally.', tags: 'goal' },
    { id: 'sample-13', category: '助動詞', japanese: '窓を開けてもいいですか？', english: 'May I open the window?', tags: 'permission' },
    { id: 'sample-14', category: '助動詞', japanese: 'あなたはもっと早く寝るべきです。', english: 'You should go to bed earlier.', tags: 'advice' },
    { id: 'sample-15', category: '比較', japanese: 'この本はあの本より簡単です。', english: 'This book is easier than that one.', tags: 'comparative' },
    { id: 'sample-16', category: '比較', japanese: '彼はクラスで一番背が高いです。', english: 'He is the tallest in his class.', tags: 'superlative' }
  ];

  const defaultSettings = {
    autoPlayback: false,
    keepAwake: false,
    shuffle: false,
    repeat: true,
    jaVoice: '',
    enVoice: '',
    jaRate: 1.0,
    enRate: 1.0,
    baseWaitMs: 1400,
    perJapaneseCharMs: 90,
    perEnglishWordMs: 420
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function getPairs() {
    const pairs = readJson(keys.pairs, null);
    const source = Array.isArray(pairs) && pairs.length ? pairs : samplePairs;
    return source.map((pair) => ({
      ...pair,
      category: String(pair.category || pair.tags || '未分類').trim() || '未分類'
    }));
  }

  function savePairs(pairs) {
    writeJson(keys.pairs, pairs.map((pair) => ({
      id: pair.id || createId(),
      category: String(pair.category || pair.tags || '未分類').trim(),
      japanese: String(pair.japanese || '').trim(),
      english: String(pair.english || '').trim(),
      tags: String(pair.tags || '').trim()
    })).filter((pair) => pair.japanese && pair.english));
  }

  function resetPairs() {
    localStorage.removeItem(keys.pairs);
    return getPairs();
  }

  function getSettings() {
    return { ...defaultSettings, ...readJson(keys.settings, {}) };
  }

  function saveSettings(nextSettings) {
    const merged = { ...getSettings(), ...nextSettings };
    writeJson(keys.settings, merged);
    return merged;
  }

  function getLogs() {
    return readJson(keys.logs, []);
  }

  function addLog(log) {
    const logs = getLogs();
    logs.unshift({ id: createId(), createdAt: new Date().toISOString(), ...log });
    writeJson(keys.logs, logs.slice(0, 500));
  }

  function getGoogleConfig() {
    return readJson(keys.google, { sheetId: '', clientId: '', apiKey: '' });
  }

  function saveGoogleConfig(config) {
    const next = {
      sheetId: String(config.sheetId || '').trim(),
      clientId: String(config.clientId || '').trim(),
      apiKey: String(config.apiKey || '').trim()
    };
    writeJson(keys.google, next);
    return next;
  }

  function parsePairsText(text) {
    return String(text || '').split(/\n+/).map((line) => {
      const parts = line.split('\t');
      if (parts.length < 2) return null;
      const hasCategory = parts.length >= 3;
      return {
        id: createId(),
        category: hasCategory ? parts[0].trim() : '未分類',
        japanese: hasCategory ? parts[1].trim() : parts[0].trim(),
        english: hasCategory ? parts[2].trim() : parts[1].trim(),
        tags: (parts[3] || '').trim()
      };
    }).filter((pair) => pair && pair.japanese && pair.english);
  }

  function pairsToText(pairs) {
    return pairs.map((pair) => [pair.category || '未分類', pair.japanese, pair.english, pair.tags || ''].join('\t')).join('\n');
  }

  return {
    samplePairs,
    getPairs,
    savePairs,
    resetPairs,
    getSettings,
    saveSettings,
    getLogs,
    addLog,
    getGoogleConfig,
    saveGoogleConfig,
    parsePairsText,
    pairsToText
  };
})();
