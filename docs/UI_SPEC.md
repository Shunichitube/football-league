# FOOTBALL LEAGUE — UI仕様 v0.1

## 原則

本書をUI/UXの正本とする。ゲームルールと計算は `GAME_SPEC.md` を正本とし、UI側で変更しない。ダークグレーの背景、少し明るいカード、白〜薄灰の文字、ユーザークラブ色のアクセントを基調にする。情報はカードで整理し、内部能力値・hiddenGrowth・乱数・試合判定値・CPU評価額は通常UIに出さない。

PCは2カラム、スマホは1カラムで最低幅320pxに対応する。ページ全体の横スクロールは禁止し、表だけ局所スクロールを許可する。操作確認はモーダル、軽い通知はToast、危険操作は明確に区別する。

## 共通レイアウト

ゲーム進行中はヘッダーにタイトル、Season X / 10、クラブ名、順位、資金を置く。主要ナビは HOME / SQUAD / TABLE / STATS / RECORDS。スマホではコンパクト表示または下部固定ナビを用いる。

## 主要画面

| 画面 | 主な内容 |
| --- | --- |
| TITLE | NEW GAME / LOAD GAME / IMPORT SAVE、バージョン |
| NEW GAME SETUP | クラブ名、監督名、チームカラー、任意seed、CPUクラブ一覧 |
| HOME | 現在順位、勝点、資金、戦績、次節、ランキング・ニュース |
| SQUAD | 戦術、簡易コート、PIVO/ALA/ALA/FIXO/GK、控え、配置エラー |
| PLAYER DETAIL | 年齢、国籍、ポジション、ランク能力、調子、契約、成績、特殊能力 |
| MATCH PREVIEW / VIEW / RESULT | スタメン、スコアボード、イベントログ、結果、POTM、Rating |
| TABLE / STATS / RECORDS | 順位、個人成績、歴代・クラブ・選手記録 |
| オフシーズン | 育成、成長結果、契約、ドラフト、オークション、次季開始 |

### SQUAD実装（Stage 14）

- GK / FIXO / ALA / ALA / PIVOの5枠を表示する。
- 所属選手を選択して配置枠を押すと、共通の `SET_LINEUP` 処理を通して `club.lineup` へ反映する。
- スタメンと控えを分離し、双方のカードで名前、年齢、本職、総合、能力ランク、GK能力（GKのみ）、特殊能力を確認できる。
- 同一選手の重複、5枠未設定、所属外選手、GKのフィールド枠配置はエラーとして表示する。
- 本職以外への配置は警告を表示する。内部能力値と適性補正値は表示しない。
- 5人の有効なスタメンが揃っていない場合、試合開始操作を無効にする。
- 既存の選手詳細表示は維持する。

## Stage 1画面範囲

TITLE、NEW GAME SETUP、HOME、SQUAD、MATCH PREVIEW、MATCH VIEW、MATCH RESULTを実装する。HOME上の「次の試合」は単発試合であり、リーグ順位・ドラフト等はStage 2以降で追加する。結果ログは5〜10秒程度で進め、SKIP TO RESULTを備える。

## 表示の厳守事項

能力・OverallはSS〜Gのランクだけとし、`83` のような内部数値を表示しない。成長後に同ランクなら `B ↑`、ランク変化なら `B → A` と表示する。調子は↑ / − / ↓と文字を併記する。クラブカラーはヘッダー、カード、表、試合カードのアクセントに使い、背景全体には使わない。

## 画面遷移

基本の最終形は TITLE → NEW GAME → Season 1 DRAFT → AUCTION → SQUAD → HOME → MATCH PREVIEW → MATCH VIEW → MATCH RESULT → HOME。各シーズン終了後はSEASON END → DEVELOPMENT → GROWTH RESULT → CONTRACT → DRAFT → AUCTION → NEXT SEASONへ進む。Stage 1では NEW GAME → SQUAD → HOME → MATCH PREVIEW → MATCH VIEW → MATCH RESULT → HOME の部分だけを有効にする。
