# FOOTBALL LEAGUE マルチプレイ・フェーズ同期仕様

## 0. 方針

マルチプレイ化で新しい画面を作り直さない。

ロビー以降は、原則として既存のシングルプレイUI・既存コンポーネントを使う。
マルチプレイ側は、各フェーズに以下の同期レイヤーだけを追加する。

```txt
- 自分の入力完了ボタン
- 誰が完了済みか
- 誰が未完了か
- 全員完了まで次へ進まない制御
- 全員完了後の確定処理
```

これにより、編成・育成・契約・放出・ドラフト・競売を同じ考え方で扱う。

---

## 1. 基本モデル

各フェーズは以下の形で扱う。

```txt
phase
  現在のゲームフェーズ

phaseInput
  各クラブがそのフェーズで入力した内容

phaseComplete
  各クラブが入力完了したか

phaseResult
  全員完了後に確定された結果
```

処理順は共通。

```txt
1. 既存シングルプレイUIで入力する
2. 入力内容をRoomへ送信する
3. 送信したクラブは完了扱いになる
4. 未完了クラブを表示する
5. 全員完了したら確定処理を行う
6. 次フェーズへ進む
```

---

## 2. 編成・戦術フェーズ

既存UI:

```txt
renderLineupEditor
戦術選択UI
```

入力:

```txt
lineup: 選手ID 5人
 tactic: BALANCED / POSSESSION / DRIBBLE / COUNTER
```

確定処理:

```txt
各クラブの lineup / tactic をリーグ状態へ反映
```

次フェーズ:

```txt
season-ready
```

---

## 3. シーズン実行フェーズ

既存処理:

```txt
simulateRemainingSeason
standings
finalizeSeason
```

入力:

```txt
ホストの実行操作
```

確定処理:

```txt
リーグ30試合を一括処理
順位表・結果をRoomに保存
```

次フェーズ:

```txt
season-result
```

---

## 4. 結果確認フェーズ

既存UI:

```txt
seasonResults
standings
stats
```

マルチ追加:

```txt
各クラブが「結果確認完了」ボタンを押す
未確認クラブを表示
全員確認後にオフシーズンへ進む
```

次フェーズ:

```txt
offseason-events
```

---

## 5. 契約・要求・特別特訓フェーズ

シングルプレイ現行順序に合わせ、年数契約・不満/先発ボーナス要求・若手特別特訓を同一フェーズで扱う。任意放出はここでは行わず、成長結果の後の選手整理フェーズで行う。

入力:

```txt
contract: 契約更新 / 更新しない
retention: 要求を支払う / 支払わない
special: 特別特訓を実行 / 見送る
```

確定処理:

```txt
全人間クラブの入力完了
↓
offseason-events-ready
↓
ホストが人間入力と既存CPUロジックをまとめて適用
↓
更新後leagueStateと特別特訓受諾者をRoomへ保存
```

次フェーズ:

```txt
development
```

---

## 6. 育成フェーズ

契約・要求・特別特訓確定後の共有leagueStateを基準にする。人間クラブは育成対象2名と重点能力を入力し、CPUは既存の育成選択ロジックを使用する。全員入力後に成長処理を1回だけ確定する。

### 6.1 成長後

成長結果を各クラブが確認した後、独立した `release`（選手整理）フェーズへ進む。ここで任意放出を行い、その後ドラフトへ進む。

## 6.2 既存説明

既存UI:

```txt
育成対象選択
特別特訓イベント
```

入力:

```txt
developmentSelections: 育成対象と育成項目
specialTrainingActions: 特別特訓の受諾/拒否
```

確定処理:

```txt
全クラブの育成入力をまとめて処理
成長・覚醒・特殊能力取得を確定
```

次フェーズ:

```txt
draft
```

---

## 7. ドラフトフェーズ

選手整理確定後にシングル版と同じ `startNextSeason` を実行してから、新シーズンのドラフトへ入る。

巡回ルール:

```txt
Season 1: 第1〜4巡すべて完全同時指名
Season 2以降:
  第1巡 完全同時指名
  第2巡 前年順位 下位→上位
  第3巡 前年順位 上位→下位
  第4巡 前年順位 下位→上位
```

入力:

```txt
draftPlayerId
または残り指名辞退
```

同期:

