---
title: TypeScriptで型安全なobjectのpick関数を定義する(型パラメーターを単一のリテラル型に制限する方法)
date: "2020-02-24T09:21:09Z"
update: "2020-02-24T09:21:09Z"
tags: ["typescript"]
name: typescript-safe-pick-function
lang: ja
otherLang: [en]
---

## pick関数
`lodash`などにはオブジェクトと抽出するプロパティ名の配列を受け取り、指定されたプロパティのみを含むオブジェクトを返す`pick`関数が存在します。以下のような関数です。

```ts
// { a: 1, c: 3 }
pick({ a: 1, b: 2, c: 3 }, ["a", "c"])
```

今回はこの関数に安全な型定義をすることを考えていきます。

## 単純な型定義とその問題点
まず思いつくのは以下のような型定義だと思います。

```ts
declare function pick<A, K extends keyof A>(obj: A, keys: K[]): Pick<A, K>;

// ex1: { a: number }
const ex1 = pick({ a: 1, b: 2, c: 3 }, ["a"]);

// ex2: { a: number, b: number }
const ex2 = pick({ a: 1, b: 2, c: 3 }, ["a", "b"]);

// ex3: {}
const ex3 = pick({ a: 1, b: 2, c: 3 }, []);
```

この型定義、型パラメーターを明示的に渡さず型推論に頼っている限り正しく動きますが、以下にように書くと問題が発生します。

```ts
// ex4 = {}
// ex4: { a: number, b: number, c: number }
const ex4 = pick<{ a: number, b: number, c: number }, "a" | "b" | "c">({ a: 1, b: 2, c: 3 }, []);
```

値は`{}`なのに型が`{ a: number, b: number, c: number }`になってしまいました。

## 解決方法の方針
値として渡されていないリテラル型がunionに入ってしまったことが問題の原因です。これを解決するにはいくつか方法がありますが、今回はタイトルの通り型パラメーターを単一のリテラル型に制限する方法を紹介します。そのためにまず、型パラメーターとして`"a" | "b"`のようなunion型を受け取るのではなく`["a", "b"]`のようなタプル型を受け取るようにします。次に`["a", "b" | "c"]`のように要素に2個以上のunion型を含むタプル型を拒否するようにします。(0個のunion型、すなわち`never`を含むタプル型は値が存在しないので弾く必要はありません)

## 型パラメーターとしてタプルを受け取る
まず型パラメーターとしてkeyのunionを受け取る現状では情報量が足りないので以下のようにタプルを受け取るようにします。

```ts
type ArrayElement<A> = A extends Array<infer R> ? R : never;

declare function pick<A, K extends [] | [keyof A, ...(keyof A)[]]>(
  obj: A,
  keys: K
): Pick<A, ArrayElement<K>>;
```

`K extends [] | [keyof A, ...keyof A[]]`という制約は型推論を配列ではなくタプルにするためのテクニックです。
もし`K extends (keyof A)[]`であれば可変長引数を除いてタプルより配列の推論が優先される仕様が原因で、`pick({ a: 1, b: 2 }, ["a"])`というコードを書いた時`K`が`"a"[]`と推論されてしまいます。しかし`[] | [X, ...X[]]`は`[]`や`[X]`、`[X, ...X[]]`は含むが`X[]`は含まない型なので配列ではなくタプルとして推論してくれます。

## 型パラメーターに複雑な制約を設定する
上記の変更で型パラメーターでタプルを受け取ることができるようになったので、次は型パラメーターのタプルの各要素に2個以上のunionを含まないようにするだけです。ついでに長さが有限でないタプル、`[A, ...A[]]`のようなものも必要ないので制限してしまいましょう。これには`Enforceパターン`(と私が勝手に呼んでいるだけ)を使います。
`Enforceパターン`では引数を型パラメーター`A`が複雑な制約を満たしていなければ`never`(もしくは`[never]`のような値が存在しない型)にすることで制約を満たしていない時関数を呼び出せないようになり、これが制約になります。よくあるのは`EnforceXXX<A>`という`A`が制約を満たしていれば`A`を、満たしていなければ`never`を返す型関数を用意し、引数の`x: A`を`x: EnforceXXX<A>`にする方法です。`x: EnforceXXX<A> & EnforceYYY<A>`のように交差型でつなげることで複数の制約も表現できます。

例として空オブジェクトの型パラメーターを弾く関数は以下のようになります。

```ts
type EnforceNotEmptyObject<A> = keyof A extends never ? never : A;
declare function f<A>(x: EnforceNotEmptyObject<A>): void;
f({}); // コンパイルエラー
f({ x: 1 });
```

