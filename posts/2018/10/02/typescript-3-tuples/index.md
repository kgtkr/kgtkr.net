---
title: TypeScript 3.0のExtracting and spreading parameter lists with tuplesで遊ぼう
date: "2018-10-02T15:50:50.000Z"
update: "2018-10-02T15:50:50.000Z"
tags: ["typescript","typelevelprogramming"]
name: typescript-3-tuples
lang: ja
---

# Extracting and spreading parameter lists with tuples
TS3.0で追加されたタプル型をより強力に扱うための機能です。
型パラメーターとして受け取ったタプルを展開したり出来ます。
基本的な構文は解説しないので[公式ブログ](https://blogs.msdn.microsoft.com/typescript/2018/07/30/announcing-typescript-3-0/#tuples-and-parameters)あたりを見ておいて下さい。

# 参考
[Tuples in rest parameters and spread expressions #24897](https://github.com/Microsoft/TypeScript/pull/24897)
このPRで紹介されているものを主に解説していきます。

# 注意
TypeScript3.0.xにはバグがありコンパイラやエディタ(正格にはtsserver)がクラッシュすることがあるのでTypeScript3.1.xを使って下さい。

# 前提知識
* TSの基本的な型システムの知識
* 宣言的なリスト操作(Haskellなどでやるあれ)

# 用語
この記事では、`type F<T>=...;`を関数のように扱うので、Fを関数、Tを引数、タプル型をリスト、`type V=...;`を値と表現します。

# 紹介
## Head
リストの先頭の要素を返す基本的な関数です、空リストであればD(デフォルト値)を返します、
`[infer X, ...any[]]`は長さ1以上のリストにマッチし、先頭要素をXに束縛します(Haskellでいう`x:_`)
マッチすれば束縛したXを、マッチしなければ空リストなのでneverを返します。

```ts
export type Head<T extends any[], D=never> = T extends [infer X, ...any[]] ? X : D;

type Type1 = Head<[]>;//never
type Type2 = Head<[1]>;//1
type Type3 = Head<[1, 2],0>;//1
type Type4 = Head<[],1>;//1
```

## Tail
リストから先頭要素を除いたリストを返す関数です。
自然に考えるとHeadで使った、`[infer X, ...any[]]`でマッチさせたいのですが、残念ながら`...any`をinferで束縛することは出来ません。
そこで、一旦`(...x: T) => void`で関数型に変換し、それを`(x: any, ...xs: infer XS) => void`でマッチングして束縛しています。
これはよく使うテクニックなので覚えておきましょう。

```ts
type Tail<T extends any[]> = ((...x: T) => void) extends ((x: any, ...xs: infer XS) => void) ? XS : never

type Type1 = Tail<[]>;//[]
type Type2 = Tail<[1]>;//[]
type Type3 = Tail<[1, 2, 3]>;//[2,3]
```

## Last
再帰が出てきました。リストの最後の要素を返す関数です。

```ts
type Last<T extends any[]> = {
  0: never,
  1: Head<T>,
  2: Last<Tail<T>>,
}[T extends [] ? 0 : T extends [any] ? 1 : 2];

type Type1 = Last<[]>;//never
type Type2 = Last<[1]>;//1
type Type3 = Last<[1, 2, 3]>;//3
```

ここでは再帰の基本的なテクニックを使っています。
何故この関数は以下のような実装では駄目なのかと疑問に持った人もいると思います。

```ts
type Last<T extends any[]> = T extends [] ? never : T extends [infer X] ? X : Last<Tail<T>>;
```

残念ながらこれは`Type alias 'Last' circularly references itself.`というコンパイルエラーになるため出来ません。
本来であればTSの型システムではこのような再帰呼び出しは出来ないのです、
しかし回避する方法があります。([ここ](https://github.com/Microsoft/TypeScript/issues/14174)で紹介されていました)
それは一旦オブジェクト型に変換することです。オブジェクト型に関しては再帰の制限を受けないため、オブジェクト型で`{0:...,1:...}`のように条件を列挙し、それをインデックスアクセスで使うことで回避することが出来ます。条件分岐はインデックスアクセスの所で行います。
これもよく使うテクニックなので抑えておきましょう。
ここまでのテクニックを知っていれば色々な関数を定義出来るはずです。やってみて下さい。(記事は続きますが)

## Cons
リストの先頭に要素を追加する関数です、
`(h: X, ...args: XS) => void`で結合して、それを`(...args: infer R) => void`で取り出しています。

```ts
type Cons<X, XS extends any[]> = ((h: X, ...args: XS) => void) extends ((...args: infer R) => void) ? R : []

type Type1 = Cons<10, []>;//[10]
type Type2 = Cons<10, [1]>;//[10,1]
type Type3 = Cons<10, [1, 2, 3]>;//[10,1,2,3]
```

## Reverse
与えられたリストを反転する関数です
型パラメーターのデフォルト値を使うことで補助関数を定義しなくても実装する事が出来ます。

```ts
type Reverse<L extends any[], X extends any[]=[]> = {
    1: X, 0: Reverse<Tail<L>, Cons<Head<L>, X>>
}[L extends [] ? 1 : 0]

type Type1 = Reverse<[]>;//[]
type Type2 = Reverse<[1]>;//[1]
type Type3 = Reverse<[1, 2, 3]>;//[3,2,1]
```

## Concat
Aの先頭から逆順にRに格納→Bの先頭から逆順にRに格納→最後にReverseしています。

```ts
type Concat<A extends any[], B extends any[], R extends any[]=[]> = {
  0: Reverse<R>,
  1: Concat<Tail<A>, B, Cons<Head<A>, R>>
  2: Concat<A, Tail<B>, Cons<Head<B>, R>>
}[A extends [] ? B extends [] ? 0 : 2 : 1];

type Type1 = Concat<[], []>;//[]
type Type2 = Concat<[1, 2], []>;//[1,2]
type Type3 = Concat<[], [1, 2]>;//[1,2]
type Type4 = Concat<[1, 2], [3, 4, 5]>;//[1,2,3,4,5]
```

## Zip
２つのリストを2要素タプルのリストにする関数です。長さは短い方に合わせられます。
どちらかが空になるまでリストの最初の要素をRの最初に格納し、最後にReverseしています。

```ts
type Zip<A extends any[], B extends any[], R extends any[]=[]> = {
  0: Reverse<R>,
  1: Zip<Tail<A>, Tail<B>, Cons<[Head<A>, Head<B>], R>>
}[A extends [] ? 0 : B extends [] ? 0 : 1];

type Type1 = Zip<[], []>;//[]
type Type2 = Zip<[1], []>;//[]
type Type3 = Zip<[], [1]>;//[]
type Type4 = Zip<[1, 2, 3], [4, 5]>;//[[1,4],[2,5]]
```

## Take
先頭N個の要素を返す関数です。
リストの長さはX["length"]で取得出来るのでこれを使って長さがNのなるか元のリストが空になるまで繰り返して実装しています。

```ts
type Take<N extends number, T extends any[], R extends any[]=[]> = {
  0: Reverse<R>,
  1: Take<N, Tail<T>, Cons<Head<T>, R>>
}[T extends [] ? 0 : R["length"] extends N ? 0 : 1];

type Type1 = Take<2, []>;//[]
type Type2 = Take<2, [1, 2]>;//[1,2]
type Type3 = Take<2, [1, 2, 3]>;//[1,2]
type Type4 = Take<0, [1, 2, 3]>;//[]
```

## Group
リストをN個ずつにまとめる関数です。
R1の要素がN個になるまで追加していき、N個になったらR2に追加するのを繰り返しています。

```ts
export type Group<N extends number, T extends any[], R1 extends any[]=[], R2 extends any[]=[]> = {
  0: Reverse<R2>,
  1: Group<N, T, [], Cons<Reverse<R1>, R2>>,
  2: Group<N, Tail<T>, Cons<Head<T>, R1>, R2>
}[T extends [] ? R1 extends [] ? 0 : 1 : (R1["length"] extends N ? 1 : 2)];

type Type1 = Group<1, []>;//[]
type Type2 = Group<2, [1, 2, 3]>;//[[1, 2], [3]]
type Type3 = Group<3, [1, 2, 3]>;//[[1,2,3]]
type Type4 = Group<2, [1, 2, 3, 4]>;//[[1,2],[3,4]]
```

## Drop
リストの先頭から要素を捨てる関数です。
元のリストをTailを繰り返し、捨てた要素がN個になるまで繰り返しています。

```ts
export type Drop<N extends number, T extends any[], R extends any[]=[]> = {
  0: T,
  1: Drop<N, Tail<T>, Cons<Head<T>, R>>
}[T extends [] ? 0 : R["length"] extends N ? 0 : 1];

type Type1 = Drop<0, []>//[]
type Type2 = Drop<1, []>;//[]
type Type3 = Drop<0, [1, 2, 3]>;//[1,2,3]
type Type4 = Drop<1, [1, 2, 3]>;//[2,3]
type Type5 = Drop<5, [1, 2, 3]>;//[]
```

## Flat
ネストしたリストを平たくする関数です。

```ts
export type Flat<T extends any[][], R1 extends any[]=[], R2 extends any[]=[]> = {
  0: Reverse<R2>,
  1: Flat<Tail<T>, Head<T, []>, R2>,
  2: Flat<T, Tail<R1>, Cons<Head<R1>, R2>>
}[T extends [] ? R1 extends [] ? 0 : 2 : (R1 extends [] ? 1 : 2)];

type Type1 = Flat<[]>;//[]
type Type2 = Flat<[[]]>;//[]
type Type3 = Flat<[[1, 2], [], [3]]>;//[1,2,3]
type Type4 = Flat<[[1, 2], [3]]>;//[1,2,3]
type Type5 = Flat<[[1, 2], [3], []]>;//[1,2,3]
type Type6 = Flat<[[], [1, 2], [3]]>;//[1,2,3]

```

# 実践編:pipe関数に型付けをしよう
可変長個の関数を取り、それを合成した関数を返すpipe関数に型付けをしてみましょう。
`pipe(a->b)->(a->b)`
`pipe(a->b,b->c,c->d)->(a->d)`
といった感じです。
型パラメーターとして`[a,b,c,d...]`を取ることにします。
最低2つの型パラメーターが必要なので定義は以下のようになると思います。

```ts
type PipeFunc<T extends [any, any, ...any[]]> = (...f: /*引数の関数リスト*/) => /*合成した関数*/;
```

まず分かりやすいのは戻り値の合成した関数です。これは型パラメーターの先頭の型を受け取り、最後の型を返す関数です。
つまり`(x: Head<T>) => Last<T>`となります。

次に引数の関数リストの型を考えましょう。
これは`n番目の型パラメーター->n+1番目の型パラメーター`となっています。
そこでn番目の型パラメーターとn+1番目の型パラメーターをペアにしてしまいましょう。

```ts
type ShiftZip<T extends any[]> = Zip<T, Tail<T>>;
```

ZipをTailを組み合わせただけです。`ShiftZip<[1,2,3]>`は`[[1,2],[2,3]]`となります。
次にこのペアの1要素を関数に変換する型を定義します。これも単純です。

```ts
type Tuple2Fn<T> = T extends [infer A, infer B] ? (x: A) => B : never;
```

`Tuple2Fn<[1,2]>`は`(x:1)=>2`となります。
ここまで来たらもうペアのリストの要素にTuple2Fnを適用するだけです。

```ts
type _Pipe<T extends any[]> = { [P in keyof T]: Tuple2Fn<T[P]> }
```

`_Pipe<[[1,2],[2,3]]>`は`[(x: 1) => 2, (x: 2) => 3]`となります。
そしたら今までの型を組み合わせましょう。

```ts
type Cast<T, P, D> = T extends P ? T : D;
type Pipe<T extends any[]> = _Pipe<Cast<ShiftZip<T>, any[], []>>;
```

`Cast`は`ShiftZip`がneverの可能性があるといってコンパイラが怒るのでそれを黙らせる為です。実際には何もしません。

これを関数の引数の型にしたら完成です。ここでもコンパイラを黙らせています。

```ts
type PipeFunc<T extends [any, any, ...any[]]> = (...f: Cast<Pipe<T>, any[], []>) => ((x: Head<T>) => Last<T>);
```

# 最後に
TypeScriptの型システムはとても強力で様々な面白い事ができます。
また面白いだけでなくJSの複雑なライブラリに型付けをするには実際に必要な機能です。
先頭で紹介した[#24897](https://github.com/Microsoft/TypeScript/pull/24897)、[#5453](https://github.com/Microsoft/TypeScript/issues/5453)やその他PRやissue、また他のコミュニティでも色々紹介されているので読んで遊んでみて下さい。
