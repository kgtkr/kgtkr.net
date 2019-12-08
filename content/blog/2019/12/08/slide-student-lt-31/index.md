---
title: 「第31回 学生LT in 東京」に登壇しました〜RustでWebAssemblyのインタプリタを作った話〜
date: "2019-12-08T06:08:28.497Z"
update: "2019-12-08T06:08:28.497Z"
tags: ["webassembly", "stage"]
name: slide-student-lt-31
lang: ja
otherLang: []
---

## 資料
31回だったのに32回と勘違いしててURLが32になっていますが気にしないでください。ライブデモ多いので多分LT資料だけじゃよく分かりません。
https://gitpitch.com/kgtkr/slide-student-lt-32

## LT動画
<iframe width="560" height="315" src="https://www.youtube.com/embed/wliAxst_U9s" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## 内容
* 自己紹介
* wasmに関する説明
  * watについて(watコード読みながら解説した)
  * wasm(バイナリ)について(wasmバイナリ読みながら解説した)
* rustでwasmインタプリタ作った話
  * デコーダー
  * エンコーダー
  * スタックマシン
* 自作言語 on 自作インタプリタ(ライブデモ)
* 自作言語 on 自作インタプリタ on 自作インタプリタ(ライブデモ)

## 補足資料とか
* 成果物: https://github.com/kgtkr/wasm-rs
* wasm仕様書: https://webassembly.github.io/spec/core/index.html
* 自作言語などについて(去年のアドカレ)
  * [WebAssemblyでメモリアロケータを実装](https://qiita.com/kgtkr/items/7274845506f0b6a47373)
  * [WebAssemblyでGCを実装する](https://qiita.com/kgtkr/items/f61612a82b8bebe779aa)
  * [WebAssemblyにコンパイルする言語を実装する](https://qiita.com/kgtkr/items/de4c616cdcd89a58df72)
* wasmバイナリ読んでましたが低レイヤーは本当に何も分かりません。Webの人です。
* 今年のwasmアドカレ(22日)に詳細投稿します
  * https://qiita.com/advent-calendar/2019/wasm

## 反省・感想
LT前にLT資料TwitterにあげようとしたらTwitter落ちててツイートできないというトラブルがありましたが、LT中に復活してくれたおかげで感想ツイは見れたのでよかったです。  
反省としてはとにかく言葉が聞き取りづらい事ですね。見返してみてびっくりしたんですけど緊張しすぎですね。発表慣れしないとなと思いました。また他の人のLT資料と比べて作りが雑なのでもう少し作り込もうと思いました。初めてgitpitch使ってみましたが設定とかもう少し調べていい感じにしたいです。あとはブログでもなんですが人に分かりやすく説明する能力まだまだ足りないのでがんばります。  
良かった点は制限時間に間に合ったことです。数回1人で試したときは20分弱くらい掛かってましたが内容少し削ったり急いで進めることで15分で終わりました。wasmバイナリライブリーディングと、自作言語 on 自作インタプリタ on 自作インタプリタあたりはめっちゃツイートされてて嬉しかったです。  
