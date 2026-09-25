# FOOTBALL LEAGUE マルチプレイ実装ステータス

## 現在の作業ブランチ

```txt
dev/multiplayer-v1
```

## 保護ブランチ

```txt
stable/single-player-v1
```

現行シングルプレイ完成版は、このブランチから復旧できる前提とする。

## 現在位置

```txt
Stage M2: ルームAPI土台
```

## 完了済み

- `stable/single-player-v1` 作成
- `dev/multiplayer-v1` 作成
- `docs/MULTIPLAYER_SPEC_v0.1.md` 追加
- マルチプレイ初期方針を非同期ターン制に決定
- Cloudflare Pages / Workers / Durable Objects 構成を採用予定
- 初期マルチではイベントログ共有を行わない方針に決定
- `wrangler.toml` 追加
- `worker/index.js` 追加
- `worker/room.js` 追加
- ルーム作成APIの土台を追加
- ルーム状態取得APIの土台を追加
- ルーム参加APIの土台を追加
- クラブ選択APIの土台を追加
- 編成・戦術送信APIの土台を追加
- 準備完了APIの土台を追加
- シーズン実行APIはM5予定として501応答に留めた

## 追加済みAPI案

```txt
GET  /api/health
POST /api/rooms
GET  /api/rooms/:roomId
POST /api/rooms/:roomId/join
POST /api/rooms/:roomId/select-club
POST /api/rooms/:roomId/submit
POST /api/rooms/:roomId/ready
POST /api/rooms/:roomId/run-season
```

## 次にやること

### M3: フロント側の最小マルチ画面

- タイトル画面にマルチプレイ導線を追加するか検討
- ルーム作成画面を追加
- ルーム参加画面を追加
- ルーム状態表示を追加
- クラブ選択UIを追加
- 現行シングルプレイ導線を壊さない

## 初期MVPの範囲

- ルーム作成
- ルーム参加
- クラブ選択
- 編成と戦術を送信
- 準備完了
- ホストがシーズン一括実行
- 結果共有

## 初期MVPではやらないこと

- ドラフトのマルチ化
- オークションのマルチ化
- 育成のマルチ化
- 契約更新のマルチ化
- 放出のマルチ化
- 試合イベントログ共有
- D1保存
- WebSocket同期

## 注意

マルチプレイ化では、既存の `app.js` をいきなり大改修しない。

まずはサーバー側のルーム状態とAPIを別軸で作り、既存シングルプレイの計算ロジックを壊さず利用できる形を探る。

今回追加したWorkerはまだ実行確認前。Cloudflare上での `wrangler dev` / デプロイ確認は別途必要。
