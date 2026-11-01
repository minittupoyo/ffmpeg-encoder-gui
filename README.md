# ffmpeg Encoder

[ffmpeg](https://ffmpeg.org/) で動画・音声をエンコードする Windows 向けのデスクトップ GUI です。
複数ファイルをキューに入れて、プリセットを選ぶだけでまとめて変換できます。NVIDIA / Intel / AMD のハードウェアエンコードにも対応しています。

> ffmpeg 本体は同梱していません。別途インストールしてください([必要なもの](#必要なもの))。

## 主な機能

- **キューとバッチ処理** — ファイル/フォルダのドラッグ&ドロップ、フォルダ追加(配下を再帰的に検索)、同時実行(1〜4 件)、エラー時の中断/続行、「未完了のみ再実行」
- **プリセット** — H.264 / HEVC / AV1 を CPU・NVENC・QSV・AMF で、VP9、音声のみ(MP3 / M4A)。使えるハードウェアエンコーダだけを自動検出して並べます
- **詳細設定** — CRF またはビットレート、速度プリセット、解像度、fps、ピクセルフォーマット、コンテナ、音声(再エンコード/コピー/なし、チャンネル、サンプルレート)、字幕(除外/格納/焼き込み)、メタデータ除去、追加の ffmpeg 引数
- **出力** — 出力先フォルダ、出力ファイル名のテンプレート(`{name}` / `{preset}`)、同名ファイルがあるときの動作(別名/スキップ/上書き)
- **実行状況** — 進捗バー、速度・fps・ビットレート、経過/残り時間、完了後の所要時間とサイズ比、ffmpeg のログ、キャンセル
- **コマンドのプレビュー** — 実行される ffmpeg コマンドを確認・コピーできます
- **前回設定の引き継ぎ** — 設定は次回起動時に復元されます(キューは引き継ぎません)

## 必要なもの

- Windows 10 / 11(x64)
- **ffmpeg と ffprobe**(同じフォルダに置く)
  - 既定の場所は `C:\ffmpeg\ffmpeg.exe` です。別の場所に置いた場合は、設定の「出力」タブの「ffmpeg のパス」で変更できます
  - 選んだ実行ファイルは `-version` で確認してから保存されます
  - ffprobe は進捗率(総再生時間)の計算に使います
- ハードウェアエンコードを使う場合は、対応する GPU と、そのエンコーダ(`h264_nvenc` など)を含む ffmpeg のビルド

## インストール

[Releases](../../releases) から、次のどちらかをダウンロードしてください。

| ファイル | 内容 |
| --- | --- |
| `ffmpeg-encoder-<version>-setup.exe` | インストーラ(インストール先を選べます) |
| `ffmpeg-encoder-<version>-portable.exe` | インストール不要のポータブル版 |

コード署名をしていないため、初回起動時に Windows の SmartScreen が警告を出すことがあります。「詳細情報」→「実行」で起動できます。

## 使い方

1. ファイルまたはフォルダをウィンドウにドロップします(`Ctrl+O` でも追加できます)
2. 右側の「エンコード設定」でプリセットを選び、必要なら詳細設定を調整します
3. 画面下の「コマンド」タブで、実行される ffmpeg コマンドを確認できます
4. 右上の「エンコード開始」を押します。進捗はキューの各行とヘッダーに表示され、「キャンセル」でいつでも止められます

ショートカット: `Ctrl+O` ファイルを追加 / `Delete` 選択中のファイルをキューから削除

### 設定の保存場所

`%APPDATA%\ffmpeg-encoder-gui\config.json` に、ffmpeg のパスと前回の設定が保存されます。画面の「初期値に戻す」で設定を初期化できます。

## 開発

必要なもの: Node.js(動作確認は 24)

```bash
npm ci            # 依存関係のインストール
npm run dev       # 開発モードで起動
npm run typecheck # 型チェック
npm test          # ユニットテスト
npm run build     # out/ にビルド
npm run pack      # 配布用パッケージ(展開済み)を dist/ に作成
npm run dist      # インストーラとポータブル版を dist/ に作成
```

`npm run dev` が `Electron uninstall` で失敗する場合は、Electron 本体がダウンロードされていません。次のコマンドで取得してください。

```bash
node node_modules/electron/install.js
```

### 構成

```
src/
  main/       Electron のメインプロセス(ffmpeg の起動、設定ファイル、GPU 検出、ファイル展開)
  preload/    contextBridge で公開する最小限の IPC
  renderer/   React + shadcn/ui の画面
  shared/     ffmpeg 引数の組み立てなど、副作用のない純関数(ユニットテストあり)
```

- スタック: Electron + electron-vite + React + TypeScript、UI は shadcn/ui + Tailwind CSS v4
- ffmpeg は外部バイナリとして `child_process.spawn` で実行し、`-progress pipe:1` を解析して進捗を出します。総再生時間は `ffprobe` で取得します
- ffmpeg の引数は `src/shared/ffmpegArgs.ts` の純関数で組み立て、テストで固定しています
- `contextIsolation` 有効・`nodeIntegration` 無効で、renderer から使える IPC は最小限です

## リリース手順

リリースは GitHub Actions(`.github/workflows/release.yml`)が行います。

1. `package.json` の `version` を更新してコミットします
2. 同じバージョンのタグを push します

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. 型チェックとテストの後に Windows 版がビルドされ、インストーラとポータブル版が添付された GitHub Release が作られます(リリースノートはコミットから自動生成されます)

- タグと `package.json` の `version` が一致しないとワークフローは失敗します
- `v1.0.0-rc.1` のようにハイフンを含むタグは、プレリリースとして公開されます
- Actions タブからの手動実行(`workflow_dispatch`)では、ビルドだけを行い、成果物を Artifacts に保存します(Release は作りません)

## ライセンス

未設定です。
