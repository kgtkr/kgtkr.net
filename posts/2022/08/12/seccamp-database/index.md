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
ACID特性を満たすデータベースを実装することが目的なので, 最小の実装はインメモリ, インプロセスで動き, 同時に1つのトランザクションしか走らないget / put / delete / commit / abortができるkvsあたりを最初に目指し, その後に機能を拡張していくことになります.


## 最小構成の実装
最小構成の実装だと複数のトランザクションが同時に動くことはないので, 独立性は自動的に満たされます. よって, どうやってatomicに永続化するかというのが主な部分となります.
この構成では, commit済みデータのMap, commit前のデータのMapを持ち, commitする時は永続化を行い(後述), commit前のデータをcommit済みデータに適用し, commit前のデータをクリア, abortする時はcommit前のデータをクリアします. commit前のデータは「未確定の削除」という情報も保持する必要があるのでcommit前のデータは `BTreeMap<Bytes, Option<Bytes>>` のようなものになります. `None` が入っているkeyは削除を表します.
永続化はlogファイルに追記という形で行いますが, 突然マシンがクラッシュしてもデータが壊れないようにする必要があります. そこで, 各レコード(DBのレコードではなくlogファイルの1レコード)にハッシュ値を付与し `bodyのサイズ,bodyのハッシュ値,body` のようなバイナリ形式で保存します. 読み込み時にハッシュ値をチェックすることで途中までしか書き込めなかったレコードは捨てます. このDBではlogファイルの1レコードは1トランザクションである `BTreeMap<Bytes, Option<Bytes>>` になります. このデータのエンコード形式は本質ではないのでserde+bincodeを使いました. 1レコード1トランザクションで, 各レコードはハッシュ値がついているので完全な状態でないレコードは捨てられることで, トランザクションの原子性を満たすことができます. また永続化が終わってからコミットに成功したと通知することで永続性も満たされます. バッファのflushやfsyncを忘れないようにしましょう.
また, logファイルへの追記だけだと更新や削除された古い値がいつまでも残り, ストレージを圧迫するので適当なタイミングでsnapshotを取りましょう. これはcommit済みデータである `BTreeMap<Bytes, Bytes>` を `snapshot.tmp` のようなファイルに書き込み, 書き込みが終わったらrenameします. よく使うatomicなファイル永続化ですね. これが終わったらlogファイルを削除 or truncateします. もしsnapshotの永続化が完了したが, logファイルの削除が終わっていないタイミングでクラッシュしても, logファイルの適用は少し考えると冪等であることが分かるので問題ないです.

## 学び
ファイルシステムや, データベースが何をどこまで保証してくれているかということをある程度理解することができました.
WebのAPIサーバだと, 基本的に状態はDBに永続化するので, ファイルシステムへの永続化で気をつけるべきことというのは少し話を聞いたことがある程度の理解でした. しかし, 実際に触ってみると思っていた以上に気をつけるべきことが多いので, 基本的にDBに永続化, ファイルを扱う時はある程度高レベルなatomicなファイル操作のライブラリなどを使うべきだという気持ちになりました. 
DBについてはそれなりに使っているにも関わらず, 特にisolationの理解が適当で, isolation levelを知らなかったので「複数のトランザクションを並列に実行しても直列に実行した結果と一致するようにしてくれるらしいけど, そんなものを効率良く実装できる魔法のようなアルゴリズムってあるのだろうか」という軽い疑問はありましたが, 深く調べたことがあったわけでもなく, 事前課題で少し調べて, そんな魔法のようなものはやっぱりなかったと知った時は驚きましたし, もっと気をつけて使うべきだと感じました. こういう薄い理解で魔法のようだと思っていたものが, そうじゃなかったと分かる瞬間って楽しいですね.
またtokioの今まで使ったことなかった機能を使う機会になったのも大きかったです. こちらもAPIサーバだと状態はDBが持ち, ジョブキューも外部のシステムを使い…といった感じでなるべくステートレスに実装することが多いので, そうでない並列なアプリケーションを実装するいい機会になりました.
