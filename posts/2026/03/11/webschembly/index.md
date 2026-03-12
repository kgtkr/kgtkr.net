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
C / Rustなどの静的型付け言語は、AOTコンパイラによってWasmに変換することで、Webブラウザ上で高速に実行することができるようになっています。
一方で動的型付け言語は、インタプリタをWasmにコンパイルして実行したり、AOTコンパイラによってWasmに変換して実行することが一般的であり、性能に限界があります。
そこで、Webブラウザ上で高速に動的言語を実行するために、Wasmを生成するSchemeのJIT処理系を実装しました。

## 基本方針
* R5RS準拠を目指す
  * 必要最低限の機能だけを実装してJITのほうに力を入れたのでかなりの機能が未実装…。継続以外で実装が無理な機能はなさそうだけど継続はどうしようという状況です
* Wasm GCを使う
* ランタイムの実装言語はRust / Wat / JS
* YJITなどで採用されているBasic Block Versioning (BBV)というJIT手法を使う
* 中間表現としてSSAの独自IRを使う

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

## WasmでBBV
BBVの実装には動的なコード生成と、生成コードに遷移するために任意アドレスへのジャンプが必要ですが、Wasm単体ではどちらも機能がありません。

### 動的なコード生成
動的なコード生成については過去記事でも解説したようにJSと組み合わせることで簡単に実装できます。これは以下のような関数をWasmにimportし、これをランタイムから呼び出すことにより可能です。

```
js_instantiate: (bufPtr, bufSize) => {
  const buf = new Uint8Array(
    runtimeInstance.exports.memory.buffer,
    bufPtr,
    bufSize,
  );

  const instance = new WebAssembly.Instance(
    new WebAssembly.Module(buf),
    importObject,
  );

  instance.exports.start();
}
```

### 生成コードへの遷移
BBVでは基本ブロック単位でコンパイルを行い、生成コードに遷移する方法が必要なので以下の方法をこれを実装します。

1. 基本ブロックをWasm関数として生成
   * BBの入力変数を引数として受け取るようなWasm関数を生成します。
2. 生成関数を含むWasmモジュールのエントリーポイントで、BBに対応する関数のfuncrefをグローバル変数にセットする
3. BBに遷移する側は対応するグローバル変数を読み出し、BBの入力変数を全て引数としてスタックに積み、末尾間接関数呼び出し命令 `return_call_ref` によって生成コードに遷移する

例えば以下のような処理を考えます。

```
;; [BB1] 条件分岐 (入力変数: $x, $y)
;; if (!x) { ... }
local.get $x
i32.eqz
if
  ;; [BB2] Then節 (入力変数: $y)
  ;; y = y + 1
  local.get $y
  i32.const 1
  i32.add
  local.set $y
end
;; [BB3] Merge地点 (入力変数: $y)
;; y = y * 2
local.get $y
i32.const 2
i32.mul
local.set $y

;; return y
local.get $y
return
```

これのBB1を生成する場合以下のようになります。

```
(func $bb1 (param $x i32) (param $y i32) (result i32)
  local.get $x
  i32.eqz
  if
    ;; BB2 (Then) へ遷移
    ;; 入力変数 y を引数として渡す
    local.get $y
    global.get $g_bb2
    ref.cast (ref null $i32_to_i32)
    return_call_ref (type $i32_to_i32)
  else
    ;; BB3 (Merge) へ遷移
    ;; 入力変数 y を引数として渡す
    local.get $y
    global.get $g_bb3
    ref.cast (ref null $i32_to_i32)
    return_call_ref (type $i32_to_i32)
  end
)
```

また、この時BB2の呼び出し元がまだ一度も生成されていない場合、`$g_bb2` をStubで初期化する必要があります。


(func $bb2_stub (param $y i32) (result i32)
  i32.const 2 ;; bb_id
  ;; その他特殊化に関する型情報なども渡す
  call $compile_bb ;; BBに対応するモジュールを生成し、インスタンス化するコンパイラの関数
  ;; $compile_bbを呼ぶとグローバル変数 $g_bb2 が $bb2_stub から $bb2 に置き換わるので呼び出す
  local.get $y
  global.get $g_bb2
  ref.cast (ref null $i32_to_i32)
  return_call_ref (type $i32_to_i32)
)
```

そしてこのモジュールのエントリーポイントでは `$g_bb1` を `$bb1` に、 `$g_bb2` を `bb2_stub` に設定します。
