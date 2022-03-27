---
title: TypeScriptでオブジェクトのキー集合の値表現に関する考察
date: "2019-08-27T10:57:04.214Z"
update: "2019-08-27T10:57:04.214Z"
tags: ["typescript"]
name: typescript-value-of-object-keys
lang: ja
otherLang: []
---

## 初めに
この記事は型安全な型定義とそれが可能な実装に関する考察であり利用者側にとっての使いやすさなどは考慮していません。ここに型安全ではない例としてあげた、もしくそれと同じような定義となっているライブラリも型推論に頼っていれば基本的に安全な事と、使いやすさを考えると仕方ない部分があることは理解しておりそのようなライブラリに対する批判でもありません。  
曖昧な知識で考えた自分用メモのようなものなので間違っている所がある可能性は高いですし参考にはしないで下さい。間違ってる所があればTwitterなどで指摘してくださると嬉しいです。

## オブジェクトのキーの集合の値表現
以下のような関数定義があるとする。

```ts
function f<T extends object, K extends keyof T>(obj: T, keys: Keys<K>): Result<T, K>;
```

この時型コンストラクタ`Result`の性質によって場合分けし、`Keys`、つまりオブジェクトのキー集合の安全な受け取り型を考える。
また`obj: T`と`keys: Keys<K>`を受け取り`obj`に存在しないキーを削除した`Set`を返す`keysToSet(obj, keys)`が存在するものとする。

## 安全でないキー集合の受け取り型の例
まず安全ではない受け取り方の例を示す。  
よくある例としてキー集合として配列を受け取る`pick`関数がある。(例: `lodash`)
これは以下のような関数である。

```ts
pick({x: 1, y: 2, z: 3}, ['x']); // {x: 1}
```

この時`Keys = Array, Result = Pick`となり、型定義は以下のようになるだろう。

```ts
function pick<T extends object, K extends keyof T>(obj: T, keys: Array<K>): Pick<T, K>;
```

しかしこの型定義は型安全ではない。なぜなら以下のような書き方をされると値は`{x: 1}`なのに型は`{x: number, y: number, z: number}`となり矛盾が発生するからである。  

```ts
pick<{x: number, y: number, z: number}, "x" | "y" | "z">({x: 1, y: 2, z: 3}, ["x"]);
```

このような矛盾が発生するのは`Array<"x" | "y" | "z">`という型は配列の全ての要素が`"x" | "y" | "z"`を満たすという事を表しているのに、この関数では`{ "x", "y", "z" }`という型集合の全ての要素が配列の要素に存在することを期待しているからです。  
また逆に型に矛盾を起こさないがコンパイルエラーになる例として`pick<{x: number, y: number, z: number}, "x">({x: 1, y: 2, z: 3}, ["x", "y"])`などが存在する。  
以上の事をまとめると以下のようになる。

```
Array<"x" | "y">に許される値の例(keysToSet適用済み):
Set([]), Set(["x", "y"])

keysが実際に期待している値の例(keysToSet適用済み):
Set(["x", "y"]), Set(["x", "y", "z"])
```

## pick関数で型安全にキーを受け取る
受け取り方の条件は上記のまとめから以下のようになる。

1. unionの型集合の全ての要素の型が存在するSetに変換可能
2. 変換後のSetにunionの型集合に存在しない要素が含まれていても良い

これを満たす`Keys`の一つに`Record<K, null>`がある。  
`Record<"x" | "y", null>`に`{ x: null }`は代入できないので`1`を満たすし、`{ x: null, y: null, z: null }`を代入できるので`2`を満たす。  
つまりこのように`keys`を受け取ることで安全に`pick`関数を定義出来る。

## 配列で受け取るほうが安全な例
しかしいつでも`Record<K, null>`が安全なわけではない。逆に`Array<K>`が安全な例も存在する。  
それの例が`Result = Omit`の`omit`関数である。
なぜなら`omit<{x: number, y: number, z: number}, "x" | "y">({x: 1, y: 2, z: 3}, [])`は型に矛盾を起こさないが、`omit<{x: number, y: number, z: number}, "x">({x: 1, y: 2, z: 3}, { x: null, y: null })`は矛盾を起こすからである。  

## オブジェクトと配列、どっちで受け取るか
では`pick`と`omit`の`Result`である`Pick`と`Omit`の違いはどこだろう。どのような`Result`の時にオブジェクトでキー集合を受け取り、またどのような時に配列でキー集合を受け取ればいいのだろうか。  
`Pick`と`Omit`の大きな違いは`K`に対して反変性を持つか共変性を持つかである。  
`A extends B`の時、`Pick<T, B> extends Pick<T, A>`なので反変、`A extends B`の時、`Omit<T, A> extends Omit<T, B>`なので共変である。  
また`get`のみを考えた場合、`Array`は共変、`Record<K, null>`は反変となる。  
つまり、`Array<A> extends Array<B>`の時、`Omit<T, A> extends Omit<T, B>`が成り立つし、`Record<A, null> extends Record<B, null>`の時、`Pick<T, A> extends Pick<T, B>`が成り立つ。だから`omit`は`Array`で受け取るべきだし、`pick`は`Record<K, null>`で受け取るべきである。

## 結論
`Result`が`K`に対して共変であれば`Array<K>`でキーの集合を受け取り、反変であれば`Record<K, null>`でキー集合を受け取ると良い。
