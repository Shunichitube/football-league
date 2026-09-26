# Multiplayer v3 — Stage V3-0 調査・実装計画

調査日: 2026-09-26 (JST)
対象: Shunichitube/football-league
このStageの変更は本ドキュメントのみ。ゲーム実装・デプロイは行わない。

## 1. 起点とブランチ

- GitHub APIで確認した main: `8854b180ab5327f8196c2a0c44d9af0a1089754a`
- 参照用 dev/multiplayer-v2: `ced2ab238f83c2a3471e2c36cb9fb83215abc88d`
- dev/multiplayer-v3 は上記main SHAを指定して新規作成済み。
- v2のマージ・cherry-pickは行わない。mainとv2への書き込みは行わない。
- ローカル作業フォルダは未コミットの空リポジトリでremote未設定。Git HTTPS helperも利用不可だったため、GitHub APIでブランチ作成し、SHA固定アーカイブをローカルへ取得して比較した。ローカルGit checkoutを作成したという意味ではない。
- アーカイブ内にAGENTS.mdは見つからなかった。

## 2. 最優先の設計原則

**ゲーム開始後のUI・操作感はシングルプレイを正本とする。**

画面、選手カード、並べ替え、選手詳細、編成枠、戦術、履歴、育成の二段階選択、契約の個別ボタン、放出操作を共通利用する。
同じ操作から共通Actionを発行し、その後の処理だけをSingle実行とRoom同期に切り替える。
ロビー・参加操作はマルチ固有。ゲーム開始後に必要な差分は既存操作部の送信／待機状態と小さな完了表示に限定する。

禁止する構造:
- MutationObserverでマルチ画面・ボタン・同期パネルを後付けする。
- DOMの文言やdata属性をroomId・phaseの正本とする。
- 大きなマルチ専用状態カードをゲーム画面の上に常設する。
- multiplayer-*.jsが個別にfetch・状態管理・描画・イベント登録を行う。
- v2の独自画面にシングル部品を部分埋め込みして「共通UI」と扱う。

通常のフォーム入力やクリック対象IDをDOMイベントから受け取ることとは区別する。
描画はアプリの明示的なrender経路から行い、Roomの情報はstore/sessionからのみ読む。

## 3. 実コードの差分

SHA固定のファイル比較では20ファイル、3,724行追加／18行削除。
追加された通信・画面群とは別に、既存app.js、market.js、index.html、style.cssにも差分がある。
js/ui.js、league.js、cpu.js、development.js、rules.js、sim.jsなどの共通コアは今回の比較では同一。

### 3.1 シングル側の正本

| 対象 | mainの所在 | 共通化方針 |
|---|---|---|
| アプリ状態・自クラブ・ルーティング | js/app.js:8–9、27、以後のrenderラッパー | 状態と描画の入口を明示化。マルチでも同じ画面を呼ぶ |
| ドラフトと履歴 | app.js:16–19、28–37、draftHistoryRender | カード・並べ替え・履歴・辞退操作を維持 |
| オークションと履歴 | app.js:18、20、29、38、auctionHistoryRender | 入札欄・見送り・履歴を維持 |
| 編成・戦術 | app.js:squad、編成イベント群、ui.js:renderLineupEditor | 選手→枠の選択順、ベンチ並べ替えを維持 |
| 結果・順位・成績・試合詳細 | app.js:table/stats/seasonResults/matchDetail、ui.js | 自クラブ視点の同じ画面を利用 |
| 契約・要求・特別特訓 | app.js:stage4Render、各data-renew/retention/special操作 | 個別ボタンの操作感を維持。v2のselect一覧に置換しない |
| 育成・重点能力・成長結果 | app.js:stage4Renderのdevelopment/focus/growth | 2名選択→重点能力→成長結果の順序を維持 |
| 選手整理・放出 | app.js:release、ui.js:renderPlayerCard | 既存カード操作を利用 |
| 所属選手・名前変更 | app.js:stage10Render、ui.js:applyRename等 | 名前変更もAction経由にし、共有オブジェクト直接変更を避ける |
| セーブ | app.js:stage19Render、js/storage.js | シングル保存は維持。Room参加復帰はsession経由に分離 |

