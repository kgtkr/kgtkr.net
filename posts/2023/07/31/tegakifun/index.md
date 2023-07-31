---
title: 手書き風画像生成Webサービスを大学で作った話
date: "2023-07-31T09:18:07.150Z"
update: "2023-07-31T09:18:07.150Z"
tags: ["university","webdevelopment","tegakifun"]
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

## 
