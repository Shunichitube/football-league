# Cloudflare 初回公開

開発ブランチ: `dev/multiplayer-v2`。mainは公開先に指定しない。

Workerと画面を1つのWorkersアプリとして公開する。`/api/*` は既存Worker、その他は画面の静的ファイルを配信する。Pages用の別API URL設定は不要。

## 手元から公開

対象ブランチを取得したフォルダーで実行する。

```sh
npx wrangler@4 login
npx wrangler@4 deploy
```

ブラウザーでCloudflareへログインし、対象アカウントを確認する。deploy時に画面用distを自動生成し、ROOMS Durable Objectも既存設定で作成する。

CloudflareのGit連携を使う場合はWorkersでこのリポジトリと開発ブランチを選び、デプロイコマンドを `npx wrangler@4 deploy` にする。ルートはリポジトリ直下。別のビルドコマンドは不要（Wranglerが実行）。

## 公開直後の最小確認

1. 発行されたworkers.dev URLでタイトルが表示される。
2. 同じURLの `/api/health` がokを返す。
3. 通常ブラウザーと別ブラウザーでルーム作成・参加・準備完了を確認する。

公開・実通信確認はまだ未実施。まず少人数の動作確認用として使用する。
