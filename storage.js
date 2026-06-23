const storage = (() => {
  const keys = {
    pairs: 'english_sprint_pairs',
    settings: 'english_sprint_settings',
    logs: 'english_sprint_logs',
    google: 'english_sprint_google_config'
  };

  const samplePairs = [
    { id: 'sample-1', mainCategory: '基本文型', subCategory: '現在形', japanese: '私は毎朝コーヒーを飲みます。', english: 'I drink coffee every morning.', tags: 'daily', comment: 'every morning は「毎朝」。一般的な習慣を現在形で表します。' },
    { id: 'sample-2', mainCategory: '基本文型', subCategory: '過去形', japanese: '彼女は昨日その本を読み終えました。', english: 'She finished reading the book yesterday.', tags: 'past', comment: 'finish -ing で「〜し終える」。' },
    { id: 'sample-3', mainCategory: '基本文型', subCategory: '進行形', japanese: '彼は今キッチンで夕食を作っています。', english: 'He is cooking dinner in the kitchen now.', tags: 'progressive', comment: 'be動詞 + -ing で「今している最中」。' },
    { id: 'sample-4', mainCategory: '基本文型', subCategory: '過去形', japanese: '私は先週新しい靴を買いました。', english: 'I bought new shoes last week.', tags: 'past', comment: 'buy の過去形は bought。' },
    { id: 'sample-5', mainCategory: '基本文型', subCategory: '頻度表現', japanese: '私たちは日曜日によく公園へ行きます。', english: 'We often go to the park on Sundays.', tags: 'frequency', comment: 'on Sundays は「毎週日曜に」の意味にもなります。' },
    { id: 'sample-6', mainCategory: '疑問文', subCategory: 'How long', japanese: '駅まで歩くのにどのくらいかかりますか？', english: 'How long does it take to walk to the station?', tags: 'question', comment: 'How long does it take to ...? は所要時間を聞く定番表現。' },
    { id: 'sample-7', mainCategory: '疑問文', subCategory: 'Who', japanese: 'あなたは昨日誰に会いましたか？', english: 'Who did you meet yesterday?', tags: 'question', comment: '目的語の「誰」を聞くので Who did you meet ...? になります。' },
    { id: 'sample-8', mainCategory: '疑問文', subCategory: 'There is', japanese: 'この近くに郵便局はありますか？', english: 'Is there a post office near here?', tags: 'question', comment: 'Is there ...? は「〜はありますか」。' },
    { id: 'sample-9', mainCategory: '接続詞', subCategory: 'if', japanese: 'もし時間があれば、あとで電話します。', english: 'If I have time, I will call you later.', tags: 'if', comment: '条件を表す if 節では未来のことでも現在形を使います。' },
    { id: 'sample-10', mainCategory: '接続詞', subCategory: 'because', japanese: '雨が降っていたので、私は家にいました。', english: 'Because it was raining, I stayed home.', tags: 'because', comment: 'because は理由をはっきり述べる接続詞。' },
    { id: 'sample-11', mainCategory: '接続詞', subCategory: 'when', japanese: '彼女が到着したら、教えてください。', english: 'Please tell me when she arrives.', tags: 'when', comment: 'when 節も未来の内容を現在形で表すことがあります。' },
    { id: 'sample-12', mainCategory: '助動詞', subCategory: 'be able to', japanese: '私は英語をもっと自然に話せるようになりたいです。', english: 'I want to be able to speak English more naturally.', tags: 'goal', comment: 'be able to は「〜できる」。want to と組み合わせやすい形です。' },
    { id: 'sample-13', mainCategory: '助動詞', subCategory: '許可', japanese: '窓を開けてもいいですか？', english: 'May I open the window?', tags: 'permission', comment: 'May I ...? は丁寧に許可を求める表現。' },
    { id: 'sample-14', mainCategory: '助動詞', subCategory: 'should', japanese: 'あなたはもっと早く寝るべきです。', english: 'You should go to bed earlier.', tags: 'advice', comment: 'should は軽い助言や提案に使います。' },
    { id: 'sample-15', mainCategory: '比較', subCategory: '比較級', japanese: 'この本はあの本より簡単です。', english: 'This book is easier than that one.', tags: 'comparative', comment: 'easy の比較級は easier。than で比較対象を置きます。' },
    { id: 'sample-16', mainCategory: '比較', subCategory: '最上級', japanese: '彼はクラスで一番背が高いです。', english: 'He is the tallest in his class.', tags: 'superlative', comment: 'the + 最上級で「最も〜」。' }
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
    return source.map(normalizePair);
  }

  function normalizePair(pair) {
    const mainCategory = String(pair.mainCategory || pair.category || pair.tags || '未分類').trim() || '未分類';
    const subCategory = String(pair.subCategory || '標準').trim() || '標準';
    return {
      ...pair,
      mainCategory,
      subCategory,
      category: `${mainCategory} / ${subCategory}`,
      japanese: String(pair.japanese || '').trim(),
      english: String(pair.english || '').trim(),
      tags: String(pair.tags || '').trim(),
      comment: String(pair.comment || '').trim()
    };
  }

  function savePairs(pairs) {
    writeJson(keys.pairs, pairs.map((pair) => {
      const normalized = normalizePair(pair);
      return {
        id: normalized.id || createId(),
        mainCategory: normalized.mainCategory,
        subCategory: normalized.subCategory,
        category: normalized.category,
        japanese: normalized.japanese,
        english: normalized.english,
        tags: normalized.tags,
        comment: normalized.comment
      };
    }).filter((pair) => pair.japanese && pair.english));
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
    const savedLog = { id: createId(), createdAt: new Date().toISOString(), ...log };
    logs.unshift(savedLog);
    writeJson(keys.logs, logs.slice(0, 500));
    return savedLog;
  }

  function getGoogleConfig() {
    return readJson(keys.google, { sheetId: '', clientId: '', apiKey: '' });
  }

  function extractSpreadsheetId(value) {
    const text = String(value || '').trim();
    const match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : text;
  }

  function saveGoogleConfig(config) {
    const next = {
      sheetId: extractSpreadsheetId(config.sheetId),
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
      if (parts.length >= 6) {
        return {
          id: createId(),
          mainCategory: parts[0].trim(),
          subCategory: parts[1].trim(),
          japanese: parts[2].trim(),
          english: parts[3].trim(),
          tags: (parts[4] || '').trim(),
          comment: (parts[5] || '').trim()
        };
      }
      if (parts.length >= 3) {
        return {
          id: createId(),
          mainCategory: parts[0].trim(),
          subCategory: '標準',
          japanese: parts[1].trim(),
          english: parts[2].trim(),
          tags: (parts[3] || '').trim(),
          comment: (parts[4] || '').trim()
        };
      }
      return {
        id: createId(),
        mainCategory: '未分類',
        subCategory: '標準',
        japanese: parts[0].trim(),
        english: parts[1].trim(),
        tags: '',
        comment: ''
      };
    }).filter((pair) => pair && pair.japanese && pair.english);
  }

  function pairsToText(pairs) {
    return pairs.map((pair) => {
      const normalized = normalizePair(pair);
      return [
        normalized.mainCategory,
        normalized.subCategory,
        normalized.japanese,
        normalized.english,
        normalized.tags,
        normalized.comment
      ].join('\t');
    }).join('\n');
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
