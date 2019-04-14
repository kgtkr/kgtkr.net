---
title: TypeScriptで型レベルハイパー演算子
date: "2019-04-12T09:14:53.000Z"
update: "2019-04-12T09:14:53.000Z"
tags: ["typescript","typelevelprogramming"]
name: typescript-type-level-hyper-operation
---
この記事はTS3.4.3で動作確認をしています。

# ハイパー演算子とは
```
hyper(1,a,b)=a+b
hyper(2,a,b)=a*b
hyper(3,a,b)=a^b
︙
```
のような演算子です(雑)
詳しくは[Wikipedia](https://ja.wikipedia.org/wiki/%E3%83%8F%E3%82%A4%E3%83%91%E3%83%BC%E6%BC%94%E7%AE%97%E5%AD%90)を見て下さい。

定義だけ貼っておきます。

```
hyper(1,a,b)=a+b
hyper(_,a,1)=a
hyper(i,a,1)=hyper(i-1,a,hyper(i,a,b-1))
```

# 型レベルタプル操作
型レベルのタプル操作を行うので以下の記事を読んでおくといいかもしれません。
[TypeScript 3.0のExtracting and spreading parameter lists with tuplesで遊ぼう](/blog/2018/10/02/typescript-3-tuples)

ちなみに今回は上の記事の型レベルタプル操作などをまとめた自作ライブラリ`typepark`を使いますが機能は上の記事の通りです。

# 再帰制限回避テク
`F`や`G`が複雑な関数だと以下のような書き方をするとコンパイルエラーが発生することがあります。

```ts
type Hoge<T>=F<Cast<G<T>,any[]>>;
```

このような時は以下のように書き直すことで回避できます。

```ts
type Hoge<T>=F<G<T> extends infer X?Cast<X,any[]>:X>;
```

# 方針
* 筋肉で全列挙コードを書くと言った事は一切しない
* 数値リテラル型3つを受け取って数値リテラル型1つを返す関数を実装する
* 数が大きいと色々な制限に引っかかって死ぬけど気にしない

# 実装
数値リテラルを直接扱うのは大変です。
そこで`any`が`N`個のタプル型を数値リテラル型の`N`代わりに使う`_Hyper`関数を実装しましょう。
例えば`_Hyper<[any],[any,any],[any,any,any]>`は`[any,any,any,any,any]`です。

これは定義通りですね。
ところどころコンパイルエラー回避のテクニックを使っているくらいです。
数値リテラルの代わりにタプルを使っているので`A-1`は`Tail<T>`に、`A+B`は`Concat<A,B>`と言った書き方が出来ます。

```ts
type _Hyper<I extends any[], A extends any[], B extends any[]> = {
  0: Concat<A, B>,
  1: A,
  2: _Hyper<Tail<I>, A, _Hyper<I, A, Tail<B>> extends infer X ? Cast<X, any[]> : never>,
}[I extends [any] ? 0 : (B extends [any] ? 1 : 2)];
```
では数値リテラルを受け取り数値リテラルを返す関数はどう実装したらいいでしょうか？
タプル→数値リテラルと数値リテラル→タプルの変換が出来ればいいことが分かると思います。
前者は`T["length"]`と書くだけなので簡単です。
後者は以下のような`Repeat`関数を使いましょう。

```ts
export type Repeat<T, N extends number, R extends any[]=[]> = {
  0: R,
  1: Repeat<T, N, Cons<T, R>>
}[R["length"] extends N ? 0 : 1];
```

これも`typepark`に含まれていますが、まだ解説してなかったので軽く解説しておきます。
要素`T`を`N`個持つタプルを返す関数です。
結果値が`R`なので`R`の長さが`N`になるまで`T`を`Cons`しています。

これで`Repeat<any,N>`と書くことで数値リテラル→タプルの変換が出来るようになりました。

では`Hyper`関数の実装です。

```ts
export type Hyper<I extends number, A extends number, B extends number>
  = _Hyper<Repeat<any, I> extends infer X ? Cast<X, any[]> : never, Repeat<any, A> extends infer X ? Cast<X, any[]> : never, Repeat<any, B> extends infer X ? Cast<X, any[]> : never> extends infer X ? Cast<X, any[]>["length"] : never;
```

ところどころコンパイルエラーを回避して実装しています。

```ts
Hyper<1, 1, 4>//5
Hyper<2, 5, 4>//20
Hyper<3, 2, 4>//16
Hyper<1, 100, 200>//数値が大きすぎてコンパイルエラー
```
