---
title: WebAssembly向けのScheme JITコンパイラを実装した
date: "2026-03-11T03:22:55.787Z"
update: "2026-03-11T03:22:55.787Z"
tags: ["webassembly", "languageprocessor", "rust", "webschembly", "university"]
name: webassembly
lang: ja
otherLangs: []
---

## はじめに
修論のためにWebAssembly向けのScheme JITコンパイラを実装したので、それについての解説記事です。

## 各種リンク
* [kgtkr/webschembly (23c80dd)](https://github.com/kgtkr/webschembly/commit/23c80dd8bf58b40468646dfa43189e722caccc3c)
* [Playground](https://kgtkr.github.io/webschembly/)
* [PPL 2026](https://jssst-ppl.org/workshop/2026/index.html)
  * 「WebAssemblyを対象とした基本ブロックバージョニング方式JITコンパイラ」というタイトルでポスター発表してきました
* [WebAssemblyに関数単位でJITする言語を実装した](2022/04/04/wasm-per-function-jit-language)
  * 4年前に書いた記事です。Wasmで動的なコード生成を行う小さな処理系を作ったことについての解説を行っています

修論はそのうち大学のリポジトリで公開されたらリンク追加します。

## 背景・モチベーション
C/Rustなどの静的型付け言語は、AOTコンパイラによってWasmに変換することで、Webブラウザ上で高速に実行することができるようになっています。
一方で動的型付け言語は、インタプリタをWasmにコンパイルして実行したり、動的型情報を使わないAOTコンパイラによってWasmに変換して実行することが一般的であり、性能に限界があります。
そこで、Webブラウザ上で高速に動的言語を実行するために、Wasmを生成するSchemeのJIT処理系を実装しました。

## 基本方針
* R5RS準拠を目指す
  * 必要最低限の機能だけを実装してJITのほうに力を入れたのでかなりの機能が未実装…。継続以外で実装が無理な機能はなさそうだけど継続はどうしようという状況です
* Wasm GCを使う
* ランタイムはRust+Watで書く
* YJITなどで採用されているBasic Block Versioning (BBV)というJIT手法を使う

### Basic Block Versioning
BBVとは基本ブロックの入力変数の型によって基本ブロックを複製していくJIT手法です。
例えば以下のようなSchemeの関数を考え、この関数を整数引数で呼び出すことを考えます。

```
(define (sum-rec n m)
  (if (= n 0)
    m
    (sum-rec (- n 1) (+ m n))))
```

この関数の制御フローは以下のようになります。この時点では多くの型チェックが残っていることが分かると思います。

![sum-cfg.png](sum-cfg.png)

BBVでは「実際に実行されたBBのみを入力変数の型で特殊化して特殊化してコンパイルする」という戦略を取ります。
そのため初期状態では、基本ブロックは1つもコンパイルされておらず、到達するとコード生成を行い、生成コードを実行する「スタブ (Stub)」のみが存在します。

![sum-bbv-1](sum-bbv-1.png)

スタブに到達すると次の条件分岐までコンパイルが進みます。
また条件分岐が型チェックの場合は、判明した型情報を次のスタブに渡します。

![sum-bbv-2](sum-bbv-2.png)

最終的には以下のようになります。
ここではBBだけでなく、引数の型に基づいてクロージャのエントリーも複製しています (他にもクロージャがキャプチャした変数の型によっても複製しています)。

![sum-bbv-3](sum-bbv-3.png)

こうすることで最も頻繁に実行される部分については、動的型チェックなしでループが回るようになります。

