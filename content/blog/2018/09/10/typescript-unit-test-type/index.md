---
title: TypeScriptで型のユニットテストをしたい
date: "2018-09-10T08:42:11.000Z"
update: "2018-09-10T08:42:11.000Z"
tags: ["typescript","typelevelprogramming"]
name: typescript-unit-test-type
---
# やり方

## 準備

logical.ts
```ts
export type And<A extends boolean, B extends boolean> = A extends true ? (B extends true ? true : false) : false;
export type Or<A extends boolean, B extends boolean> = A extends true ? true : (B extends true ? true : false);
export type Xor<A extends boolean, B extends boolean> = A extends true ? (B extends true ? false : true) : (B extends true ? true : false);
export type Not<X extends boolean> = X extends true ? false : true;
```

test.ts
```ts
import { And, Not, Or } from "./logical";

type IsExtends<A, B> = A extends B ? true : false;
type TypeEqNotUnion<A, B> = And<IsExtends<A, B>, IsExtends<B, A>>;
type ComparableType<T> = [T];
type TypeEqNotAny<A, B> = TypeEqNotUnion<ComparableType<A>, ComparableType<B>>;
type IsAny<T> = And<TypeEqNotAny<T, 1>, TypeEqNotAny<T, 2>>;
type IsNotAny<T> = Not<IsAny<T>>;
export type TypeEq<A, B> = Or<And<IsAny<A>, IsAny<B>>, And<And<IsNotAny<A>, IsNotAny<B>>, TypeEqNotAny<A, B>>>;

export function assertType<_T extends true>() { }
export function assertNotType<_T extends false>() { }
```
色々複雑になっていますが、これはanyやunion、neverなどに対応するためです。
ここらへんの型は少し特殊なため、このようにしないと正常にテスト出来ません。

## テストの書き方

```ts
assertType<TypeEq<1, 1>>();
assertNotType<TypeEq<1, 2>>();
```

テストが正しくなければコンパイルエラーが発生します。

## 例

```ts
import { TypeEq, assertType, assertNotType } from "./test";

assertType<TypeEq<1, 1>>();
assertNotType<TypeEq<{}, { x: 1 }>>();
assertType<TypeEq<{ x: 1, y: 1 }, { x: 1 } & { y: 1 }>>();
assertNotType<TypeEq<1, 2>>();
assertNotType<TypeEq<1 | 2, 1>>();
assertNotType<TypeEq<1, never>>();
assertType<TypeEq<never, never>>();
assertNotType<TypeEq<1, any>>();
assertType<TypeEq<any, any>>();
assertNotType<TypeEq<1, unknown>>();
assertType<TypeEq<unknown, unknown>>();
```


# そもそも何でこんなものが必要なの？
通常のTSの使い方なら必要ありません。
しかし、ts2.1でMapped typesが入り、ts2.8でConditional Typesが入り、ts3.0でTuple関連の型システムが強化されTSの型システムはより複雑に、そして高機能になっています。
このような型システムをフル活用すると例えばタプル型を`Reverse`や`Zip`するといったとても複雑な事を行えます。[\[参考\]](https://github.com/Microsoft/TypeScript/pull/24897)(例えば`Zip<[1,2,3],[10,20]>`は型`[[1,10],[2,20]]`を返すなど)
つまり`type`をただの型エイリアスではなく「型を受け取り型を返す関数」として使うことができます。
当然中身はかなり複雑ですし、バグも発生します。
関数のようなものなので正しい値を返してくれるかのテストを行いたいのです。

例えばさっきの例なら

```ts
assertType<TypeEq<Zip<[1,2,3],[10,20]>, [[1,10],[2,20]]>>();

```

のように書くことでテストを行えます。
