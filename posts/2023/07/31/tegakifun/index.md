---
title: 手書き風画像生成Webサービスを大学で作った話
date: "2023-07-31T09:18:07.150Z"
update: "2023-07-31T09:18:07.150Z"
tags: ["university","webdevelopment","tegakifun","rust","typescript","react","graphql","actix-web","recoil","relay","sqlx","juniper"]
name: tegakifun
lang: ja
otherLangs: []
---

## はじめに
2022年度の大学のプロジェクトで(今更すぎる)手書き風の画像を生成するWebサービスを開発したのでそれについての話です。

## リンク
* [tegaki.fun](https://tegaki.fun)
  * サービスのURL
* [nkmr-lab/average-character-cloud-backend](https://github.com/nkmr-lab/average-character-cloud-backend)
  * バックエンドのリポジトリ
* [nkmr-lab/average-character-cloud-frontend](https://github.com/nkmr-lab/average-character-cloud-frontend)
  * フロントエンドのリポジトリ
* [nkmr-lab/average-figure-drawer](https://github.com/nkmr-lab/average-figure-drawer)
  * 平均手書き文字(手書き文字の合成文字)を生成するライブラリのリポジトリ。研究室で数年前に作られた物をTypeScript化(不完全)するなどしただけで、上2つと違って1人で書いたわけではない。

## サービスの概要
以下の画像のように、上のテキスト欄に文章を入力すると、その文章に対応する手書き風の画像を生成してくれます。背景画像はユーザが用意してきて、それに合わせて文字サイズや書字方向、行間字間などを設定する仕様です。各文字は、ユーザが登録した手書き文字を元に平均手書き文字という手法で生成されていますが、平均化するには1字につき複数の字体を登録する必要があり大変なので、デフォルトでは、許可された他のユーザが書いた文字も平均化に取り入れるような仕様になっています。
![サービスのスクリーンショット](tegakifun.png)

まだ字が登録されていない場合は、以下の画像のように警告が表示されるのでクリックすることで字を書けるようになっています。登録画面を完全な別ページではなく個別のパスが割り振られたモーダルを使うといったUIはTwitter風のあれですね。最初は別ページでしていましたがあまりに使いにくかったので。
![存在しない文字](not_found.png)
![字を書く](draw.png)

後は、書いた文字の一覧を、それらを合成した時のプレビューページもあったりします。
![文字一覧](list.png)

## バックエンド
バックエンドは言語はRustでactix-web(Webフレームワーク)+juniper(GraphQLライブラリ)、sqlx(SQLライブラリ)あたりを使っています。ずっとここらへんの技術スタックでバックエンド書きたいと思っていたので、今回いい機会でした。作った感想としてはかなり使いやすかったです。特にsqlxが生SQLの変なDSL覚える必要がないし、複雑なSQLも書けるという利点と、ORMの型安全(物による)という利点の量取りができてもうORMには戻れませんね。このプロジェクトを研究室内で誰が引き継ぐんだという問題点はありますが…(Rustなんて当然触ったことある人いないし、フロントエンドもVue派が多数なのにReact+Relay+RecoilでおまけにConcurrent Reactの機能もわりと使っていたり…)

技術スタック自体はわりとレアですが、まあ普通のCRUD APIです(説明するよりコード読んだ方が早いと思う)。昔紹介した[「sqldefをマイグレーションコード生成ツールとして使う
」](/blog/2022/02/10/sqldef-for-generate-migration)を使っていたり、
`serde-env` で[環境変数のデコードをしていたり](https://github.com/nkmr-lab/average-character-cloud-backend/blob/7f3a6df495985da7932ebdd881529db529715e72/src/app_config.rs)(これに使うためにenum対応PRを投げたりした)まあここらへんは便利です。

### API設計
フロントエンドでRelayを使いたいので[GraphQL Server Specification
](https://relay.dev/docs/guides/graphql-server-specification/)を満たすようなAPIにする必要があります。

まず、`id` フィールドはグローバルに(異なる型であっても)一意でなければいけません。またbase64でエンコードすることが推奨されているので `Hoge` 型の `xxx` というidであれば `Hoge:xxx` をbase64エンコードしたものにしました。しかし、`xxx` が欲しい場合もあるので `id` フィールドはgraphQLのidという扱いにし、ドメイン層のidである `xxx` は `hogeId` というフィールドに別に入れています。

また、mutationのエラーはGraphQLのエラーではなくエラー型の配列として返した方がフロントエンドから扱いやすいです(Goのような感じ)。あとは `Query` 型にはとりあえず `query: Query!` を定義しておきましょう。これがあると `Query` 型の `fragment` を定義できるようになるなどフロントエンド側で嬉しいことがあります。

### エラー処理
juniperのエラー処理について便利な方法を紹介しておきます。APIのエラーは大きくバリデーションエラーのようなユーザの不正な入力が原因のエラーと、DB接続エラーのような内部エラーに分けられます。後者はエラーログに記録する必要がありますし、ユーザに詳細メッセージを返すことはセキュリティ上適切ではありません。juniperでは、`IntoFieldError` を実装した独自のエラー型を定義できるので、これを上手いこと扱える仕組みが欲しいです。[ソースコード](https://github.com/nkmr-lab/average-character-cloud-backend/blob/7f3a6df495985da7932ebdd881529db529715e72/src/graphql/common.rs#L14)

そこで、`GraphqlUserError` と `ApiError` という2つの `anyhow::Error` のnewtypeを用意します。`GraphqlUserError` は `Error` トレイトが実装してあるので `anyhow::Error` に変換できます。こうすることで `anyhow::Error->GraphqlUserError->anyhow::Error` という変換が可能になり、これは `GraphqlUserError`であるというマーカの役割になります。今回は `GraphqlUserError` というマーカがついていればユーザが原因のエラー、そうでなければ内部エラーという扱いにしました。

そして `ApiError` に `IntoFieldError` を実装します。このトレイトでjuniperが要求する形式への変換関数を定義する必要があります。この変換処理の中で、`GraphqlUserError` へのダウンキャストを試み、成功すればユーザに詳細メッセージを返す、失敗すれば詳細メッセージはエラーログに記録し(変換関数で副作用を起こすのはどうなのかという問題はありますが他にいい方法が見当たらなかった)、`Internal error` というメッセージのみを返すということを行なっています。

### N+1問題
GraphQLといえばみんな大好きN+1問題です(過言)。これを解決するには `dataloader` クレートを使うのですが、GraphQL APIを作るには `HashMap<Param, Loader<Key, Value>>` のような役割の異なる `Param, Key` という2つの値を受け取れるものがあると便利なので[ラッパー](https://github.com/nkmr-lab/average-character-cloud-backend/blob/7f3a6df495985da7932ebdd881529db529715e72/src/dataloader_with_params.rs)を作りました(`DataloaderWithParams`)。

`Param, Key` (独自用語)を説明するために以下のようなクエリを考えてみましょう。

```graphql
query {
  users {
    hoge: posts(
      filter: "hoge" # Params
    ) {
      title
    }
    foo: posts(
      filter: "foo" # Params
    ) {
      title
    }
  }
}
```

この時 `posts` は暗黙の引数(?)として親の`user`を受け取ります。この場合の親の`user`を `Key` と呼びます。親の`user`はいくつになるか分からないので、単純な実装だとN+1回のSQLを投げてしまうというのがN+1問題です。また、明示的なひきすうとして`filter` も受け取ります。この場合の`filter`を `Param` と呼びます。`filter` は親の`user`に依存することはないので、このパラメータのパターン数は高々クエリの長さに比例します。よって、異なるfilterに対して複数回のSQLを投げても大きな問題にはなりませんし、ここまでまとめようとするとSQLが複雑になりすぎてしまいます。

以上の理由から、`Param` が異なる場合はSQLを別々に投げたいですし、そうでなければ `Key` が異なっていてもなるべくSQLをまとめたいです。そこで `Param` ごとに `Loader` を自動的に作って、いい感じにクエリをまとめてくれるような型が `DataloaderWithParams` です。

## フロントエンド
フロントエンドは言語はTypeScriptでReact / Recoil(状態管理ライブラリ) / Relay(GraphQLライブラリ)あたりを使っています。全体的に使いやすかったのですがRecoil最近更新があまりされているようなので少し不安ですね。

### Fragment Colocation
GraphQLのFragment Colocationというものがとても便利でした。解説記事が沢山あるのでここでは詳細は書きませんが、簡単にいうと、コンポーネントごとに欲しいデータをfragmentとして定義しておき、それをまとめてルートのコンポーネントでfetchすることができるというものです。これによってデータを一回のクエリでfetchすることができます。特にRelayでは他のファイルで宣言したfragmentのプロパティにはアクセスできないという厳密なカプセル化がされているので、カプセル化とデータをまとめてfetchしたいという2つの両立が可能です。

### recoil-relay
ほとんど更新がされていないのとpaginationに対応していなかったり、[データの再フェッチができない](https://github.com/facebookexperimental/Recoil/issues/2127)といった問題があるので、公式の組み合わせだと思って使うと痛い目にあいます。このライブラリがなくてもrecoilと組み合わせることはできるので、基本的に使わなくていいでしょう。

### キャッシュの更新
![Staleness of Data](https://relay.dev/docs/next/guided-tour/reusing-cached-data/staleness-of-data/)あたりを読むとデータの再フェッチの方法が分かると思います。

単一のデータであればドキュメント通りですが、複数のデータの(例えば `user` が持っている `posts`)配列が更新された場合どうするかという問題があります。これは例えば `user` 自体を `invalidateRecord` してしまうのが手っ取り早いです。こうすることで `user` に属する `posts` も再フェッチできます(当然 `useSubscribeToInvalidationState` で `user.id` を監視する必要がありますが)

### SuspenseのPromiseの管理をrecoilに任せる、selectorFamilyにRecoilValueを渡す
Reactの `Suspense` に対応したデータロード関数を作るにはReact外でのグローバルなデータ管理の仕組みが必要です。例えばRelayだったり、Recoilのasync selectorは特に何も考えなくてもこれを行なってくれますが、独自で作ろうとすると単純な実装であればともかく、メモリリークを防ぐといったことまで考慮するととても大変です。

今回は、文字を合成処理を全てフロントエンドでやっている関係で(本来はバックエンドでしてキャッシュするべきだが平均文字ライブラリはTSだが、バックエンドはRustであるという問題があり、ここだけマイクロサービスにするのも手間だしで手を抜いた)パフォーマンス上の理由から(数値計算をかなりしているのでCPUを食う)WebWorkerを使っているのですが、この処理をSuspenseに対応させるのにどうしようかという問題がありました。

そこで汎用的なPromiseの管理場所としてのrecoilの `selectorFamily` の出番です。`selectorFamily` はパラメータを受け取ることができるので、何も考えずにasync関数を定義するだけで勝手にグローバルなPromiseの管理をしてくれます。便利ですね。

ところで `selectorFamily` は `Map<Parameter, Selector>` のようなものを作る関数なので、引数のパターン数が多すぎるとメモリ効率が悪いです。また、パラメータに使える型にはシリアライズ可能である型である必要があるという制限があります。そこで、`selectorFamily`に`RecoilValue` (atomやselectorの親の型)を渡せるという仕様を利用します。こうすることで、渡せる値に制限がなくなり、またMapの要素数の増加を抑えることができます。

### useTransition
画像生成処理は `useTransition` を上手く使うことでパラメータ変更による再生成時のローディング表示を抑えることができ、使いやすくなりました[ソースコード](https://github.com/nkmr-lab/average-character-cloud-frontend/blob/80f3ac7de7a92a4822864d43f2e1142b78b0ad60/packages/client/src/pages/Generate.tsx)。スライダーの更新などは `react-use` の `useDebounce` を使って更新頻度を下げることでCPU負荷を下げる必要がありますが、この関数の第一引数に渡すコールバックで `startTransition` を使うことで上手く組み合わせることができます。
