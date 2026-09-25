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
Stage M1: 設計と土台
```

## 完了済み

- `stable/single-player-v1` 作成
- `dev/multiplayer-v1` 作成
- `docs/MULTIPLAYER_SPEC_v0.1.md` 追加
- マルチプレイ初期方針を非同期ターン制に決定
- Cloudflare Pages / Workers / Durable Objects 構成を採用予定
- 初期マルチではイベントログ共有を行わない方針に決定

## 次にやること

### M2: ルームAPI土台

- Cloudflare Workers用のディレクトリ構成を追加
- Durable Objectのルームクラスを追加
- ルーム作成APIを追加
- ルーム状態取得APIを追加
- ローカル開発用の最小設定を追加

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
