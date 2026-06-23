const googleSync = (() => {
  const scopes = 'https://www.googleapis.com/auth/spreadsheets';
  let tokenClient = null;
  let initialized = false;
  let hasAccessToken = false;

  function waitForGlobal(name, timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window[name]) {
          clearInterval(timer);
          resolve(window[name]);
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error(`${name} is not loaded.`));
        }
      }, 100);
    });
  }

  async function init(config) {
    if (!config.apiKey || !config.clientId) {
      throw new Error('API KeyとOAuth Client IDを設定してください。');
    }
    let gapi;
    let google;
    try {
      gapi = await waitForGlobal('gapi');
      google = await waitForGlobal('google');
    } catch (error) {
      throw new Error(`Googleライブラリの読み込みに失敗: ${formatGoogleError(error) || describeUnknownError(error)}`);
    }
    try {
      await new Promise((resolve) => gapi.load('client', resolve));
      await gapi.client.init({
        apiKey: config.apiKey,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
      });
    } catch (error) {
      throw new Error(`Google API初期化に失敗: ${formatGoogleError(error) || describeUnknownError(error)}`);
    }
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: scopes,
        callback: () => {},
        error_callback: () => {}
      });
    } catch (error) {
      throw new Error(`OAuth Client IDの初期化に失敗: ${formatGoogleError(error) || describeUnknownError(error)}`);
    }
    initialized = true;
  }

  async function ensureToken(config) {
    if (!initialized) await init(config);
    return new Promise((resolve, reject) => {
      tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
        } else {
          hasAccessToken = true;
          resolve(response);
        }
      };
      tokenClient.error_callback = (error) => {
        reject(new Error(`Google認証に失敗: ${formatGoogleError(error) || describeUnknownError(error)}`));
      };
      try {
        tokenClient.requestAccessToken({ prompt: hasAccessToken ? '' : 'consent' });
      } catch (error) {
        reject(new Error(`Google認証画面を開けませんでした: ${formatGoogleError(error) || describeUnknownError(error)}`));
      }
    });
  }

  function isAuthorized() {
    return hasAccessToken;
  }

  function formatGoogleError(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error.result && error.result.error) {
      const detail = error.result.error;
      return detail.message || detail.status || detail.code || '';
    }
    if (error.error_description) return error.error_description;
    if (error.message) return error.message;
    if (error.type) return error.type;
    return describeUnknownError(error);
  }

  function describeUnknownError(error) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  function extractSpreadsheetId(value) {
    const text = String(value || '').trim();
    const match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : text;
  }

  function normalizeConfig(config) {
    return {
      sheetId: extractSpreadsheetId(config.sheetId),
      clientId: String(config.clientId || '').trim(),
      apiKey: String(config.apiKey || '').trim()
    };
  }

  function validateConfig(config) {
    if (!config.sheetId) throw new Error('Spreadsheet IDを設定してください。');
    if (!config.clientId) throw new Error('OAuth Client IDを設定してください。');
    if (!config.apiKey) throw new Error('API Keyを設定してください。');
  }

  function withOriginHint(message) {
    return `${message} / 現在のURL origin: ${window.location.origin}`;
  }

  function describeSheetReadError(error) {
    const message = formatGoogleError(error) || 'Sentencesシートの読み込みに失敗しました。';
    if (/Requested entity was not found/i.test(message)) {
      return 'Spreadsheet IDが存在しない、またはログイン中のGoogleアカウントにそのシートの閲覧権限がありません。Google設定のSpreadsheet IDと共有権限を確認してください。';
    }
    if (/Unable to parse range|not found/i.test(message)) {
      return 'Sentencesシートが見つかりません。シート名が Sentences になっているか確認してください。';
    }
    return message;
  }

  async function loadPairs(config) {
    config = normalizeConfig(config);
    validateConfig(config);
    await ensureToken(config);
    let response;
    try {
      response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: 'Sentences!A2:G'
      });
    } catch (error) {
      throw new Error(withOriginHint(describeSheetReadError(error)));
    }
    const rows = response.result.values || [];
    return rows.map((row, index) => {
      if (row.length >= 7) {
        return {
          id: row[0] || `sheet-${index + 2}`,
          mainCategory: row[1] || '未分類',
          subCategory: row[2] || '標準',
          japanese: row[3] || '',
          english: row[4] || '',
          tags: row[5] || '',
          comment: row[6] || ''
        };
      }
      return {
        id: row[0] || `sheet-${index + 2}`,
        mainCategory: row[1] || '未分類',
        subCategory: '標準',
        japanese: row[2] || '',
        english: row[3] || '',
        tags: row[4] || '',
        comment: ''
      };
    }).filter((pair) => pair.japanese && pair.english);
  }

  async function appendLogs(config, logs, options = {}) {
    const interactive = options.interactive !== false;
    config = normalizeConfig(config);
    validateConfig(config);
    if (!interactive && !hasAccessToken) {
      throw new Error('Googleに未認証のため、ログの自動保存をスキップしました。');
    }
    await ensureToken(config);
    const values = logs.map((log) => [
      log.createdAt,
      log.durationSec,
      log.itemCount,
      log.mode,
      log.category || '',
      log.jaVoice,
      log.enVoice,
      log.jaRate,
      log.enRate
    ]);
    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: config.sheetId,
        range: 'Logs!A:I',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values }
      });
    } catch (error) {
      throw new Error(withOriginHint(formatGoogleError(error) || 'Logsシートへの保存に失敗しました。'));
    }
  }

  return { loadPairs, appendLogs, isAuthorized };
})();
