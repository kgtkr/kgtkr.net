---
title: 競プロ用、Rust標準入力パースマクロ
date: "2018-08-30T10:39:29.000Z"
update: "2018-08-30T10:39:29.000Z"
tags: ["procon","rust"]
name: rust-procon-parse-macro
lang: ja
---
競プロで標準入力のパースがめんどうだったのでマクロ作りました。
AtCoderのRust(1.15.1)でテスト済みです。

# ソースコード
https://github.com/kgtkr/procon-lib-rs/blob/master/src/parser.rs

# 使い方
## 事前準備
標準入力を全て読み込む

```rust
let text = {
    let mut s = String::new();
    io::stdin().read_to_string(&mut s).unwrap();
    s
};
```

## 例

入力値
```
5
10 20
1 a
2 b
3 c
4 d
5 e
1 2 3 4 5
```

```rust
input!(text=>
    (n:usize)
    (a:i64 b:i64)
    {n;list:(i64,#)}
    (arr:[i64])
);
assert_eq!(n, 5);
assert_eq!(a, 10);
assert_eq!(b, 20);
assert_eq!(list, vec![(1,"a"),(2,"b"),(3,"c"),(4,"d"),(5,"e")]);
assert_eq!(arr, vec![1,2,3,4,5]);
```

# 解説
`input!(入力値=>パーサー...);`
## 1行の入力
`(変数名:型...)`
## 複数行の入力
`{行数;変数名:型}`

## 型

|構文|解説|例|例入力|
|:-:|:-:|:-:|:-:|
|型|単一の型とマッチ(`parse::<型>()`でパースされる)|i64|10|
|#|文字列|#|abc|
|@|1から始まるインデックスを0からに変換するやつ。<br>つまりusizeでパースして-1してるだけ|@|1|
|[型]|配列|[i64]|1 2 3 4 5|
|(型,...)|タプル|(i64,#)|10 abc|
