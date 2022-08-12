---
title: セキュリティキャンプ2022データベースゼミに参加してきました
date: "2022-08-12T08:16:25.254Z"
update: "2022-08-12T08:16:25.254Z"
tags: ["database", "rust"]
name: seccamp-database
lang: ja
otherLangs: []
---
## はじめに
8/8から8/12に行われたセキュリティキャンプ2022のデータベースゼミに参加してきました. このゼミでは, データベースの中でもトランザクションを中心に学び, 実装を行いました. 講師の星野さん([@starpoz](https://twitter.com/starpoz)), ありがとうございました.

## 作ったもの
Rust製のサーバ / クライアントモデルのkvsです.

* リポジトリ: https://github.com/kgtkr/tkvs
* 公開サーバ: https://tkvs.kgtkr.net

サーバはgrpcを使っているのでgrpcurlからも使えますが, セッションのTTL管理やbase64エンコードが大変なのでリポジトリに入っているcliクライアントを使った方がいいと思います.


### grpcurlでの使用例
```
$ grpcurl -d @ tkvs.kgtkr.net:443 kgtkr.tkvs.Tkvs/StartSession <<"EOD"
{}
EOD
{
  "sessionId": "xMBEVysIoKLIoHNRoR3SMMAlewSZEI3A",
  "ttl": "60"
}

$ grpcurl -d @ tkvs.kgtkr.net:443 kgtkr.tkvs.Tkvs/Get <<"EOD"
{
    "session_id": "xMBEVysIoKLIoHNRoR3SMMAlewSZEI3A",
    "key": "a2V5MQ=="
}
EOD
{
  
}

$ grpcurl -d @ tkvs.kgtkr.net:443 kgtkr.tkvs.Tkvs/Put <<"EOD"
{
    "session_id": "xMBEVysIoKLIoHNRoR3SMMAlewSZEI3A",
    "key": "a2V5MQ==",
    "value": "dmFsdWUx"
}
EOD
{
  
}

$ grpcurl -d @ tkvs.kgtkr.net:443 kgtkr.tkvs.Tkvs/Get <<"EOD"
{
    "session_id": "xMBEVysIoKLIoHNRoR3SMMAlewSZEI3A",
    "key": "a2V5MQ=="
}
EOD
{
  "value": "dmFsdWUx"
}

$ grpcurl -d @ tkvs.kgtkr.net:443 kgtkr.tkvs.Tkvs/Commit <<"EOD"
{
    "session_id": "xMBEVysIoKLIoHNRoR3SMMAlewSZEI3A"
}
EOD
{
  
}
```

## 何を作るか
ACID特性を満たすデータベースを実装することが目的なので, 最小の実装はインメモリ, インプロセスで動き, 同時に1つのトランザクションしか走らないget / put / delete / commit / abortができるkvsあたりを最初に目指し, その後に機能を拡張していくことになります. isolation は複数の isolation level が考えられますが, 今回は serializable を選びます. serializable というのは並列で動いているトランザクションの実行結果が一致するような, 直列なトランザクションの実行順が存在するというisolation levelです.


## 最小構成の実装
最小構成の実装だと複数のトランザクションが同時に動くことはないので, 独立性は自動的に満たされます. よって, どうやってatomicに永続化するかというのが主な部分となります.
この構成では, commit済みデータのMap, commit前のデータのMapを持ち, commitする時は永続化を行い(後述), commit前のデータをcommit済みデータに適用し, commit前のデータをクリア, abortする時はcommit前のデータをクリアします. commit前のデータは「未確定の削除」という情報も保持する必要があるのでcommit前のデータは `BTreeMap<Bytes, Option<Bytes>>` のようなものになります. `None` が入っているkeyは削除を表します. get時はcommit前のほうにデータがあればそちらから, なければcommit済みデータから読みましょう.
永続化はlogファイルに追記という形で行いますが, 突然マシンがクラッシュしてもデータが壊れないようにする必要があります. そこで, 各レコード(DBのレコードではなくlogファイルの1レコード)にハッシュ値を付与し `bodyのサイズ,bodyのハッシュ値,body` のようなバイナリ形式で保存します. 読み込み時にハッシュ値をチェックすることで途中までしか書き込めなかったレコードは捨てます. このDBではlogファイルの1レコードは1トランザクションである `BTreeMap<Bytes, Option<Bytes>>` になります. このデータのエンコード形式は本質ではないのでserde+bincodeを使いました. 1レコード1トランザクションで, 各レコードはハッシュ値がついているので完全な状態でないレコードは捨てられることで, トランザクションの原子性を満たすことができます. また永続化が終わってからコミットに成功したと通知することで永続性も満たされます. バッファのflushやfsyncを忘れないようにしましょう.
また, logファイルへの追記だけだと更新や削除された古い値がいつまでも残り, ストレージを圧迫するので適当なタイミングでsnapshotを取りましょう. これはcommit済みデータである `BTreeMap<Bytes, Bytes>` を `snapshot.tmp` のようなファイルに書き込み, 書き込みが終わったらrenameします. よく使うatomicなファイル永続化ですね. これが終わったらlogファイルを削除 or truncateします. もしsnapshotの永続化が完了したが, logファイルの削除が終わっていないタイミングでクラッシュしても, logファイルの適用は少し考えると冪等であることが分かるので問題ないです.

## 並行にトランザクションを動かしたい
せっかくなら並行にトランザクションを動かせるようにしたいですよね. 今回実装したものは, DB本体, 各トランザクション同士がメッセージパッシングなどによってやり取りを行い, それぞれは直列に動いているという設計です. DB本体と, 各トランザクション同士は並列に動いていますが, あまりCPUを生かせている実装とは言えません.
それでも, 考えることは一気に増えます.
例えば postgres だと read committed がデフォルトなので non repeatable read が許されています. non repeatable read は以下のような動作です.

```
trx1.get("key1") // x
trx2.put("key1", "y")
trx2.commit()
trx1.get("key1") // y
```

このように1つのトランザクションで複数回getした結果が, 他のトランザクションが commit したデータによって結果が変わることがあります.
しかし serializable ではこの動作は許されないので何らかの排他制御が必要です.
例えば, 一度読んだデータをトランザクションが保持し, 以降の get ではそのデータを読む, コミット時に持っている読んだデータと, DBのデータを比較し, 変化があれば直列化エラーでコミットを失敗させるという楽観的な方法です. ただ, こちらの方法はあまりに実装が自明で面白くなさそうだったので, 悲観的なロックを取る方法で実装を行いました. こちらの方法では, 各レコードが現在のロック状態と, ロックを持っているトランザクションの一覧(readロックなら複数個がありえる), readロックを待っているトランザクションの集合と, writeロックを待っているトランザクションのキューを持ちます. そしていい感じに read lock, write lock, unlock の処理を実装します. この実装はコーナーケースに気をつけてひたすら分岐するといったものになります. 例えばコーナーケースとしては, 既に read ロックを持っているトランザクションが write ロックを取ろうとした時に, 他のトランザクションが read ロックを持っているかによって, 待つか, writeロックに昇格させるかが変わったり, read　ロックの　unlock　時に他にread ロックを持っているトランザクションがあるかによって処理が変わったりといったものがあります.
そして悲観的ロックということは当然デッドロックも存在します. 今回はトランザクション同士の待機関係を依存関係グラフにし, 閉路を検出することでデッドロックが発生するようなロックは拒否するという設計にしました. 当然それなりに重い計算などでタイムアウトなどでもいいですが, こっちのほうが面白そうだったので.


## range クエリを実装したい
使っているデータ構造が `HashMap` ではなく `BTreeMap` なのは range クエリを実装する伏線です. ということで range クエリを実装します.
rangeクエリは `BTreeMap::range` を使えば終わり…ではありません. 何故なら isolation level が serializable だからです. read committed や, それより1段階厳しい repeatable read であればこれで終わりですが, serializable では phanom read と呼ばれる以下のような動作を防がなければいけません.

```
trx1.range("a", "z") // b=1, p=2
trx2.put("d", "3")
trx2.commit()
trx1.range("a", "z") // b=1, d=3, p=2
```

trx 1の2回の range の結果のキー集合が違いますね. もし, `b` や `p` の値が違えばこれは non repeatable read なので既にロック機構によって防がれていますが, `d` という新たなキーが追加されるというのは別の話です. 悲観的な方法では, 範囲ロックを行い, ロック範囲を分割したり統合したりを上手くやってとなるのでしょうが, 複雑すぎて実装できる気がしなかったので, ここに関しては次のような楽観的な方法を使いました. range クエリの結果の key 集合を記憶しておき, commit 時にもう一度 range を行い結果が一致するかを確認して一致しなければ直列化エラーにします. range クエリでは複数回の実行の結果が異なることはありえますが, commit時に直列化エラーになるという設計です. こういう設計なので, コミットするまで結果を信じてはいけません. ちなみに存在するキーに関しては get と同じように悲観的なロックがかけられます. get は存在しないキーに関しても悲観的なロックを行うので, get が完全に range の特殊な場合とはなっていません.

## クラッシュテスト

## 学び
ファイルシステムや, データベースが何をどこまで保証してくれているかということをある程度理解することができました.
WebのAPIサーバだと, 基本的に状態はDBに永続化するので, ファイルシステムへの永続化で気をつけるべきことというのは少し話を聞いたことがある程度の理解でした. しかし, 実際に触ってみると思っていた以上に気をつけるべきことが多いので, 基本的にDBに永続化, ファイルを扱う時はある程度高レベルなatomicなファイル操作のライブラリなどを使うべきだという気持ちになりました. 
DBについてはそれなりに使っているにも関わらず, 特にisolationの理解が適当で, isolation levelを知らなかったので「複数のトランザクションを並列に実行しても直列に実行した結果と一致するようにしてくれるらしいけど, そんなものを効率良く実装できる魔法のようなアルゴリズムってあるのだろうか」という軽い疑問はありましたが, 深く調べたことがあったわけでもなく, 事前課題で少し調べて, そんな魔法のようなものはやっぱりなかったと知った時は驚きましたし, もっと気をつけて使うべきだと感じました. こういう薄い理解で魔法のようだと思っていたものが, そうじゃなかったと分かる瞬間って楽しいですね.
またtokioの今まで使ったことなかった機能を使う機会になったのも大きかったです. こちらもAPIサーバだと状態はDBが持ち, ジョブキューも外部のシステムを使い…といった感じでなるべくステートレスに実装することが多いので, そうでない並列なアプリケーションを実装するいい機会になりました.