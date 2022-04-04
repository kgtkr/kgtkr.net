---
title: WebAssemblyに関数単位でJITする言語を実装した
date: "2022-04-04T11:22:25.020Z"
update: "2022-04-04T11:22:25.020Z"
tags: ["webassembly", "languageprocessor", "rust"]
name: wasm-per-function-jit-language
lang: ja
otherLangs: []
---


## 実装したもの
* https://github.com/kgtkr/wjit

```
$ cat ./sample.wjit    
func main() {
    var x = fib(10) in
    println(x);
    func_a(10);
    println(is_prime(3));
    println(is_prime(4));
    println(is_prime(5));
    println(is_prime(6));
}

func fib(n) {
    if (n < 2) {
        n;
    } else {
        fib(n - 1) + fib(n - 2);
    };
}

func func_a(x) {
    println(x);
    if (x <= 0) {
        x;
    } else {
        func_b(x - 1);
    };
}

func func_b(x) {
    println(x);
    if (x <= 0) {
        x;
    } else {
        func_a(x - 1);
    };
}

func is_prime(n) {
    if (n <= 1) {
        0;
    } else {
        var result = 1 in
        var i = 2 in
        {
            while (i * i <= n) {
                if (n % i == 0) {
                    result = 0;
                } else {};
                i = i + 1;
            };
            result;
        };
    };
}

$ node runner.js ./sample.wjit
compile_func 0
compile_func 1
55
compile_func 2
10
compile_func 3
9
8
7
6
5
4
3
2
1
0
compile_func 4
1
0
1
0
```

## これは何
WebAssemblyがターゲットの関数単位でJITするスクリプト言語というものがggっても出てこなかった(見つけられなかっただけかも, 情報あったら教えてください)ので試しに実装したおもちゃ言語です. 今までJITの実装をしたことがなくてやりたいと思っていたのでそれも込みで実装しました.

## 言語設計
「WebAssemblyで関数単位でJITする」というのに必要な最小限の機能だけ入れました. 型は整数だけで, 制御構文として `if` / `while` があり, 可変の変数宣言ができ, 関数の定義と呼び出しができるといった仕様です.
例えば複数の型があれば, ランタイム型チェックを行うコードを生成したり, 引数が整数の時だけ最適化するコードを生成するといったことも考えられますが, 今回やりたいこととは違うのでいれませんでした(これは別言語として実装したい).