注意: main自体もrender再代入と複数イベントハンドラ、insertAdjacentHTMLによる追加を含む。
既存の見た目を維持しつつ、マルチ対応に必要な画面から明示的な構成に整理する。
フレームワーク移行やアプリ全体の一括書き換えは行わない。

### 3.2 v2の問題箇所

| v2の所在 | 観測した構造 | v3での扱い |
|---|---|---|
| multiplayer-ui.js:361 renderRoomScreen | マルチ専用の画面ルート、独自setup/result描画 | ゲーム開始後は廃止、シングル共通画面へ |
| multiplayer-ui.js:623 | タイトルボタンをMutationObserverで追加 | titleの通常描画に参加導線を定義 |
| multiplayer-phase-sync.js:36–37、106 | .room-idのtextContent取得、監視による同期パネル追加 | session/storeと共通描画へ |
| multiplayer-draft.js:17–18、127、271 | DOMからRoom取得、独自ドラフト描画、監視 | 通信・確定手順だけ抽出 |
| multiplayer-auction.js:13–14、renderPanel | DOMからRoom取得、独自競売画面 | 同上 |
| multiplayer-offseason.js:13、58、88、104 | DOM依存、独自eventCards、監視 | 同上 |
| multiplayer-development.js:renderPanel、364 | 育成・成長・放出の独自描画、監視 | 同上 |
| 各requestJson/readSession | 同じ通信・参加情報読み出しの重複 | 単一RoomClient/Sessionへ |

### 3.3 v2へ巻き戻してはいけないルール差

- mainのドラフト指名料・参加資金条件は5pt。v2は1pt。
- mainのドラフト候補分布はG15/F25/E40/D15/C4/B1。v2はG35/F35/E20/D8/C2。
- mainの競売復帰候補は30歳以上ならB以上、30歳未満ならC以上で選別。v2はこのフィルタがない。
- mainのmarket.jsを正本にする。v2内に複製されたdraftEligibleIds等の1pt判定もそのまま移植しない。
- v2のindex.htmlのmultiplayerモジュール読み込み、style.cssのマルチ専用追加分は取り込まない。

## 4. 流用可能コード一覧

以下は候補であり、このStageではコピーしない。

| 分類 | v2コード | 流用範囲／必要な調整 |
|---|---|---|
| Workerルーティング | worker/index.js:randomRoomId、roomStub、roomRequest、forwardRoomAction、fetch | /api/rooms系とx-player-token転送を基礎として流用。APIはまず互換維持 |
| Durable Object保存 | worker/room.js:RoomObject/load/save/fetch | Room単位保存・分岐を流用。リビジョンと再送時の一度だけ確定を追加検証 |
| 参加認証 | createPlayer、authenticatedPlayer、authenticatedHost | playerIdとtoken照合、host-only制御を流用。全更新APIで確認 |
| 公開状態 | publicPlayer、publicRoom、withoutHiddenGrowth | token・入力非公開の考え方を流用。全ネスト経路を監査 |
| 秘密入力 | submitDraft/draftInputs、submitAuction/auctionInputs、phaseInput/submitted | 未確定入力をRoom内部へ保存し公開レスポンスから除外 |
| 確定用入力取得 | privatePhaseSnapshot、draftResolutionInputs、auctionResolutionInputs、prepare-* | 対象phaseかつ認証済みhostだけに必要入力を渡す契約を流用 |
| フェーズ遷移 | resetPhaseCompletion、markPhaseComplete、confirmCurrentPhase、submit*/advance*、setDraftWaiting | 完了判定・待機・次phase・Season10終了を流用しmainの進行順と照合 |
| クライアント通信 | multiplayer-ui.js:readSession/saveSession/requestJson | 関数単位でRoomClientに抽出。URL・認証・エラー処理を一本化 |
| 入力・確定手順 | multiplayer-{draft,auction,offseason,development}.jsのsubmit/resolve関数群 | API payload・prepare→計算→advanceの手順のみ参考。DOM/描画/重複ルールを除去 |
| フェーズ確認 | multiplayer-phase-sync.js:confirmPhase/statusForPhase | 確認送信と完了状態の意味のみ参考。パネルは流用しない |
| DO配線 | wrangler.tomlのROOMS/RoomObject/migrations | 将来の環境設定の参考。v2 Worker名や既存Roomを流用して上書きしない |

