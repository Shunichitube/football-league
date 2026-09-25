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
Stage M4: 自動割り当て後の編成・戦術入力
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
- 編成・戦術送信APIの土台を追加
- 準備完了APIの土台を追加
- `js/multiplayer-ui.js` 追加
- タイトル画面に「マルチプレイ」ボタンを追加
- ルーム作成/参加時の入力名は、プレイヤー名ではなくクラブチーム名として扱う方針に変更
- 参加者カラーはサーバー側で自動割り振り
- ルーム参加のID入力欄と参加ボタンを追加
- ルーム作成後/参加後のルーム画面を追加
- ルーム状態の更新ボタンを追加
- ルーム画面に準備完了/準備完了解除ボタンを追加
- ホストのみゲーム開始ボタンを表示
- 手動のクラブ選択画面は作らず、ゲーム開始時に参加順でクラブ枠へ割り当てる方針に変更
- ゲーム開始時に、参加者が入力したクラブチーム名を担当クラブ名として反映する
- 未参加のCPUクラブ名は `COM1` / `COM2` / `COM3` ... とする
- `POST /api/rooms/:roomId/run-season` は現時点ではクラブチーム名の割り当てと `team-setup` フェーズ遷移まで実装
- `team-setup` フェーズで自分のクラブチーム名を表示
- 自動割り当て後の全クラブチーム一覧を表示
- `team-setup` フェーズでは準備完了/ゲーム開始ボタンを隠し、編成画面への接続予定ボタンを表示

## 追加済みAPI案

```txt
GET  /api/health
POST /api/rooms
GET  /api/rooms/:roomId
POST /api/rooms/:roomId/join
POST /api/rooms/:roomId/submit
POST /api/rooms/:roomId/ready
POST /api/rooms/:roomId/run-season
```

## 次にやること

### M4-2: 編成・戦術入力の最小接続

- `team-setup` フェーズから編成・戦術入力へ進む
- 既存シングルプレイの編成UIを壊さず、マルチ用に最小接続する
- 自分のクラブチームだけ編集できるようにする
- 入力完了後に `POST /api/rooms/:roomId/submit` へ送る
- 全員送信済みになったらホストがシーズン一括実行できる流れを作る

## 初期MVPの範囲

- ルーム作成
- ルーム参加
- クラブチーム名入力
- 参加順のクラブ枠割り当て
- CPUクラブ名は `COM1` / `COM2` / `COM3` ...
- 編成と戦術を送信
- 準備完了
- ホストがシーズン一括実行
- 結果共有

## 初期MVPではやらないこと

- 手動クラブ選択
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

今回追加したWorkerとフロント画面はまだ実行確認前。Cloudflare上での `wrangler dev` / デプロイ確認は別途必要。
