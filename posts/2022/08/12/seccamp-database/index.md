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
8/8から8/12に行われたセキュリティキャンプ2022のデータベースゼミに参加してきました. このゼミでは, データベースの中でもトランザクションを中心に学び, 実装を行います. 講師の星野さん([@starpoz](https://twitter.com/starpoz)), ありがとうございました.

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
