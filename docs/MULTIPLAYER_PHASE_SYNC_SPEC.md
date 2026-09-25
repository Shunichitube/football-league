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
offseason-contract
```

---

## 5. 契約・放出フェーズ

既存UI:

```txt
契約更新
放出
ロスター表示
```

入力:

```txt
renewContracts: 更新対象
releasePlayers: 放出対象
```

確定処理:

```txt
各クラブの契約更新・放出を適用
```

次フェーズ:

```txt
development
または draft
```

---

## 6. 育成フェーズ

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

既存UI:

```txt
ドラフト候補画面
この選手を指名ボタン
```

マルチで追加する同期:

```txt
各クラブが指名
未指名クラブを表示
全員指名後に確定
競合時は抽選
外れたクラブだけ再指名
```

入力:

```txt
pickPlayerId
または skip
```

確定処理:

```txt
同時指名をまとめて解決
競合抽選
獲得クラブへ追加
外れクラブは pending のまま
```

次フェーズ:

```txt
次巡
または auction
```

重要:

```txt
ドラフト画面自体はシングルプレイ準拠。
マルチ側では、指名済み/未指名と、外れ再指名の待機だけを追加する。
```

---

## 8. 競売フェーズ

既存UI:

```txt
競売対象選手表示
入札額入力
見送り
```

マルチで追加する同期:

```txt
各クラブが入札額または見送りを入力
未入力クラブを表示
全員入力後に開札
最高額クラブが獲得
同額なら抽選
結果確認後に次の選手へ
```

入力:

```txt
bidAmount
または pass
```

確定処理:

```txt
全入札をまとめて解決
落札結果を保存
資金とロスターを更新
```

次フェーズ:

```txt
次の競売選手
または next-season-setup
```

重要:

```txt
競売画面自体はシングルプレイ準拠。
マルチ側では、入札済み/未入力と、開札待ちだけを追加する。
```

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
