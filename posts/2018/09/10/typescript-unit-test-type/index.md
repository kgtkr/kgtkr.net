---
title: TypeScriptで型のユニットテストをしたい
date: "2018-09-10T08:42:11.000Z"
update: "2019-04-22T12:12:04.994Z"
tags: ["typescript", "typelevelprogramming"]
name: typescript-unit-test-type
lang: ja
---

# やり方

## 準備

```ts:test.ts
export type TypeEq<A, B> = (<T>() => T extends A ? 1 : 2) extends (<
  T
>() => T extends B ? 1 : 2)
  ? true
  : false

export function assertType<_T extends true>() {}
export function assertNotType<_T extends false>() {}
```

色々複雑になっていますが、これは any や union、never などに対応するためです。
ここらへんの型は少し特殊なため、このようにしないと正常にテスト出来ません。

## テストの書き方

```ts
assertType<TypeEq<1, 1>>()
assertNotType<TypeEq<1, 2>>()
```

テストが正しくなければコンパイルエラーが発生します。

## 例

```ts
import { TypeEq, assertType, assertNotType } from "./test"

assertType<TypeEq<1, 1>>()
assertNotType<TypeEq<{}, { x: 1 }>>()
assertNotType<TypeEq<1, 2>>()
assertNotType<TypeEq<1 | 2, 1>>()
assertNotType<TypeEq<1, never>>()
assertType<TypeEq<never, never>>()
assertNotType<TypeEq<1, any>>()
assertType<TypeEq<any, any>>()
assertNotType<TypeEq<1, unknown>>()
assertType<TypeEq<unknown, unknown>>()
```

# そもそも何でこんなものが必要なの？

通常の TS の使い方なら必要ありません。
しかし、ts2.1 で Mapped types が入り、ts2.8 で Conditional Types が入り、ts3.0 で Tuple 関連の型システムが強化され TS の型システムはより複雑に、そして高機能になっています。
このような型システムをフル活用すると例えばタプル型を`Reverse`や`Zip`するといったとても複雑な事を行えます。[\[参考\]](https://github.com/Microsoft/TypeScript/pull/24897)(例えば`Zip<[1,2,3],[10,20]>`は型`[[1,10],[2,20]]`を返すなど)
つまり`type`をただの型エイリアスではなく「型を受け取り型を返す関数」として使うことができます。
当然中身はかなり複雑ですし、バグも発生します。
関数のようなものなので正しい値を返してくれるかのテストを行いたいのです。

例えばさっきの例なら

```ts
assertType<TypeEq<Zip<[1, 2, 3], [10, 20]>, [[1, 10], [2, 20]]>>()
```

のように書くことでテストを行えます。
