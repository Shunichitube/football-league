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
Stage M3: フロント側の最小マルチ画面
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
- 名前入力のみでルーム作成/参加できる方針に変更
- 参加者カラーはサーバー側で自動割り振り
- ルーム参加のID入力欄と参加ボタンを追加
- ルーム作成後/参加後のルーム画面を追加
- ルーム状態の更新ボタンを追加
- ルーム画面に準備完了/準備完了解除ボタンを追加
- ホストのみゲーム開始ボタンを表示
- クラブ選択画面は作らず、ゲーム開始時に参加順でクラブを自動割り当てる方針に変更
- `POST /api/rooms/:roomId/run-season` は現時点ではクラブ自動割り当てと `team-setup` フェーズ遷移まで実装

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

### M4: 自動割り当て後の編成・戦術入力

- `team-setup` フェーズの表示を整える
- 自分に割り当てられたクラブを見やすく表示する
- 編成・戦術の入力画面につなぐ
- 既存シングルプレイの編成UIを壊さず、マルチ用に最小接続する
- `POST /api/rooms/:roomId/submit` と接続する

## 初期MVPの範囲

- ルーム作成
- ルーム参加
- 名前入力
- 自動クラブ割り当て
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
