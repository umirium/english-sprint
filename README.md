# 瞬間英作文アプリ

既存の `english_tts_listener_pwa` をベースにした、Web/PWA形式の瞬間英作文トレーニングアプリです。

## できること

- 日本語と英語のペアで瞬間英作文
- 日本語/英語を別々の音声モデルで読み上げ
- 日本語/英語を別々の速度で再生
- 手動学習と自動再生
- シャッフル、ループ
- Screen Wake Lock APIによる画面スリープ防止
- 学習時間と問題数をlocalStorageへ保存
- Google Sheetsから例文読込、学習ログ追記

## 例文シート形式

`Sentences` シートを作り、2行目以降を以下の形式にしてください。

| A:id | B:category | C:japanese | D:english | E:tags |
|---|---|---|---|---|

## ログシート形式

`Logs` シートへ以下の列で追記します。

| A:createdAt | B:durationSec | C:itemCount | D:mode | E:category | F:jaVoice | G:enVoice | H:jaRate | I:enRate |
|---|---|---|---|---|---|---|---|---|

## Google Sheets連携

### 1. Google Sheetsを作る

1. Google Sheetsを1つ作成します。
2. その中に `Sentences` と `Logs` の2シートを作成します。
3. `Sentences` の1行目に以下のヘッダーを入れます。

| id | category | japanese | english | tags |
|---|---|---|---|---|

4. `Sentences` の2行目以降に例文を追加します。

| id | category | japanese | english | tags |
|---|---|---|---|---|
| basic-001 | 基本文型 | 私は毎朝コーヒーを飲みます。 | I drink coffee every morning. | daily |
| question-001 | 疑問文 | あなたは昨日誰に会いましたか？ | Who did you meet yesterday? | question |

5. `Logs` の1行目に以下のヘッダーを入れます。

| createdAt | durationSec | itemCount | mode | category | jaVoice | enVoice | jaRate | enRate |
|---|---|---|---|---|---|---|---|---|

### 2. Spreadsheet IDを控える

Google SheetsのURLは通常、次の形です。

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

`/d/` と `/edit` の間にある文字列が `Spreadsheet ID` です。

### 3. Google Cloud側を準備する

1. Google Cloudでプロジェクトを作成または選択します。
2. そのプロジェクトで Google Sheets API を有効化します。
3. OAuth 2.0 Client ID を作成します。
   - 種類は `Web application`
   - `Authorized JavaScript origins` に、アプリを開くURLを追加します
   - ローカル確認なら、実際に使うURLに合わせて `http://localhost:8000` などを追加します
4. API Key を作成します。
5. 作成した `OAuth Client ID` と `API Key` を控えます。

このアプリはブラウザからGoogle APIを呼ぶため、OAuth同意画面の設定やテストユーザー登録が必要になる場合があります。

### 4. アプリへ設定する

1. アプリ右上の歯車を開きます。
2. `Google Sheets` 欄へ以下を入力します。
   - `Spreadsheet ID`
   - `OAuth Client ID`
   - `API Key`
3. `保存` を押します。
4. `例文読込` を押すと、`Sentences!A2:E` から例文を読み込みます。
5. `ログ保存` を押すと、学習ログを `Logs!A:I` に追記します。

初回接続時はGoogleの認可画面が開きます。利用するGoogleアカウントで許可してください。

### 5. 注意点

- `category` が同じ行は、アプリ上で同じカテゴリにまとめられます。
- `id` は各問題で重複しない値にしてください。
- 例文の読み込み対象は `Sentences` シート、ログの保存先は `Logs` シートで固定です。
- OAuthの `Authorized JavaScript origins` には、実際にアプリを開くオリジンを完全一致で登録してください。
- API Key は可能であれば利用元やAPIを制限してください。

## 起動

静的ファイルだけで動きます。ローカル確認は以下でできます。

```sh
python3 -m http.server 8000
```

## GitHub Pages公開

`.github/workflows/pages.yml` でGitHub Pagesへ静的ファイルをデプロイします。

`main` ブランチへpushすると、GitHub Actionsがリポジトリ直下のファイルをPagesへ公開します。リポジトリ名を `english-sprint`、GitHubユーザー名を `umirium` にした場合、公開URLは以下になります。

```text
https://umirium.github.io/english-sprint/
```

Google Sheets連携をPages上で使う場合は、Google CloudのOAuth設定で `Authorized JavaScript origins` に以下を追加してください。

```text
https://umirium.github.io
```

## 画面スリープ防止

設定画面の `スリープ防止` をONにすると、Screen Wake Lock APIで画面の自動スリープを抑制します。

注意点:

- HTTPS配信、または `localhost` での実行が必要です。
- iOSのバージョン、低電力モード、バッテリー状態、端末設定によって取得に失敗したり、途中で解除されたりする場合があります。
- アプリが再表示されたときは自動でWake Lockの再取得を試みます。
- 非対応環境では設定画面に未対応メッセージを表示します。
