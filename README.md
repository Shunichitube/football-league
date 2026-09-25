# FOOTBALL LEAGUE

5人制・計算型リーグ運営ゲームです。選手をフィールド上で操作せず、獲得・育成・編成・戦術・世代交代を通して10シーズンのクラブ運営を楽しむブラウザゲームとして開発します。

## 現在の実装

6クラブ・10シーズン制のリーグ運営、シーズン一括シミュレーション、ドラフト、競売、契約、育成、覚醒、特殊能力、セーブ／ロードを段階実装中です。

試合エンジンは `docs/MATCH_ENGINE_SPEC_v1.md` を基準にしつつ、GK特殊能力については `docs/GK_SPECIAL_ABILITY_SPEC_v2.md` を優先します。

## 起動

ビルド不要の静的サイトです。`index.html` をブラウザで開くか、静的HTTPサーバーで配信してください。

```bash
npm test
```

## ドキュメント

- `docs/GAME_SPEC.md` — ゲームルール・計算仕様の基礎仕様
- `docs/UI_SPEC.md` — UI/UX仕様
- `docs/INTEGRATED_ADDITIONAL_SPEC.md` — 編成・一括進行・覚醒・特殊能力の統合追加仕様
- `docs/MATCH_ENGINE_SPEC_v1.md` — 現行試合エンジン仕様
- `docs/GK_SPECIAL_ABILITY_SPEC_v2.md` — GK特殊能力の現行優先仕様
- `docs/PROJECT_STATUS.md` — 実装済み範囲と次のStage
