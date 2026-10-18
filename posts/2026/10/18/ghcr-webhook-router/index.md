---
title: アプリリポジトリとマニフェストリポジトリを疎結合に保ったまま、イメージビルド後即時にタグを書き換えたい
date: "2026-10-18T11:02:29.000Z"
update: "2026-10-18T11:02:29.000Z"
tags: ["kubernetes", "github-actions"]
name: ghcr-webhook-router
lang: ja
otherLangs: []
---

## はじめに
GitOpsでは、アプリケーションリポジトリと、マニフェストリポジトリを分離することが多いです。
この時、アプリケーションリポジトリのCI (GitHub Actionsを想定) でコンテナイメージをビルドした後に、マニフェスト側のイメージタグを書き換える仕組みを導入しようとすると、「アプリケーションリポジトリとマニフェストリポジトリを疎結合に保つこと」と「イメージビルド後に即座にマニフェストを更新すること」を両立するのが難しいです。

以前書いた記事「[自宅Kubernetesクラスタの紹介](/blog/2026/07/27/my-home-server-2026)」では継続的デプロイ周りについても紹介しました。自作のアプリケーションは master に push されると [kgtkr/docker-tags-gen-action](https://github.com/kgtkr/docker-tags-gen-action) を使って `20261017163538545-786e273-master` のようなタイムスタンプ付きタグを付与し、GitHub Container Registry に push しています。そして、マニフェストリポジトリ側で Renovate を動かすことで、マニフェストのイメージタグを自動更新するようにしていました。

これは疎結合であることを即時性より優先した仕組みです。
アプリケーションリポジトリのCIに、マニフェストリポジトリの存在を書いたり、マニフェストリポジトリへの書き込み権限を与えなくてよい一方で、Renovate が定期的に動くのを待たなければいけないため、イメージのpushからタグの書き換えPRが出るまでに1時間程度遅延が生じます。

もし、即時性を優先するのであればアプリケーションリポジトリのCIで、マニフェストリポジトリを書き換えてPRを出せば良いですが、(他に誰も使っている人がいなかったとしても)一応OSSであるリポジトリでそれをするのは気持ち悪いので避けてきました。

今回はこの問題を解決するために作った [ghcr-webhook-router](https://github.com/kgtkr/ghcr-webhook-router) の話をします。

## 作ったもの

[ghcr-webhook-router](https://github.com/kgtkr/ghcr-webhook-router) は、GHCR の Webhook を受けてマニフェストリポジトリに `repository_dispatch` イベントを中継する小さなルーターです。

```dot
digraph G {
  graph [rankdir=TB, compound=true, fontname="sans-serif", style="rounded", color="#999999", bgcolor="transparent"];
  node [shape=box, style="rounded", fontname="sans-serif", margin="0.2,0.1"];
  edge [fontname="sans-serif", fontsize=11];

  subgraph cluster_app {
    label = "App Repository";
    A [label="Git Push"];
    B [label="GitHub Actions"];
    C [label="GHCR", shape=cylinder];

    A -> B;
    B -> C [label="Image Push"];
  }

  subgraph cluster_router {
    label = "ghcr-webhook-router";
    R [label="Receive Webhook"];
    D [label="Send repository_dispatch"];

    R -> D;
  }

  subgraph cluster_cd {
    label = "Manifest Repository (public-cd)";
    WF [label="GitHub Actions: on-image-push\n\nRun Renovate"];
    Git [label="Git Commit", shape=cylinder];

    WF -> Git;
  }

  C -> R [label="Webhook: package published"];
  D -> WF [label="repository_dispatch: type=ghcr_package_published"];
}
```

## マニフェストリポジトリ側の設定

マニフェストリポジトリの設定は以下のようになっています。
`ghcr-webhook-router` は `repository_dispatch` を送信するだけの汎用的かつ小さなアプリであるため、マニフェストの書き換えロジックは全てここに実装します。

```yaml
name: on-image-push

on:
  repository_dispatch:
    types:
      - ghcr_package_published

concurrency:
  group: renovate-${{ github.event.client_payload.image }}
  cancel-in-progress: false

jobs:
  renovate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Generate Renovate Token
        uses: actions/create-github-app-token@v2
        id: app-token
        with:
          app-id: ${{ secrets.RENOVATE_APP_ID }}
          private-key: ${{ secrets.RENOVATE_APP_PRIVATE_KEY }}

      - name: Renovate Single Package
        uses: renovatebot/github-action@v43.0.0
        with:
          token: ${{ steps.app-token.outputs.token }}
        env:
          RENOVATE_REPOSITORIES: ${{ github.repository }}
          RENOVATE_FORCE: >-
            {
              "dependencyDashboard": false,
              "branchPrefix": "renovate-dispatch/${{ github.event.client_payload.package }}/"
            }
          RENOVATE_PACKAGE_RULES: >-
            [
              {
                "matchPackageNames": ["*"],
                "enabled": false
              },
              {
                "matchPackageNames": ["${{ github.event.client_payload.image }}"],
                "enabled": true
              }
            ]
```

ここでの Renovate の実行は `RENOVATE_FORCE` と `RENOVATE_PACKAGE_RULES` を使って設定を上書き・追加し、対象イメージのみ更新チェックをしています。
これを設定しないと、リポジトリ全体の (Helm チャートなども含む) 依存関係をチェックするため、実行に時間が掛かり、またAPIのレートリミットに引っかかるリスクも上がります。

## 最後に
このアプリは Vite+ / Hono と Gemini 4 Argon を試しに使ってみたかったので雑に作ったものです。
Geminiくん、月3000円で5TBのストレージとAIエージェントがついてくると考えると悪くないが、そろそろClaude契約するか悩み中…