multiplayer-league.jsはリーグ全体を別生成するため、そのまま移植しない。
参加順→クラブ割当という同期上の要件だけ参考にし、mainの生成処理を共通化する。
ゲーム計算はmainのmarket/rules/league/cpu/developmentを使う。

## 5. v3の構造案

次のファイル名は予定であり、まだ作成しない。

```text
既存シングル共通画面 / ui.js
    ↓ Action（選手選択、入札、契約、育成、確認等）
共通controller
    ├─ SingleAdapter → main由来のゲーム処理 → store
    └─ RoomAdapter → RoomClient → Worker → RoomObject
                                 ↓ 確定済みsnapshot
                              store → 同じ共通画面
```

- app-store.js: mode、session、確定済みgame、画面view、ローカル編集中input、通信状態を明示して保持。
- game-actions.js / game-controller.js: 既存イベントから意味のあるActionへ変換。描画や通信を持たないゲーム処理を分離。
- single-adapter.js: 既存シングルの結果・乱数順序・保存互換性を維持。
- room-client.js: API、認証、更新購読、再接続、エラー処理。DOMを参照しない。
- room-adapter.js: Room snapshot→共通view model、Action→Room入力。ここでも描画しない。
- 共通screen関数: 既存app.jsのテンプレートを抽出して両モードから同じものを呼ぶ。ui.jsの部品を継続利用。

### 状態境界

1. roomId/playerId/playerTokenはsessionに、phaseはRoom snapshotに保持する。
2. 自クラブはsession.playerId→割当clubIdで解決する。mainのme()は最初のHUMANを選ぶため、そのままではゲストがホストを操作する。
3. Roomのclub-1形式とleagueの数値IDの変換を境界で統一する。
4. RoomのleagueState/draftState/auctionStateを共通モデルに投影する。auctionState.indexとシングルs.auction.iの差を吸収する。
5. 編集中の編成、契約判断、育成、放出は自クラブのローカル入力にのみ反映。Roomの確定状態を直接変更しない。
6. 契約の支払い等はローカルpreviewに反映し、資金・未処理件数・操作順をシングル同様に更新。フェーズ完了操作で入力一式を送る。
7. Map/Set/乱数関数はUI/実行時の値とJSON wire形式を分離。公開snapshotのhiddenGrowth欠落を乱数再生成で補わない。
8. viewとphaseを分ける。順位表・詳細・履歴・並べ替えはローカル閲覧操作。ポーリングで閲覧画面や入力フォーカスを奪わない。
9. シングルのセーブ・ロードがRoomを上書きしないようadapter境界を設ける。名前変更も同じ境界を通す。

### 同期と秘密入力の前提

v2は「サーバーがすべて計算」ではない。host-only prepareで内部league/入力をホストへ渡し、
ホストブラウザが計算してadvanceで結果をRoomへ保存する。
初期v3はこの通信契約を参考にするが、確定責任・リビジョン・重複防止を明記して移植する。

- 一般参加者への公開応答では他者の未確定入力を返さない。
- ホストは確定用APIから内部情報を取得できる。ホストにも完全秘匿する保証とは異なる。
- publicRoomはleagueState等にフィルタをかける一方、seasonResult/offseasonStateはそのまま返すため、全レスポンス経路の確認が必要。
- 既存コードのphaseチェックだけでは、後続の同名phase（次候補・次巡）への古い送信を区別できない。phaseRevisionとrequestIdを追加する計画とする。
- 二重クリック、通信再送、古いsnapshot、並行確定に対してRoom側で一度だけ適用する。
- ホスト切断時は待機と復帰を保証し、自動ホスト移譲は別仕様として扱う。
- v2のrequestJsonはoptionsの展開順でheadersを置換し得るため、抽出時にtoken headerの保持を修正する。

## 6. フェーズと共通画面の対応

