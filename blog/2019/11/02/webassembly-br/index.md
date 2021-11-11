---
title: WebAssemblyのbr命令について
date: "2019-11-02T09:32:02.029Z"
update: "2019-11-02T09:32:02.029Z"
tags: ["webassembly"]
name: webassembly-br
lang: ja
---

## はじめに
WebAssemblyには`br`という命令があります。
この命令は`br <label>`という形になっており、`<label>`が示す制御構造に対して何らかの動作をします。
例えばブロックに対して使えばブロックを抜け、ループの中で使えば`continue`のような振る舞いをします。
wasmのループについてはκeenさんの[WebAssemblyのloopはまりどころ](https://qiita.com/blackenedgold/items/704141afbfafef0df254)という記事を見てみて下さい。
なぜこのように制御構造によってブロックを抜ける働きをしたり、`continue`の働きをしたりするか仕様書を読んでいたところ理由が分かり面白いと思ったので記事にしました。

## br命令
基本的には`br 数値`という形の命令です。この数値は相対的な値となっており`br`命令を囲っているすぐ外側の制御構造に対してなにかするときは`br 0`と、その外側であれば`br 1`と...いうふうに指定します。
また、watでは制御構造に`$label`をつけることで`br $label`と書けば`br`命令がどの深さに関係なくその制御構造に対して命令を実行することができます。

## 例
関数に対して使うとその関数を抜けます。

```
(call $log (i32.const 1))
(br 0)
(call $log (i32.const 2))

;; output: 1
```

ブロックで使うとそのブロックを抜けます。

```
(block $label
  (call $log (i32.const 1))
  (br $label)
  (call $log (i32.const 2))
)
(call $log (i32.const 3))

;; output: 1 3
```

ちなみにこのwatはwasmにコンパイルすると以下のコードと等しくなります。

```
(block
  (call $log (i32.const 1))
  (br 0)
  (call $log (i32.const 2))
)
(call $log (i32.const 3))
```

以下のコードは`br 1`としているので`br`命令の2つ外側の制御構造、つまり関数を抜けます。

```
(block
  (call $log (i32.const 1))
  (br 1)
  (call $log (i32.const 2))
)
(call $log (i32.const 3))

;; output: 1
```

ループに対しては`continue`として働きます。`br`がなければループは一回しか実行されません。
`br_if`は引数が`0`でなければ`br`を実行する命令です。

```
(local $n i32)
(loop $loop
  (call $log (get_local $n))
  (set_local $n (i32.add (get_local $n) (i32.const 1)))
  (br_if $loop (i32.ne (get_local $n) (i32.const 3)))
)

;; output: 0 1 2
```

## labelとbr命令の正体
なぜ`br`は対象の制御構造によってブロックを抜けたり`continue`として働いたりするのでしょうか。
これは`br n`はn番目に外側(すぐ外側は0番目)の`label`命令の継続にジャンプする命令だからです。
`label`命令というのは仕様を書くために出てくる拡張命令みたいなものでwasmコード自体には現れません。
`label`命令は`label {継続} {命令}`のような形になっています。そして通常は`{命令}`を評価しそれが終われば、`label`の評価は終了します。`br`されれば`{命令}`の評価を中断し、`{継続}`を評価し、それが終われば`label`の評価は終了します。
そして`block`や`loop`を評価すると一旦この`label`命令に変換されます(これは仕様書上の話で実際の処理系がこうなっているという事ではない)。また関数に入ったときも`label`が作られます(これによって関数の直下で`br 0`とすると関数を抜けられます。)
例えば`block`であれば`label {} {...}`のように変換されるので`br`でジャンプする継続は空です。つまり`br`されれば何もせずにブロックを抜けます。
`if`や関数に入った時も継続が空の`label`に変換されるので`br`されれば何もせずにその制御構造を抜けます。
しかし`loop`は`label {loop ... end} {...}`のように変換されます。もし`loop`に対して`br`すれば`label`の継続である`loop ... end`にジャンプし、これが評価されてまた`label`に変換され`label {loop ... end} {...}`となり…を繰り返す事でループが実現しています。これが`loop`に対する`br`が`continue`として働く理由です。また`br`しなければそのまま`label`を抜けることになるのでこれによって`loop`に対して`br`しなければ一回しか処理は実行されません。

### 例
先ほど例として出した以下のループの実行を例にします。(label命令は仕様の中だけに出てくるものでwatには存在しないのでコンパイルはできません)

```
(local $n i32)
(loop $loop
  (call $log (get_local $n))
  (set_local $n (i32.add (get_local $n) (i32.const 1)))
  (br_if $loop (i32.ne (get_local $n) (i32.const 3)))
)

;; output: 0 1 2
```

`loop`を評価すると`label`に変換します。

```
;; n: 0

(loop $loop ;; ←評価
  (call $log (get_local $n))
  (set_local $n (i32.add (get_local $n) (i32.const 1)))
  (br_if $loop (i32.ne (get_local $n) (i32.const 3)))
)
```

```
(label $loop
  {loop $loop
    (call $log (get_local $n))
    (set_local $n (i32.add (get_local $n) (i32.const 1)))
    (br_if $loop (i32.ne (get_local $n) (i32.const 3)))
  }
  {
    (call $log (get_local $n))
    (set_local $n (i32.add (get_local $n) (i32.const 1)))
    (br_if $loop (i32.ne (get_local $n) (i32.const 3)))
  }
)
```

`label`では継続ではなく本体を順に評価します。
`評価3`を実行すると`br_if`の引数は`1`なので`br`を実行します。
この時継続にジャンプし、継続を評価します。ここでの継続は`loop`です。
これによって`loop`が評価され`label`になり…を繰り返します。

```
;; n: 0→1

(label $loop
  {loop $loop
    (call $log (get_local $n))
    (set_local $n (i32.add (get_local $n) (i32.const 1)))
    (br_if $loop (i32.ne (get_local $n) (i32.const 3)))
  }
  {
    (call $log (get_local $n)) ;; ←評価1
    (set_local $n (i32.add (get_local $n) (i32.const 1))) ;; ←評価2
    (br_if $loop (i32.ne (get_local $n) (i32.const 3))) ;; ←評価3
  }
)
```

```
;; n: 1

(loop $loop
    (call $log (get_local $n))
    (set_local $n (i32.add (get_local $n) (i32.const 1)))
    (br_if $loop (i32.ne (get_local $n) (i32.const 3)))
)
```

`n`が`3`の時`br_if`の引数は`0`なので何もしません。つまり継続には飛ばずそのまま`label`の本体の処理が終わります。つまりループが終了します。

## 参考
[WebAssembly Specification](https://webassembly.github.io/spec/core/index.html)
