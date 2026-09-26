# Multiplayer v3 — 一括実装（構文・静的チェックまで）

作成日: 2026-09-26
起点: main `8854b180ab5327f8196c2a0c44d9af0a1089754a`
対象ブランチ: `dev/multiplayer-v3`

ユーザー指定によりV3-1〜V3-5のコード作成をまとめて実施し、V3-6は構文・静的チェックの範囲に限定した。ブラウザで遊べることやCloudflare実機での動作を確認済みという意味ではない。

## 実装内容

| 範囲 | 作成したコード |
|---|---|
| 共通UI | app.jsの既存画面・ui.jsのカード/編成/結果/履歴を両モードで使用。共通イベント入口でRoom操作と既存Single処理を選択 |
| ロビー | 作成、参加、参加情報保存、復帰。最大6人、残りは既存CPU |
| 初年度市場 | 秘密指名、同時指名/順番指名、競合時再指名、辞退、秘密入札、同額抽選、履歴 |
| シーズン | 自クラブの編成・戦術入力、全員完了、ホストのシーズン実行、結果確認 |
| オフシーズン | 契約・要求・特別特訓の個別ボタン、2名の育成/重点能力、成長確認、放出、次年度 |
| 最終年 | Season10の結果確認後にgame-complete、既存10年履歴画面へ |
| 同期基盤 | playerToken認証、phaseRevision、requestId、同じ要求の再送、Room内の直列処理、原子的な分割保存 |
| 構造整理 | MutationObserverを除去。画面分類をviewから明示。RoomClient/RoomAdapterはDOM非依存 |

## ファイルの責任

- `js/app.js`: 既存シングルの全画面と操作入口。Room固有描画は参加・ロビー・小さな同期表示だけ。
- `js/ui.js`: 既存共通部品。名前変更の保存先をcallbackで切替。
- `js/room-client.js`: 同一origin API、token、永続session、単一polling、古い応答排除、45秒の通信タイムアウト、同じrequestIdで送信確認。
- `js/room-adapter.js`: sessionのplayerIdによる自クラブ解決、snapshotの共通状態への変換、入力途中の保持。順位はRoomの確定順序を使い、自クラブの10試合を抽出。
- `js/phase-work.js`: 契約/放出の入力列をローカルpreviewとRoom側の双方で検証。編成・育成入力の検証。
- `worker/index.js`: 同一originのAPI転送と静的assets配信。
- `worker/room.js`: token照合、ホスト権限、phaseRevision/要求ID検証、DO保存。試合ログを1値128KiB以内の断片に分けてtransactionで保存。
- `worker/room-game.js`: Roomの進行、秘密入力集約、main由来のmarket/league/cpu/development/rulesの呼出し。
- `js/random.js`: 既存乱数列を変えず、DO再読み込み用のsnapshot/復元を追加。
- `wrangler.toml`: v3専用Worker名とDO migration。既存v2環境には接続しない。

既存app.jsの段階別renderラッパーは共通画面として残している。別のマルチrendererへコピーせず、シングルと同じ描画経路に接続することを優先した。全コードを新しいフレームワークへ移す変更ではない。

## V3-0計画からの具体化

v2のhost-only prepare→ホストブラウザ計算→advanceは、そのまま採用していない。
秘密入力・token・Room単位のフェーズ管理を参考にし、**計算と確定をRoom側へ集約**した。
クライアントは確定済みleague全体を送信できず、入力だけを送る。ホストにも未確定の他者入力やhiddenGrowthを配信しない。

公開snapshotのrootを限定し、すべてのネストからhiddenGrowth、seed、rngState、accessTokenを除去する。
認証した本人に限りownInputと自クラブのオフシーズン候補を返し、再読み込み後の完了状態を復元する。
順位の同点抽選にseedを再利用する必要がないよう、Roomで計算した順位を返す。

全員の入力が揃った時点でRoomが確定する。シーズンのシミュレート開始だけはホスト操作。
draft-complete / auction-completeを設け、シングルの完了画面と結果閲覧を維持したまま全員の確認を待つ。
ゲーム開始後の大型状態カード、各multiplayer-*.jsの独立描画、DOMからのroomId/phase取得はない。

## 維持したmain仕様

- ドラフト5pt、候補分布G15/F25/E40/D15/C4/B1。
- 放出選手の競売復帰ランク条件。
- 選手カード、並べ替え、編成枠、戦術、契約の個別ボタン、育成2段階の操作。
- シングルの既存計算・セーブ処理。RoomではSingleセーブUIへ入れず、参加情報から復帰する。
- 選手整理の最低5人/GK1人、CPU育成・編成、年度更新と最終年終了。

## チェック方法と結果

`npm run check`:

- 対象の全26 JavaScriptファイルを`node --check`で構文解析。
- アプリとWorkerのES module graphをVMでlinkし、import先と名前付きexportの不整合を検出（モジュールのevaluateはしない）。
- Room通信/変換層にDOM依存がないこと、実行コードにMutationObserverがないことを静的チェック。

`npm run build`:

- HTML/CSS/JSだけをdistへコピーする静的assets作成。Workerのデプロイやゲーム実行はしない。

構文チェックは実際のブラウザ操作、CPU時間、DO永続化API、レイアウト、再接続時の挙動まで保証するものではない。
既存テストの実行、新規動作テスト、複数人プレイ、Cloudflare上の検証、デプロイ、mainへの統合は今回の対象外。

## 動作確認時に残る項目

- 2人＋CPUと6人で開始し、ゲストの編成・結果・履歴が自クラブになること。
- 同時指名競合、辞退、全CPU待ち、同額入札、5pt未満の扱い。
- 契約判断の資金・最低人数、特訓、成長・加齢・資金処理が一度だけ反映されること。
- Season2〜10、最終年確認、全員のフェーズ一致。
- 再読み込み、ネットワーク断、確定直後のタイムアウト、二重送信、旧revision送信。
- 画面幅ごとの既存UI比較、フォーカス、モーダル、名前変更、並べ替え。
- Cloudflareでのmodule bundle・1シーズン計算時間・大きな試合ログ保存。

自動ホスト移譲、途中退出者のCPU置換、既存v2 Room移行は含めない。ホスト切断時は同じ参加情報で復帰する。
ローカルの未送信編集は同一タブのsessionStorageに保持し、参加tokenと結果不明の送信要求はlocalStorageに保持する。


## 2026-09-26 ロビーカラー仕様修正

マルチプレイではクラブカラーを参加者が選択せず、Roomサーバーが参加順に固定配列から自動割当する方式へ統一した。

参加順:
1. #4ade80
2. #60a5fa
3. #facc15
4. #fb7185
5. #a78bfa
6. #f97316

これにより同一ルーム内でクラブカラーが重複しない。クライアントからの任意カラー指定は送信・採用しない。
