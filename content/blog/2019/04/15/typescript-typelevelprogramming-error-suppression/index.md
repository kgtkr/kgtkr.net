---
title: TypeScript、型レベルプログラミングエラー抑制テクニック
date: "2019-04-15T04:07:06.208Z"
update: "2019-04-15T04:07:06.208Z"
tags: ["typescript","typelevelprogramming"]
name: typescript-typelevelprogramming-error-suppression
lang: ja
otherLang: ["en"]
---

TypeScriptの型レベルプログラミングでは様々な型エラーが発生するため、それを抑制しながら作っていかなければいけません。  
今回はエラーを回避するテクニックを2つ紹介します。
v3.4.2で動作確認をしています。


## 型制約エラーを抑制する
TSには型の型のようなものがあり、それを満たす型にしかできないような操作があります。  
いくつか例を挙げます。

```ts
type F<T extends any[]> = T;
type X = F<A>;// Aはany[]を継承していなければいけない
type Y = B["x"]// Bはオブジェクト型で`x`というプロパティを持っていなければいけない
```

しかしこのような条件を満たしていることが分かっていてもコンパイラが推論出来ておらずエラーになることがあります。
そのような時は以下のような`Cast`型を定義して使いましょう。
これは`T`は`P`を継承している時は分かっている時に`Cast<T, P>`と書いて使います。

```ts
type Cast<T, P> = T extends P ? T : P;
```

例です。

```ts
type F<T> = "x" extends keyof T ? T : { x: 1 };
type G<T> = F<T>["x"];
```

`F<T>`の結果は`x`というプロパティを持っている事が分かっているのに型エラーになります。  
そこで以下のように書き直すことでエラーを回避出来ます。  


```ts
type G<T> = Cast<F<T>, { x: any }>["x"];
```

## `Type instantiation is excessively deep and possibly infinite.`を抑制する
このエラーは二種類あり、型パラメーターが存在しない、つまり全ての型が解決された状態で出るものと、解決されていない型が存在する状態で出るものがあります。  
前者は単純に再帰制限に引っかかっているため抑制することは出来ませんが、後者であれば抑制する事が出来ます。  
`F`、`G`が再帰などを含む複雑な型コンストラクタの時、

```ts
type X<T> = G<F<T>>;
```

と書いた時エラーが発生します。  
ただし`G`はそこまで複雑でなくても出ることもあります。(要調査)  
この時以下のように書くことで解決します。

```ts
type X<T> = G<F<T> extends infer A ? A : never>;
```

ただし複雑な型コンストラクタは型のチェックも上手く行えないことが多いので`Cast`と一緒に使うことが多いです。

```ts
type X<T> = G<F<T> extends infer A ? Cast<A, any[]> : never>;
```

TS3.4でここらへんの検査が厳しくなったらしく、このテクニックがほぼ必須になりました。  
[issue](https://github.com/Microsoft/TypeScript/issues/30188)

エラーが出る具体例は以下のような感じです。

```ts
type Head<T extends any[], D = never> = T extends [infer X, ...any[]] ? X : D;
type Tail<T extends any[]> = ((...x: T) => void) extends ((x: any, ...xs: infer XS) => void) ? XS : never
type Cons<X, XS extends any[]> = ((h: X, ...args: XS) => void) extends ((...args: infer R) => void) ? R : [];
type Reverse<L extends any[], X extends any[] = []> = {
  1: X, 0: Reverse<Tail<L>, Cons<Head<L>, X>>
}[L extends [] ? 1 : 0];

type X<T extends any[]> = Reverse<Reverse<T>>;
```

この時以下のようにして解決します。

```ts
type X<T extends any[]> = Reverse<Reverse<T> extends infer A ? Cast<A, any[]> : never>;
```

ちなみに最初に書いた抑制不可能なエラーとは以下のような感じです。

```ts
type X = Reverse<[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]>;
```

これは単純に再帰制限に引っかかってるので大きなサイズのデータを扱うのを諦めるか、型の再帰を減らす工夫をするしかありません。  