## 動作
動作の概要を理解するには[runner.js](https://github.com/kgtkr/wjit/blob/b6fde867acdb485e9907db3592d76991ace96a26/runner.js) を見るのが一番早いと思います. このスクリプトは `--dump-wasm` フラグをつけて実行すると, 内部で生成したwasmファイルをファイルとして出力してくれるので動作を理解するのに役立ちます. 今回は, この記事の先頭に書いたサンプルコードを実行すると, どのようなwasmファイルが生成されるかを見ながら動作を解説します.

今回出てくるwasmファイルは3種類です. 1つ目はコンパイラ本体のwasmファイルでRustコードを `--target=wasm32-unknown-unknown` でコンパイルしたものです. どのような関数がexportされているかは [`main.rs`](https://github.com/kgtkr/wjit/blob/b6fde867acdb485e9907db3592d76991ace96a26/src/main.rs)を見ると分かります. 2つ目はスケルトンと呼んでいるもので, 最初に生成されるwasmファイルです. これには関数本体は含まれていません. 3つ目は関数の本体を1つ含むwasmファイルで, 1関数=1wasmとなっており, 関数が最初に呼び出された時に生成されます.

まず, `make_compiler` 関数にソースコードを渡し, パース処理を行い, 結果を `Compiler` 型として受け取ります. 次に`Compiler` 型を `compile_skeleton` 関数に渡し, スケルトンwasmのバイナリを生成します. サンプルコードのスケルトンをwat形式にしたものは以下です.


```
(module
  (type (;0;) (func (result i32)))
  (type (;1;) (func (param i32) (result i32)))
  (type (;2;) (func (param i32 i32) (result i32)))
  (type (;3;) (func (param i32 i32 i32) (result i32)))
  (type (;4;) (func (param i32 i32 i32 i32) (result i32)))
  (import "env" "compile_func" (func (;0;) (type 1)))
  (func (;1;) (type 0) (result i32)
    i32.const 0
    call 0
    drop
    i32.const 0
    call_indirect (type 0))
  (func (;2;) (type 1) (param i32) (result i32)
    local.get 0
    i32.const 1
    call 0
    drop
    i32.const 1
    call_indirect (type 1))
  (func (;3;) (type 1) (param i32) (result i32)
    local.get 0
    i32.const 2
    call 0
    drop
    i32.const 2
    call_indirect (type 1))
  (func (;4;) (type 1) (param i32) (result i32)
    local.get 0
    i32.const 3
    call 0
    drop
    i32.const 3
    call_indirect (type 1))
  (func (;5;) (type 1) (param i32) (result i32)
    local.get 0
    i32.const 4
    call 0
    drop
    i32.const 4
    call_indirect (type 1))
  (table (;0;) 5 funcref)
  (export "main" (func 1))
  (export "fib" (func 2))
  (export "func_a" (func 3))
  (export "func_b" (func 4))
  (export "is_prime" (func 5))
  (export "_table" (table 0))
  (elem (;0;) (i32.const 0) func 1 2 3 4 5))
```

これを見ると `compile_func` という関数をimportし, `_table` や各関数をexportしていることが分かります. また, 関数本体も含まれていません. 各 `i` 番目の関数(スケルトン関数と呼んでいる)は呼び出されると `compile_func` に `i` を渡し, 受け取った引数を全て引数にしてテーブルの `i` 番目の関数を呼び出しています. また `elem` セクションでテーブルに各スケルトン関数をセットしていることも分かります.

ではimportしている `compile_func` はなんでしょうか. これは `runner.js` を見ると分かります. この関数では, コンパイルする関数のindexを受け取り, コンパイラ本体の `compile_func` に `Compiler` とindexを渡し, 関数本体を含むwasmファイルのバイナリを受け取って, それをインスタンス化しています. インスタンス化する時にスケルトンwasmがexportしている `table` を渡すことでテーブルを共有しています.

例えばサンプルコードの `main` 関数(index=0)に対応するwasmは以下です.

```
(module
  (type (;0;) (func (result i32)))
  (type (;1;) (func (param i32) (result i32)))
  (type (;2;) (func (param i32 i32) (result i32)))
  (type (;3;) (func (param i32 i32 i32) (result i32)))
  (type (;4;) (func (param i32 i32 i32 i32) (result i32)))
  (import "env" "println" (func (;0;) (type 1)))
  (import "env" "_table" (table (;0;) 5 funcref))
  (func (;1;) (type 0) (result i32)
    (local i32)
    i32.const 10
    i32.const 1
    call_indirect (type 1)
    local.set 0
    local.get 0
    call 0
    drop
    i32.const 10
    i32.const 2
    call_indirect (type 1)
    drop
    i32.const 3
    i32.const 4
    call_indirect (type 1)
    call 0
    drop
    i32.const 4
    i32.const 4
    call_indirect (type 1)
    call 0
    drop
    i32.const 5
    i32.const 4
    call_indirect (type 1)
    call 0
    drop
    i32.const 6
    i32.const 4
    call_indirect (type 1)
    call 0)
  (elem (;0;) (i32.const 0) func 1))
```

これを見ると `main` 関数の本体が含まれていることが分かります. また, `elem` セクションでその関数をテーブルのindex=0番目にセットしていることも分かります. これによってこのモジュールをインスタンス化した時にimportしているテーブルの0番目にあった, `main` 関数をコンパイルするという処理を行なっていたスケルトン関数が, 関数の本体で上書きされるといった動作をします. こうすることで, 関数が最初に呼び出された時にはスケルトン関数が呼ばれ, 関数の本体をコンパイルし, その関数の本体で, テーブルのスケルトン関数を上書きし, 以後はコンパイル済み関数が呼ばれるということを実現しました.


現在はwasmバイナリからモジュールをインスタンス化をするのにJSが必要なので, 最初に関数を呼び出した時だけJSのコードが実行されますが `module-linking` proposalあたりが実現すればJSなしでできるようになるのでしょうか(まだ読めていない).

https://github.com/WebAssembly/module-linking/blob/main/design/proposals/module-linking/Explainer.md
