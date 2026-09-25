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
Stage M5-2: 編成・戦術入力の最小接続
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
- CPUクラブ名は参加クラブの後ろに押し出し式で `COM1` から詰める
- `POST /api/rooms/:roomId/run-season` はクラブチーム名の割り当てと `team-setup` フェーズ遷移を担当
- `team-setup` フェーズで自分のクラブチーム名を表示
- 自動割り当て後の全クラブチーム一覧を表示
- `team-setup` フェーズで各クラブの作業完了/未完了を表示
- 未完了クラブ名を一覧表示する
- `team-setup` フェーズでマルチ用の最小編成・戦術入力を表示
- 先発5人と戦術を選び、`POST /api/rooms/:roomId/submit` で送信する
- 送信済みの lineup / tactic をシーズン一括シミュレーションへ反映する
- 全員が作業完了したら自動で `season-ready` フェーズへ進む
- `season-ready` フェーズでは全員完了済みとして表示する
- `js/multiplayer-league.js` 追加
- ルーム内の6クラブ構成から既存の `createClub` / `createSchedule` を使ってマルチ用リーグ状態を作る土台を追加
- ホストが `season-ready` フェーズでシーズン一括シミュレーションを実行できる
- シーズン結果は `POST /api/rooms/:roomId/complete-season` でRoomに保存する
- 結果保存後、フェーズは `season-result` へ進む
- `season-result` フェーズでは共有された順位表を表示する

## 追加済みAPI案

```txt
GET  /api/health
POST /api/rooms
GET  /api/rooms/:roomId
POST /api/rooms/:roomId/join
POST /api/rooms/:roomId/submit
POST /api/rooms/:roomId/ready
POST /api/rooms/:roomId/run-season
POST /api/rooms/:roomId/complete-season
```

## フェーズ進行方針

```txt
lobby
  参加クラブが準備完了する
  全員準備完了後、ホストがゲーム開始

team-setup
  参加クラブが編成・戦術作業を行う
  自分のクラブの先発5人と戦術を選ぶ
  作業完了したクラブは完了表示
  未完了クラブは一覧表示
  全員完了したら自動で season-ready へ進む

season-ready
  全員完了済み
  ホストがシーズン一括シミュレーションを実行する

season-result
  シーズン結果を共有表示する
```

## 次にやること

### M5-3: 編成入力の強化

- 現在の編成・戦術入力はマルチ用の最小接続
- 選手カード表示を既存UIに近づける
- ポジション適性や先発5人のバリデーション表示を強化する
- ベンチが増える将来仕様に備えて選択UIを整える
- 結果画面に人間クラブごとの試合結果や個人成績を追加する

## 初期MVPの範囲

- ルーム作成
- ルーム参加
- クラブチーム名入力
- 参加順のクラブ枠割り当て
- CPUクラブ名は押し出し式で `COM1` / `COM2` / `COM3` ...
- 編成と戦術を送信
- 各フェーズの作業完了表示
- 未完了クラブの表示
- 全員完了後の自動フェーズ進行
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
