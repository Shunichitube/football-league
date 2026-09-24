# MATCH ENGINE Stage E Summary / Balance Check

最終更新: 2026-09-25
対象ブランチ: `dev/match-engine-v1`

## 1. この文書の扱い

本書は `docs/MATCH_ENGINE_SPEC_v1.md` に基づく Stage E の実装・確認メモである。
Stage Eでは、試合エンジンそのものの主要ロジックを大きく変えず、試合後に確認できる要約統計と、今後のバランス確認観点を整理する。

## 2. 実装内容

`js/league.js` に `summarizeMatchResult(result)` を追加した。

各試合結果に `result.summary` を付与し、シーズン結果の保存時にも `summary` を保持する。

保存対象は以下。

- `score`
- `totalGoals`
- `shots`
- `saves`
- `defensiveStops`
- `phases`
- `attackTypes`
  - `PASS`
  - `DRIBBLE`
  - `COUNTER`
  - `SHORT_COUNTER`
- `goalsByType`
  - `PASS`
  - `DRIBBLE`
  - `COUNTER`
  - `SHORT_COUNTER`
- `chances`
  - `HARD`
  - `NORMAL`
  - `CLEAR`
  - `BIG`
- `goalsByChance`
  - `HARD`
  - `NORMAL`
  - `CLEAR`
  - `BIG`
- `events`
  - `goals`
  - `saves`
  - `gkCatches`
  - `misses`
  - `rebounds`
  - `defensiveStops`
  - `shortCounters`

## 3. 実装方針

詳細な実況ログを増やすのではなく、既存の `events` と `playerResults` から要約値を作る。

理由:

- 10試合連続オートが主用途のため、詳細実況を増やしすぎない
- 試合結果画面・バランス確認で使いやすい
- 内部仕様をUIに出しすぎない
- 既存の保存構造を大きく壊さない

## 4. 現時点での注意点

Stage Eの集計は、`events.extra` の先頭に含まれる攻撃タイプ・チャンス種別を利用している。

例:

```txt
PASS / NORMAL / ...
COUNTER / CLEAR / ...
SHORT_COUNTER / BIG / ...
```

そのため、今後イベント文字列を変更する場合は、`summarizeMatchResult` 側の読み取りも合わせて修正する。

### 4.1 `attackTypes` の意味

現時点の `summary.attackTypes` は、攻撃開始回数ではなく、主にシュート到達イベントに記録された攻撃タイプを集計している。

つまり、以下に近い意味で扱う。

- `PASS`: PASS攻撃からシュート・セーブ・ミス・リバウンド等まで到達した回数
- `DRIBBLE`: DRIBBLE攻撃からシュート・セーブ・ミス・リバウンド等まで到達した回数
- `COUNTER`: COUNTER攻撃からシュート・セーブ・ミス・リバウンド等まで到達した回数
- `SHORT_COUNTER`: SHORT_COUNTER攻撃からシュート・セーブ・ミス・リバウンド等まで到達した回数

第1攻撃開始や第2で止められた攻撃まで含む「攻撃試行数」ではない。

将来的に攻撃試行数も必要になった場合は、既存の `attackTypes` を上書きせず、別項目として以下のような内部保存を追加する。

- `attackAttempts`
  - 第1攻撃開始回数
  - PASS / DRIBBLE / COUNTER / SHORT_COUNTER 別に保存
- `shotArrivals`
  - 現在の `attackTypes` 相当
  - シュート到達回数として保存

UIで表示する場合も、`attackTypes` をそのまま「発生数」と表現せず、「シュート到達数」または別名で扱う。

## 5. バランス確認観点

Stage E以降で、以下を中心に確認する。

### 得点数

- 1試合あたりの平均得点が極端に低くないか
- 0-0が多すぎないか
- 大量得点が出すぎないか

### シュート数

- 2段階突破型にしたことでシュート数が減りすぎていないか
- PASS / DRIBBLE / COUNTERでシュート到達率に極端な偏りがないか

### 攻撃タイプ

- 通常再開でCOUNTERが出ていないか
- 守備成功後再開でCOUNTERが発生しているか
- COUNTER戦術でCOUNTER比率が上がっているか
- 現在の `summary.attackTypes` は攻撃試行数ではなく、シュート到達数として読む

### SHORT_COUNTER

- 発生頻度が高すぎないか
- COUNTER戦術以外でも条件次第で発生しているか
- 発生した時に得点へ直結しすぎていないか

### チャンス種別

- HARD / NORMAL / CLEAR / BIG の比率が極端でないか
- BIGが多すぎないか
- HARDしか出ない状態になっていないか

### 特能

- DF特能の役割が分かれているか
  - `パスカット`: パス攻撃への守備
  - `カバーリング`: 突破・速攻へのカバー対応
  - `最終防衛線`: ゴール前の大ピンチ抑制
- FW/MF特能が一部だけ強すぎないか
- GK特能で得点が極端に減りすぎないか

## 6. まだ公開版には反映しない

このStage E完了時点でも、mainにはマージしない。
公開版は安定版のまま維持する。

次に必要なのは、実機またはブラウザ上での以下の確認。

- 10試合一括シミュレートが止まらない
- シーズン終了まで進行できる
- 結果画面が壊れない
- オフシーズンへ進める
- `summary` 追加により保存・表示周りでエラーが出ない

## 7. Stage E完了条件

現時点でのStage E完了条件は以下。

- 試合結果に要約統計 `summary` を付与できる
- 人間クラブの保存済み試合結果にも `summary` を保持できる
- バランス確認の観点を文書化している
- main / 公開版はまだ変更しない