| Room phase | 共通画面 | 同期する操作 |
|---|---|---|
| lobby | 参加・ロビーのみ固有 | 参加、開始、クラブ割当 |
| draft / draft-ready | draft＋指名履歴 | 指名・辞退→全対象完了→確定 |
| auction / auction-ready | auction＋競売履歴 | 入札・見送り→全員完了→開札 |
| team-setup / season-ready | squad / home | 編成・戦術確定→全員待機→ホスト実行 |
| season-result | seasonResults/table/stats/matchDetail | 一度だけ計算・保存、結果確認 |
| offseason-events / offseason-events-ready | offseasonEvents | 契約・要求・特訓判断の完了 |
| development / development-ready | development→focus | 2名・重点能力の送信→成長確定 |
| growth-result | growth | 結果確認 |
| release / release-ready | release | 放出完了→次年度開始 |
| game-complete | history等の既存最終結果 | Season10で終了、次年度へ進めない |

v2にseason-running phaseはなく、season-readyからホスト計算結果をcomplete-seasonで保存する。計算中の表示は通信状態として保持し、Room側の確定ロックはV3-2で設計する。

Roomのready系は別画面を作らず、同じ画面で操作部だけ待機表示にする。
draft/auction完了時の既存結果閲覧も維持し、自動遷移で履歴確認を失わないようcontrollerで制御する。

## 7. 段階的実装計画と完了条件

### V3-1: シングルUIの共通入口

- app.jsの状態参照、me()、Action境界、screen入口を小さく抽出する。
- 既存シングルのテンプレート・CSS・操作順・セーブを維持。
- ui.js内の名前変更など直接mutationも共通Actionへ。
- 完了条件: シングル初年度市場→シーズン結果→オフシーズン→次年度、最終年を通し、既存テストと主要画面の比較が通る。

### V3-2: Room基盤とロビー

- Worker/DO、認証、公開snapshot、RoomClient/session/storeを導入。
- v3開発用のRoom保存環境を分離。v2データ移行を暗黙には行わない。
- リビジョン・再送・参加復帰・単一購読を実装。
- 完了条件: 2人以上が参加し各自のクラブを識別。誤token/他人playerId/guestのhost操作を拒否。公開応答に秘密がない。

### V3-3: 初年度市場を共通UIで接続

- draft/auctionのActionだけRoomAdapterへ接続。
- 同時指名、競合再指名、辞退、CPUのみ残る場合、同額入札を処理。
- mainの5pt・候補分布・復帰条件を保持。
- 完了条件: ゲストもホストもシングルと同じカード・履歴・操作で編成まで進む。独自マルチ画面/DOM監視がない。

### V3-4: 編成・シーズン・結果確認

- renderLineupEditor、戦術、順位、個人成績、試合詳細を共通利用。
- 全員完了待ち、ホスト実行、二重確定防止、閲覧中の更新を確認。
- 完了条件: 全参加者の確定結果一致、自クラブ表示一致、編集中データ非公開、結果閲覧を保った確認同期。

### V3-5: オフシーズンと複数年度

- 契約→要求/特訓→育成→成長確認→放出→次年度市場を既存UIで接続。
- 年間資金・契約減算・加齢・成長・引退を一度だけ適用。
- Season2以降の巡ごとの指名順とSeason10終了を保証。
- 完了条件: 2名育成、最低5人/GK1人、CPU判断を維持して複数年度が進行する。

### V3-6: 統合検証と整理

- 2人＋CPU、6人、ホスト/ゲスト、再読み込み、切断復帰、遅延・再送・古いphase入力を確認。
- 主画面のデスクトップ/狭幅表示、選手詳細・名前変更・並べ替え・フォーカスを比較。
- 未確定指名・入札・編成・契約・育成・放出とtoken/hiddenGrowthを公開API全経路で監査。
- マルチ画面の独立renderer、DOM由来roomId/phase、MutationObserver差し込みがないことを確認。
- 既存tests/*.test.jsに加え、Room認証・秘匿・遷移・冪等性とadapter境界の意味あるテストを追加。
- 完了条件を満たすまでmainへ統合しない。デプロイは別Stage。

## 8. V3-0の検証範囲

- GitHub APIによるmain/v2 SHA確認、新規v3作成。
- SHA固定ソースのファイル差分、主要画面・操作・通信・認証・秘密入力・フェーズ分岐を静的確認。
- このStageは計画ドキュメントのみ。ブラウザ動作、Cloudflare実機、複数人通信の検証は未実施。
- 実装変更がないため新規テストは追加しない。v3差分が本書だけであることを最終確認する。