```txt
指名内容はRoom内部draftInputsへ保存
公開Room状態には指名内容を含めない
対象人間クラブ全員が入力
↓
draft-ready
↓
ホストが確定
↓
CPU指名を既存ロジックで追加
↓
resolveDraftActions
```

同時指名で競合した場合は既存抽選を使う。獲得クラブは当該巡のpendingから外れ、外れクラブだけ再指名へ残る。辞退クラブは以後の巡も対象外とする。

順番指名では現在の1クラブだけをpendingとし、確定後に次クラブへ進む。CPUだけがpendingの場合もホスト確定で進行できる。

第4巡終了後は `auction` へ進む。

---

## 8. 競売フェーズ

ドラフト終了時に既存 `createAuctionPool` で候補を生成する。各人間クラブは現在の1選手に対して入札額または見送り（0pt）を入力する。

```txt
auction
  各人間クラブが秘密入札
  入札内容は公開Room状態に含めない
  全員入力
↓
auction-ready
  ホストが開札
  CPU入札を既存ロジックで追加
  resolveAuctionActions
↓
落札結果のみ共有
↓
次候補
```

同額最高入札は既存抽選処理を使用する。登録上限12人のクラブは0pt扱いとする。最終候補の開札後は `releasedPlayers` をクリアし、CPU編成を整えて `team-setup` へ進む。

---

## 8.1 初年度市場フロー

マルチもシングルプレイと同じ入口に統一する。

```txt
lobby
→ クラブ割当
→ Season 1 draft
→ auction
→ team-setup
→ season-ready
→ Season 1 simulation
```

Season 2以降も共有 `leagueState` を継続使用し、各シーズンでリーグを作り直さない。

---

## 9. 共通API方針

将来的には、個別APIを増やしすぎず、フェーズ入力用APIへ寄せる。

```txt
POST /api/rooms/:roomId/phase-input
POST /api/rooms/:roomId/phase-complete
POST /api/rooms/:roomId/phase-confirm
```

ただし初期実装では、既存のAPIを段階的に使ってよい。

現在のAPI:

```txt
POST /api/rooms/:roomId/submit
POST /api/rooms/:roomId/ready
POST /api/rooms/:roomId/run-season
POST /api/rooms/:roomId/complete-season
```

---

## 10. 実装上の注意

- シングルプレイの画面・処理を壊さない
- 既存コンポーネントを再利用する
- マルチ専用UIは最小限にする
- 各フェーズの確定処理はサーバー側Room状態に保存する
- 入力途中の状態は他クラブに中身を見せず、完了/未完了だけ見せる
- ドラフトの指名内容、競売の入札額は確定前に公開しない
- 全員入力完了後にだけ結果を公開する


## 6.3 成長結果確認

全クラブの育成入力が揃った後、ホストが既存 `processLeagueOffseason` を一度だけ実行する。成長・覚醒・特殊能力習得・加齢・引退・最低人数救済はシングルプレイと同じ処理を使用する。

各人間クラブは自クラブの成長結果を確認し、確認完了を送信する。全員確認後に `release` へ進む。

## 6.4 選手整理・放出

`release` では各人間クラブが放出対象を選ぶ。最低5人、GK最低1人の既存制約を維持する。CPUは既存 `prepareCpuMarketSpace` を使用する。

全員の入力完了後、ホストが結果を一度だけ確定して共有 `leagueState` を更新し、`draft` へ進む。


---

## 11. 入力秘匿と参加認証

公開Room状態には、各プレイヤーの作業内容そのものを含めない。

```txt
公開:
- playerId
- クラブ名
- ready / phaseComplete
- submitted.completed

非公開:
- lineup / tactic
- 契約・要求・特別特訓の判断
- 育成対象・重点能力
- 放出対象
- ドラフト指名
- 競売入札額
```

全員入力後の確定処理では、ホスト認証済みの専用prepare APIから必要な入力だけ取得する。

ルーム参加時に各プレイヤーへ非公開 `playerToken` を発行し、更新系APIは `playerId` と `x-player-token` の組み合わせを検証する。IDだけでは他参加者やホストの操作を代行できない。

## 12. 最終シーズン

Season 10のシーズン結果を全参加者が確認したら `game-complete` へ進み、契約・育成・ドラフト等の次オフシーズン処理は開始しない。
