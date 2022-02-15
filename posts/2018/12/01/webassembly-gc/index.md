---
title: WebAssemblyでGCを実装する
date: "2018-12-01T22:00:16.000Z"
update: "2018-12-01T22:00:16.000Z"
tags: ["webassembly","languageprocessor"]
name: webassembly-gc
lang: ja
---
# 初めに
[この記事](/blog/2018/12/01/wasm-memory-allocator/)でメモリアロケータを実装したので今回はGCを実装してみます。
様々な事情でアロケータのコードが少し変わっているのでソースは[ここ](https://github.com/kgtkr/wasm-memory/blob/4e0b442e70f5d0f377ce967953fd5d65cafb8e8f/memory.wat)を見て下さい。
大きな変更点はfreeの返り値でfreeしたブロックのポインタを取得出来るようになった事くらいです(ブロックが消失した時は0が返ります)。
今回もwatでとりあえず動く物を作る事を目標に実装していきます。

# 方針
参照カウントとmark and sweepを組み合わせたような実装をします。
ローカル変数などからの参照のみを参照カウントで管理し(これはコンパイラが`inc_count`と`dec_count`を呼び出すコードを挿入する必要がある)、参照カウントが0でないブロックをルートセットとして扱いmark and sweepします。
ブロックには2種類あり「データブロック」と「参照ブロック」です。
これはmark and sweepで使用し、データブロックの場合はbodyをただのバイト列として扱うのでmark and sweepの再帰的なマークには影響しません。参照ブロックの場合はbodyを全て他のブロックへの参照として扱うので再帰的にマークされます(nullを除く)。
つまり保守的GCではなく絶対的GCです、

# 仕様
アロケータのmallocで確保したbody内部に新たなheadとbodyを作ります。
アロケータのmallocで確保した番地をポインタと呼び、GCのmallocで確保した番地を参照と呼びます。

|サイズ|名前|説明|
|:--|:--|:--|
|1|flag|1bit目:マークされてるか、2bit目:リファレンスセットであるか|
|4|count|ルートセットの参照カウント|
|任意|body|本体|

# ソースコード
メモリとアロケータからいくつかの関数をimportします。
アロケータからの関数には全て`memory_`というprefixをつけています。

## import
```
(import "resource" "memory" (memory 1))
(import "memory" "malloc" (func $memory_malloc (param i32) (result i32)))
(import "memory" "free" (func $memory_free (param i32) (result i32)))
(import "memory" "get_size" (func $memory_get_size (param i32) (result i32)))
(import "memory" "get_next" (func $memory_get_next (param i32) (result i32)))
(import "memory" "get_flag" (func $memory_get_flag (param i32) (result i32)))
(import "memory" "HEAD_SIZE" (global $memory_HEAD_SIZE i32))
(import "memory" "USE_FLAG_INVALID" (global $memory_USE_FLAG_INVALID i32))
(import "memory" "USE_FLAG_NON_USE" (global $memory_USE_FLAG_NON_USE i32))
(import "memory" "USE_FLAG_USE" (global $memory_USE_FLAG_USE i32))
```

## 定数宣言
ヘッダサイズと`FLAG`のビットフラグの値です。

```
(global $HEAD_SIZE i32 (i32.const 5))
(global $FLAG_MARKED i32 (i32.const 0x1))
(global $FLAG_IS_REFS i32 (i32.const 0x2))
```

## 便利関数
これはアロケータの記事の同じような関数のGC版なので説明はいらないと思います。

```
(func $get_flag_p (param $ref i32) (result i32)
  (i32.sub (get_local $ref) (i32.const 5))
)

(func $get_flag (param $ref i32) (result i32)
  (i32.load8_u (call $get_flag_p (get_local $ref)))
)

(func $set_flag (param $ref i32) (param $v i32)
  (i32.store8 (call $get_flag_p (get_local $ref)) (get_local $v))
)

(func $get_count_p (param $ref i32) (result i32)
  (i32.sub (get_local $ref) (i32.const 4))
)

(func $get_count (export "get_count") (param $ref i32) (result i32)
  (i32.load (call $get_count_p (get_local $ref)))
)

(func $set_count (param $ref i32) (param $v i32)
  (i32.store (call $get_count_p (get_local $ref)) (get_local $v))
)
```

参照とポインタの相互変換関数です。
ヘッダサイズ分加減するだけで出来ます。

```
(func $to_p (export "to_p") (param $ref i32) (result i32)
  (i32.sub (get_local $ref) (get_global $HEAD_SIZE))
)

(func $to_ref (export "to_ref") (param $p i32) (result i32)
  (i32.add (get_local $p) (get_global $HEAD_SIZE))
)
```

ビットフラグ関連の関数です、
ビットフラグを切り替えたり、取得したりします。
ちなみに`xor(x,-1)`はビット反転(C言語でいう`~`)です。
`get_is_refs`はよく使うので関数化しました。

```
(func $on_bit_flag (param $ref i32) (param $flag i32)
  (call $set_flag (get_local $ref) (i32.or (call $get_flag (get_local $ref)) (get_local $flag)))
)

(func $off_bit_flag (param $ref i32) (param $flag i32)
  (call $set_flag (get_local $ref) (i32.and (call $get_flag (get_local $ref)) (i32.xor (get_local $flag) (i32.const -1))))
)

(func $get_bit_flag (param $ref i32) (param $flag i32) (result i32)
  (i32.and (call $get_flag (get_local $ref)) (get_local $flag))
)

(func $get_is_refs (export "get_is_refs") (param $ref i32) (result i32)
  (call $get_bit_flag (get_local $ref) (get_global $FLAG_IS_REFS))
)
```

ブロックサイズを取得する関数です、
アロケータのブロックサイズからヘッダサイズを引いただけです。

```
(func $get_size (export "get_size") (param $ref i32) (result i32)
  (i32.sub (call $memory_get_size (call $to_p (get_local $ref))) (get_global $HEAD_SIZE))
)
```

## malloc
アロケータのmallocをラップした感じです。
要求されたサイズにヘッダ分足してメモリ確保→ヘッダの初期化を行っています。

```
(func $malloc (export "malloc") (param $size i32) (param $is_refs i32) (result i32)
  (local $ref i32)
  (set_local $ref (call $to_ref (call $memory_malloc (i32.add (get_local $size) (get_global $HEAD_SIZE)))))
  (call $set_count (get_local $ref) (i32.const 0))
  (if (get_local $is_refs)
    (then
      (call $set_flag (get_local $ref) (get_global $FLAG_IS_REFS))
    )
    (else
      (call $set_flag (get_local $ref) (i32.const 0))
    )
  )
  (get_local $ref)
)
```

## 参照カウントのinc/dec
コンパイラからコード挿入して呼び出す用の関数です。

```
(func $inc_count (export "inc_count") (param $ref i32)
  (call $set_count (get_local $ref) (i32.add (call $get_count (get_local $ref)) (i32.const 1)))
)

(func $dec_count (export "dec_count") (param $ref i32)
  (call $set_count (get_local $ref) (i32.sub (call $get_count (get_local $ref)) (i32.const 1)))
)
```

## mark処理
`mark`関数では生きているかつ参照カウントが0でないブロックを列挙して、それを`mark_rec`に渡しています。
`mark_rec`は再帰的な関数です。
まず、nullチェックと使用中かのチェックを行います。`nullでない∧使用中`であればそのブロックにマークをつけます。
もしブロックが「参照ブロック」であれば再帰的に`mark_rec`を呼び出しています。


```
(func $mark
  (local $iter_p i32)
  (set_local $iter_p (get_global $memory_HEAD_SIZE))

  ;;全てのブロックを列挙
  loop $loop
    (if (i32.ne (call $memory_get_flag (get_local $iter_p)) (get_global $memory_USE_FLAG_INVALID))
      (then
        ;; 生きているなら
        (if (i32.eq (call $memory_get_flag (get_local $iter_p)) (get_global $memory_USE_FLAG_USE))
          (then
            ;;ルートセットに登録されてるなら
            (if (i32.ne (call $get_count (call $to_ref (get_local $iter_p))) (i32.const 0))
              (then
                (call $mark_rec (call $to_ref (get_local $iter_p)))
              )
            )
          )
        )
        (set_local $iter_p (call $memory_get_next (get_local $iter_p)))
        br $loop
      )
    )
  end
)

(func $mark_rec (param $ref i32)
  (local $i i32)
  (local $n i32)
  ;;nullでない
  (if (i32.ne (get_local $ref) (i32.const 0))
    (then
      ;;使用中
      (if (i32.eq (call $memory_get_flag (call $to_p (get_local $ref))) (get_global $memory_USE_FLAG_USE))
        (then
          ;;マークされてない
          (if (i32.eqz (call $get_bit_flag (get_local $ref) (get_global $FLAG_MARKED)))
            (then
              (call $on_bit_flag (get_local $ref) (get_global $FLAG_MARKED))
              ;;ポインタセットなら再帰的にマーク
              (if (call $get_bit_flag (get_local $ref) (get_global $FLAG_IS_REFS))
                (then
                  (set_local $i (i32.const 0))
                  (set_local $n (i32.div_s (call $get_size (get_local $ref)) (i32.const 4)))
                  loop $loop
                    (if (i32.lt_s (get_local $i) (get_local $n))
                      (then
                        (call $mark_rec (i32.load (i32.add (get_local $ref) (i32.mul (get_local $i) (i32.const 4)))))
                        (set_local $i (i32.add (get_local $i) (i32.const 1)))
                        br $loop
                      )
                    )
                  end
                )
              )
            )
          )
        )
      )
    )
  )
)
```

## sweep処理
こちらも基本は生きているブロックを列挙し、マークがついていればマークを外す、ついていなければ`free`という事を行っています。
コードが長くなっているのはfreeでブロックの構造が変わった時に不整合が起きないようにするためです。

```
(func $sweep
  (local $iter_p i32)
  (local $next i32)
  (local $new_p i32)
  (set_local $iter_p (get_global $memory_HEAD_SIZE))

  ;;全てのブロックを列挙
  block $block
    loop $loop
      (if (i32.ne (call $memory_get_flag (get_local $iter_p)) (get_global $memory_USE_FLAG_INVALID))
        (then
          (set_local $next (call $memory_get_next (get_local $iter_p)))
          ;; 生きているなら
          (if (i32.eq (call $memory_get_flag (get_local $iter_p)) (get_global $memory_USE_FLAG_USE))
            (then
              (if (call $get_bit_flag (call $to_ref (get_local $iter_p)) (get_global $FLAG_MARKED))
                (then
                  ;;マークしてるならマーク外す
                  (call $off_bit_flag (call $to_ref (get_local $iter_p)) (get_global $FLAG_MARKED))
                )
                (else
                  ;;マークしてないなら解放
                  (set_local $new_p (call $memory_free (get_local $iter_p)))
                  ;;新しいポインタが0でなければnextにセット
                  (if (i32.ne (get_local $new_p) (i32.const 0))
                    (then
                      (set_local $next (call $memory_get_next (get_local $new_p)))
                    )
                    (else
                      br $block
                    )
                  )
                )
              )
            )
          )
          (set_local $iter_p (get_local $next))
          br $loop
        )
      )
    end
  end
)
```

## mark and sweep
順番に呼び出すだけです。
これもコンパイラがいい感じに挿入することを期待しています。
メモリが足りなくなったら自動で呼び出すみたいな事もしたいなと考えてます。

```
(func $run_gc (export "run_gc")
  (call $mark)
  (call $sweep)
)
```

# 最後に
wasmでルートセットをどう扱うかみたいな事を考えるのが大変だっただけで実装は簡単に出来ました。
本当に最低限動く物なのでパフォーマンスは悪いですし、実用性はありません。
ただそのうちパフォーマンスのいいものをRustあたりで実装したいなと思っています。
watでアロケータやGCを作るとwatを書くのに慣れる事が出来たのでよかったです。
