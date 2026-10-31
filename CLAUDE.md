# ffmpeg Encoder GUI

ffmpeg で動画をエンコードする Windows 向けデスクトップ GUI ツール。

## スタック(決定済み)
- Electron + electron-vite + React + TypeScript
- ffmpeg は外部バイナリを `child_process.spawn` で実行(既定: `C:\ffmpeg\ffmpeg.exe`、設定で変更可)
- 進捗は `-progress pipe:1` をパースし、`ffprobe` で取得した総時間から % を算出

## 初期スコープ
1. 入力ファイルのドラッグ&ドロップ / 選択(複数可、キュー)
2. プリセット(H.264 / H.265 / AV1 / VP9、音声のみ抽出など)と詳細設定(CRF、解像度、fps、音声ビットレート、コンテナ)
3. 出力先指定、実行ログ表示、進捗バー、キャンセル
4. ffmpeg コマンドのプレビュー(実行前に確認・コピー可能)

## 方針
- ffmpeg 引数の組み立ては純関数として分離し、ユニットテストを書く
- main / preload / renderer を分離し、`contextIsolation` 有効、IPC は最小限
