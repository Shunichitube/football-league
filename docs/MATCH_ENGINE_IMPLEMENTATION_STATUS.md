# Match Engine Implementation Status

最終更新: 2026-09-25

## 対象ブランチ

- 作業ブランチ: `dev/match-engine-v1`
- バックアップ: `backup/pre-match-engine-20260925-0618`
- バックアップ元commit: `a7c1137f5c605498dce9fc088b1ded7d412c313e`

## 正本仕様

- `docs/MATCH_ENGINE_SPEC_v1.md`

## 実装方針

大改修のため、mainへ直接反映せず、作業ブランチ上で段階実装する。
既存公開版を壊さないよう、mainは安定版として保持する。

## Stage A 実装状況

Stage A — 通常再開 / 守備成功後再開 / 第1→第2→シュート骨格を着手・実装。

### 実装済み

- `js/sim.js` 内の試合進行を、1フェイズ即シュート型から、第1攻撃 → 第2攻撃 → シュートの骨格へ変更
- 通常再開ではCOUNTERを出さず、PASS / DRIBBLEのみ選択
  - BALANCED: PASS 50 / DRIBBLE 50
  - POSSESSION: PASS 80 / DRIBBLE 20
  - DRIBBLE: PASS 20 / DRIBBLE 80
  - COUNTER: PASS 50 / DRIBBLE 50
- 守備成功後再開ではCOUNTERを含めて選択
  - BALANCED: PASS 45 / DRIBBLE 45 / COUNTER 10
  - POSSESSION: PASS 75 / DRIBBLE 15 / COUNTER 10
  - DRIBBLE: PASS 15 / DRIBBLE 75 / COUNTER 10
  - COUNTER: PASS 35 / DRIBBLE 35 / COUNTER 30
- 第1成功後の第2派生を実装
  - PASS第1成功: PASS第2 70 / DRIBBLE第2 30
  - DRIBBLE第1成功: DRIBBLE第2 70 / PASS第2 30
  - COUNTER第1成功: COUNTER第2 100
- 第2成功時にシュートへ移行する骨格を実装
- 戦術補正を、旧倍率方式から仕様書に沿った加算方式へ変更
  - BALANCED: 該当攻撃 +2
  - POSSESSION: PASS +4
  - DRIBBLE: DRIBBLE +4
  - COUNTER: COUNTER +4 / DEFENSE +4
- 既存の出場フェイズ、疲労、自動交代、評価、選手成績記録は維持

### Stage Aでまだ実装しないもの

以下は仕様書通り後続Stageで扱う。

- PASS / DRIBBLE / COUNTER / SHORT_COUNTERの正式な役割選出重み
- 役割引き継ぎ・重複禁止の厳密処理
- SHORT_COUNTER発動判定
- こぼれ球処理
- COUNTER第2失敗デバフ
- 特能の役割制への完全移植
- スタミナ個別消費
- 要約統計ログの整理

## 注意点

Stage Aは構造差し替えの初期段階であり、試合バランスは未調整。
次はStage Bとして、役割選出と各攻撃タイプの正式計算式を追加する。
