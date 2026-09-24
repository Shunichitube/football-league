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

## 事前シミュレーション確認

Stage B着手前に、Stage A相当のローカル最小ハーネスで以下を確認した。

- `BALANCED / POSSESSION / DRIBBLE / COUNTER` 各戦術で `simulateMatch` が完走
- 80フェイズが終了し、イベント、スコア、10人分の出場結果を返すことを確認
- 確認時のサンプル結果
  - BALANCED: 0-0 / events 80 / playerResults 10
  - POSSESSION: 2-0 / events 80 / playerResults 10
  - DRIBBLE: 2-0 / events 80 / playerResults 10
  - COUNTER: 2-1 / events 80 / playerResults 10

注意: GitHubリポジトリ全体をコンテナへcloneできなかったため、必要モジュールを最小化したローカルハーネスで構文・試合完走を確認した。公開版・mainには未反映。

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

## Stage B 実装状況

Stage B — 役割選出と正式計算式を実装。

### 実装済み

- PASS / DRIBBLE / COUNTER の第1・第2について、仕様書の役割選出重みを実装
- PASS
  - 第1パサー、第1受け手、第2受け手、サポート役、第1カット役、第2最終対応DF
  - PASS継続時は第1受け手を第2パサーとして引き継ぐ
  - PASS→DRIBBLE時は第1受け手を第2仕掛け役として引き継ぐ
- DRIBBLE
  - 仕掛け役、サポート役、第1対応者、第2カバー役
  - DRIBBLE継続時は仕掛け役・サポート役を第2へ引き継ぐ
  - DRIBBLE→PASS時は仕掛け役を第2パサー、サポート役を第2受け手として引き継ぐ
- COUNTER
  - 起点役、ランナー、サポート役、戻り守備、最終対応DF
  - COUNTER継続時は第1ランナーを第2ランナーとして引き継ぐ
- サポート役は同程度のシュート能力で約10%程度のシュート候補になるよう、シューター選出重み `SHOOT ×0.12` を実装
- 攻撃計算式をチーム平均ベースから役割ベースへ変更
- 守備計算式をチーム平均ベースから役割ベースへ変更
- 役割名をイベントログの `extra` へ最小限付与

## Stage C 実装状況

Stage C — シュート処理拡張、こぼれ球、COUNTER補正・失敗デバフ、SHORT_COUNTERを実装。

### 実装済み

- 相手第1攻撃を大きく止めた場合のSHORT_COUNTER発動判定を追加
  - 差 <= -10: 強いSHORT_COUNTERチャンス
  - -10 < 差 <= -4: 弱いSHORT_COUNTERチャンス
  - `counterIntent >= 25` でSHORT_COUNTER発動
- `counterIntent` に以下を反映
  - 戦術補正
  - 守備成功補正
  - ランナー走力補正
  - サポート走力補正
  - `カウンター起点` / `スピードスター`
  - 試合状況補正
  - COUNTER戦術の `COUNTER_TRIGGER +4`
- SHORT_COUNTER専用役割を追加
  - 奪取役 = 第1守備成功者
  - ランナー
  - サポート役
  - 最終対応DF
  - GK能力10%を守備側に加味
- COUNTER / SHORT_COUNTERのシュート補正を実装
  - COUNTER: `shotScore +5`
  - SHORT_COUNTER: `shotScore +8`
- COUNTER第2失敗時とSHORT_COUNTER突破失敗時に、次の守備第1判定へ `-4` デバフを追加
- シュートまで行ったCOUNTER / SHORT_COUNTERにはデバフを付けない
- シュート結果を拡張
  - GK大幅優位: `GK CATCH`
  - 中間: `SAVE` または `MISS`
  - 僅差: `REBOUND`
- こぼれ球処理を追加
  - BIG / CLEAR: 攻撃側回収20%
  - NORMAL: 攻撃側回収12%
  - HARD: 攻撃側回収8%
  - GK能力で攻撃側回収率を補正
- 攻撃側がこぼれ球を回収した場合、PASS / DRIBBLE 50:50の第2攻撃から再チャンスへ移行
- Stage B実装内の自動交代処理で、`enterSlot` 呼び出し引数が不足していた箇所を修正

## Stage D 実装状況

Stage D — 特能の役割制への移植を実装。

### 実装済み

- 特能補正をチーム平均ではなく、役割に選ばれた選手へ局面別に適用
- DF特能
  - `ボールハンター`: 第1守備・奪取局面の守備値に補正
  - `カバーリング`: DRIBBLE突破・COUNTER/SHORT_COUNTER速攻への第2カバー対応に補正
  - `パスカット`: PASS第1カット役 / PASS第2最終対応DFで別補正
  - `カウンター起点`: SHORT_COUNTER発動判定に加え、COUNTER/SHORT_COUNTER起点のパス成分にも補正
  - `ビルドアップ`: PASS第1パサー、COUNTER起点役のパス成分に補正
  - `最終防衛線`: CLEAR/BIG相当の大ピンチ時にチャンス種別を1段階抑える
- MF/FW系特能
  - `スピードスター`: COUNTER/SHORT_COUNTERランナー、サポート、DRIBBLE仕掛け役の走力成分に補正
  - `ドリブラー` / `個人技`: DRIBBLE仕掛け役のドリブル成分に補正
  - `チャンスメイカー`: PASS第2パサー / PASSサポート役のパス成分に補正
  - `カットイン`: DRIBBLE第2成功後、仕掛け役がシューターならshotScore補正
  - `ハードワーカー`: 走力成分に広く補正
  - `万能型`: BALANCED戦術時、関与能力に補正
  - `ポストプレーヤー`: PASS第2受け手の攻撃値とサポート役シュート重みに補正
  - `フィニッシャー` / `ミドルシューター` / `勝負強さ` / `エース`: シュート局面・シューター選出へ反映
- GK特能はStage Cまでのシュート処理に残した既存効果を維持
- `shotScore`は特能加点方式へ整理し、カウンター補正と重ねて計算

### Stage D補足修正

DF守備系の個性が重なりすぎないよう、以下を追加修正した。

- `パスカット`: パス攻撃への守備に特化したまま維持
- `カバーリング`: PASS第2最終対応からは外し、DRIBBLE突破・COUNTER/SHORT_COUNTER速攻へのカバー対応に寄せた
- `最終防衛線`: 第2守備全般の単純補正ではなく、CLEAR/BIG相当の大ピンチを1段階抑える特能に変更
- ゲーム内説明も、内部数値は出さずに以下の方向へ調整
  - カバーリング: `突破や速攻へのカバー対応で力を発揮する。`
  - 最終防衛線: `ゴール前の大ピンチで力を発揮する。`

### Stage Dでまだ実装しないもの

以下は仕様書通り後続Stageで扱う。

- スタミナ個別消費
- 要約統計ログの整理
- バランス調整
- 公開版への反映

## 注意点

Stage Dまでで、新試合エンジンの主要ルールはほぼ仕様書に沿って実装された。
ただし、試合バランスは未調整であり、Stage Eで得点数・シュート数・COUNTER/SHORT_COUNTER発生数・特能影響の偏りを確認する必要がある。