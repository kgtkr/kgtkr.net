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

## 背景・モチベーション
C/Rustなどの静的型付け言語は、AOTコンパイラによってWasmに変換することで、Webブラウザ上で高速に実行することができるようになっています。
一方で動的型付け言語は、インタプリタをWasmにコンパイルして実行したり、動的型情報を使わないAOTコンパイラによってWasmに変換して実行することが一般的であり、性能に限界があります。
そこで、Webブラウザ上で高速に動的言語を実行するために、Wasmを生成するSchemeのJIT処理系を実装しました。





## 各種リンク
* [kgtkr/webschembly (23c80dd)](https://github.com/kgtkr/webschembly/commit/23c80dd8bf58b40468646dfa43189e722caccc3c)
* [Playground](https://kgtkr.github.io/webschembly/)
* [PPL 2026](https://jssst-ppl.org/workshop/2026/index.html)
  * 「WebAssemblyを対象とした基本ブロックバージョニング方式JITコンパイラ」というタイトルでポスター発表してきました
* [WebAssemblyに関数単位でJITする言語を実装した](2022/04/04/wasm-per-function-jit-language)
  * 4年前に書いた記事です。Wasmで動的なコード生成を行う小さな処理系を作ったことについての解説を行っています

修論はそのうち大学のリポジトリで公開されたらリンク追加します。
