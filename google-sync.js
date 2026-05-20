const googleSync = (() => {
  const scopes = 'https://www.googleapis.com/auth/spreadsheets';
  let tokenClient = null;
  let initialized = false;

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
    const gapi = await waitForGlobal('gapi');
    await new Promise((resolve) => gapi.load('client', resolve));
    await gapi.client.init({
      apiKey: config.apiKey,
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
    });
    const google = await waitForGlobal('google');
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: scopes,
      callback: () => {}
    });
    initialized = true;
  }

  async function ensureToken(config) {
    if (!initialized) await init(config);
    return new Promise((resolve, reject) => {
      tokenClient.callback = (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  async function loadPairs(config) {
    if (!config.sheetId) throw new Error('Spreadsheet IDを設定してください。');
    await ensureToken(config);
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: 'Sentences!A2:E'
    });
    const rows = response.result.values || [];
    return rows.map((row, index) => ({
      id: row[0] || `sheet-${index + 2}`,
      category: row[1] || '未分類',
      japanese: row[2] || '',
      english: row[3] || '',
      tags: row[4] || ''
    })).filter((pair) => pair.japanese && pair.english);
  }

  async function appendLogs(config, logs) {
    if (!config.sheetId) throw new Error('Spreadsheet IDを設定してください。');
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
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: 'Logs!A:I',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    });
  }

  return { loadPairs, appendLogs };
})();
