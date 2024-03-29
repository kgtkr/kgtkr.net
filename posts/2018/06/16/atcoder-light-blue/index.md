---
title: AtCoderで水色になりました
date: "2018-06-16T15:32:26.000Z"
update: "2018-06-16T15:32:26.000Z"
tags: ["procon"]
name: atcoder-light-blue
lang: ja
otherLangs: []
---

ABC100で水色になりました。せっかくなので色々振り返ってみようと思います

# 競プロを始めるまで
主にWebプログラミングをやってました。というか今もやってますし、ずっとこっちがメインです。
Webと競プロはかなり文化が違うので競プロはかなり戸惑いました。
かなり昔にpaizaとか少しやった記憶ありますが全く解けませんでした。

# 初めてのコンテスト
初めてのコンテストは9/23の「CODE FESTIVAL 2017 qual A」、たまたまTLに流れて来たちょくだいさんのツイートに反応したらリプとフォロー貰えて嬉しかったので試しに参加してみました。
言語はJS、結果は1完で初期レート14。流石に無理だと思いしばらく競プロは放置していました。

# 初めてのABC
12月頃になると、何故か競プロerとかなり関わるようになりました。そして12/23に始めてのABC、「ABC083」に参加しました。
結果は3完。思っていたより解けたので楽しくなってきてABCは毎回出るようになりました(今の所ABCは皆勤です)。途中でAPCも出ました。

# Rust
C++が怖いのでCF2017以外のコンテスト本番は全部Rustで出ています。速くて書きやすいので最高。そもそも競プロを初めた理由の半分くらいはRustの勉強だったり。
入力値パーサーのマクロやサンプルケースから自動でRustのテストコードを吐くユーザースクリプトを作ったりしました。あとはライブラリ整備。
ただ競プロの情報が少ないのと、競プロerで出来る人がほとんどいないのが辛い

# 精進
2回くらいバチャに参加して、精進botで1位取るためにA問題埋めまくって()、C・Dを少し埋めました。
とりあえずC、DとAGCのAは埋めたい。

# 書籍
2/10に蟻本を買って軽く読み流して少しだけRustに移植しました。
めちゃくちゃ分かりやすかったです。
螺旋本とチーター本も欲しい。

# 覚えたアルゴリズムとか
* 幅優先探索
* ダイクストラ
* 累積和
* gcdとか素数列挙、約数、素因数分解とか
* クラスカル法
* Union Find
* ワーシャルフロイド

覚えたって書きましたが嘘です。全く覚えていませんし書けと言われてもgcdくらいしか書けません。
全部ライブラリ化してしっかりテストしてコピペで使えるようにしました。本番で実装したくない…

# これから
ABCはratedじゃなくなりました。はい。
AGCもARCも参加回数0(nosubmit撤退はあるが)なのでかなり怖い。スプラのウデマエ上がった時みたいにボコボコにされるんだろうなと思ってます。
とりあえず蟻本を読み直して、500点問題は安定させたいです。
水色中盤(1400)目標で頑張ります。
受験なんて知らねぇ

# リンク
* [AtCoderのユーザーページ](https://beta.atcoder.jp/users/kgtkr)
* [Rustの競プロライブラリ](https://github.com/kgtkr/procon-lib-rs)