では実際に使う`Enforce`型関数を定義していきましょう。
まず`EnforceLiteralType`です。これは`"x"`や`1`のようなリテラル型は許可するが`string`や`number`のような型は許可したくないときに使えます。`string`や`number`は`string`や`number`を含むunionのサブタイプになることを利用して分岐しています。


```ts
type LiteralType = keyof any;

type EnforceLiteralType<A extends LiteralType> = string extends A
  ? never
  : number extends A
  ? never
  : symbol extends A
  ? never
  : A;
```

次に`EnforceFiniteTuple`です。これは有限な長さのタプルなら`length`が`number`ではなく`1`のようなリテラル型になることを利用しています。

```ts
type EnforceFiniteTuple<A extends any[]> = number extends A["length"]
  ? never
  : A;
```

次に`EnforceSingleUnion`です。これはちょっと複雑です。`1`や`string`のような型は許可するが`1 | 2`のような2つ以上のunionは弾きます。
これはcondtional typeの分配を使っています。もし2つ以上のunionでなければ`Exclude<元の型, 分配後の単一の型>`は`never`になり、`never`でなければ2つ以上のunionです。これを使って分岐しています。

```ts
type _EnforceSingleUnion<A, A_ = A> = A extends any
  ? Exclude<A_, A> extends never
    ? A_
    : never
  : never;

type EnforceSingleUnion<A> = _EnforceSingleUnion<A>;
```

これらを組み合わせて最後に`EnforceSingleLiteralType`と`EnforceSingleLiteralTypeFiniteTuple`を定義します。
`EnforceSingleLiteralType`は`EnforceSingleUnion`かつ`EnforceLiteralType`、`EnforceSingleLiteralTypeFiniteTuple`の`EnforceFiniteTuple`かつ各要素が`EnforceSingleLiteralType`です。

```ts
type Cast<A, B> = A extends B ? A : B;

type EnforceSingleLiteralType<A extends LiteralType> = EnforceSingleUnion<A> &
  EnforceLiteralType<A>;
type EnforceSingleLiteralTypeFiniteTuple<
  A extends LiteralType[]
> = EnforceFiniteTuple<A> &
  {
    [I in keyof A]: EnforceSingleLiteralType<Cast<A[I], LiteralType>>;
  };
```

## pick関数を安全にする

最後にこのような型関数を使って以下のようにすることで安全にすることができます。`PickTuple`は`K`に`[] | ["a"]`みたいなのが渡されたとき壊れないようにするために作っています。

```ts
type PickTuple<A, K extends (keyof A)[]> = K extends any
  ? Pick<A, ArrayElement<K>>
  : never;

declare function pick<A, K extends [] | [keyof A, ...(keyof A)[]]>(
  obj: A,
  keys: EnforceSingleLiteralTypeFiniteTuple<K>
): PickTuple<A, K>;
```

```ts
pick({ x: 1 }, []);
pick({ x: 1 }, ["x"]);
pick({ x: 1, y: 2, z: 3 }, ["x", "z"]);
// エラー
pick<
  {
    x: number;
    y: number;
    z: number;
  },
  ["x" | "z", "z"]
>({ x: 1, y: 2, z: 3 }, ["x", "z"]);
```

## 他の解決策(おまけ)
他の解決策として結果型を工夫する方法もあります。
例えば引数が`["a", "b" | "c"]`なら結果を`{ a: ..., b: ... } | { a: ..., c: ... }`のようにすれば正しい型定義となります。

```ts
type Head<T extends any[]> = T extends [infer X, ...any[]] ? X : never;
type Tail<T extends any[]> = ((...x: T) => void) extends (
  x: any,
  ...xs: infer XS
) => void
  ? XS
  : never;

type PickSingle<A, K extends keyof A> = K extends any ? Pick<A, K> : never;

type PickTuple<A, K extends (keyof A)[]> = K extends any
  ? {
      0: {};
      1: PickSingle<A, Cast<Head<K>, keyof A>> & PickTuple<A, Tail<K>>;
    }[K extends [] ? 0 : Head<K> extends never ? 0 : 1]
  : never;

declare function pick<A, K extends [] | [keyof A, ...(keyof A)[]]>(
  obj: A,
  keys: K
): PickTuple<A, K>;
```

`[A, B, ...C[]]`などのケースも考慮するとこんな感じの型定義になります。(`Head<A[]>`が`never`であることを利用しています)
