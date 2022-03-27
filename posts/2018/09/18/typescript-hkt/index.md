---
title: TypeScriptで高カインド型(Higher kinded types)
date: "2018-09-18T08:39:30.000Z"
update: "2018-09-18T08:39:30.000Z"
tags: ["typescript","typelevelprogramming"]
name: typescript-hkt
lang: ja
otherLangs: []
---
# はじめに
TypeScript(TS)には高カインド型(HKT)がありません。一応[提案](https://github.com/Microsoft/TypeScript/issues/1213)がありますが…
しかし様々な機能を組み合わせればHKTを実現することが出来るのでそれの方法と解説を行います。
この記事ではHKTとは何かなどといった解説は行いません。表記は`*->*`のような表記を使います。
また[fp-ts](https://github.com/gcanti/fp-ts)というライブラリを参考にしています。

# 使う機能
## interfaceのマージ([Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html))
TypeScriptでは同名のinterfaceを複数定義出来ます。
そしてこれらは自動的にマージされます。
例えば次の2つの宣言は同等です。

```ts
export interface Hoge {
    x: number;
}

export interface Hoge {
    y: number;
}
```

```ts
export interface Hoge {
    x: number;
    y: number;
}
```

そしてこの機能は別ファイルや別モジュールで既に定義されているinterfaceを拡張する事も出来ます。
例えば`moment.js`の`Moment`に`myFunc`という関数を追加してみましょう。

```ts
declare module "moment" {
    interface Moment {
        myFunc(): void
    }
}
```

こうすることで次のコードがコンパイル通るようになります。

```ts
import * as moment from "moment";

moment().myFunc();
```

## Index Type
型レベルのインデックスアクセスです。

```ts
interface Hoge {
    x: number
}

type X = Hoge["x"];
```

こうすることで`X`が`number`になります。これだけです。


# HKTを実現する
## 方針
TypeScriptでは型コンストラクタを型パラメーターに渡したりすることが出来ません。
つまり型コンストラクタのままでは不便なのです。
そこで型コンストラクタの実体を一意のIDをつけて別の場所に置いておき、型パラメーターにはそのID(これは型コンストラクタではなく型なので簡単にやり取り出来る)を渡すという事を行います。
IDは文字列リテラル型かunique symbolです。衝突を考えるとunique symbolがおすすめですが、今回は文字列リテラル型を使用します。

## 実装
まず次のような空のinterfaceを定義します。

hkt.ts
```ts
export interface HKT<T> {

}
```

次に実際にHKTとして使う型コンストラクタを追加していきます。この型の追加は別ファイルから行うことも別パッケージから行う事も出来ます。
また追加は複数に分けて行えます。
同階層の別ファイルから行う場合は次のようになります。

type.ts
```ts
export class Type1<T> {
  constructor(public x: T) { }
}

export class Type2<T>{
  constructor(public y: T) { }
}

declare module "./hkt" {
  interface HKT<T> {
    Type1: Type1<T>,
    Type2: Type2<T>
  }
}

```

この時interfaceのプロパティ名が型コンストラクタのIDとなります(ここでは`"Type1"`と`"Type2"`)

次に型コンストラクタを受け取る側の定義です。

functor.ts
```ts
import { HKT } from "./hkt";

export interface Functor<T, F extends keyof HKT<any>> {
  map<P>(f: (x: T) => P): HKT<P>[F]
}
```

ここでいくつかポイントがあります。
まず`F extends keyof HKT<any>`です。これは受け取る型コンストラクタIDを`HKT<T>`で定義されているもの、つまり`*->*`のみに制限しています。
例えば次のような空のinterfaceを定義して、`F extends keyof HKT2<any,any>`とすれば`*->*->*`も使えます。

```ts
export interface HKT2<T,P> {

}
```

同じようにしていけば型パラメーターに制約をつけたり、`(*->*)->*`といった複雑なものにも対応出来ます。
ただし全てのkindに命名しないといけないのでそこは少し面倒です。
ちなみに`keyof HKT<any>`で`HKT<T>`に渡している`any`ですが、これはどんな型でも`keyof`の結果は変わらないので問題ありません。
次に`HKT<P>[F]`です。
これはまず`HKT`全体に`P`を渡して型のマップを作り、`[F]`で指定のIDの型を取り出す事で`F<P>`のようなHKTを実現しています。
これがもっとも重要な部分です。

では先ほどの`type.ts`を編集してFunctorを実装してみましょう。

type.ts
```ts
import { Functor } from "./functor";

export class Type1<T> implements Functor<T, "Type1">{
  constructor(public x: T) { }

  map<P>(f: (x: T) => P): Type1<P> {
    return new Type1(f(this.x));
  }
}

export class Type2<T> implements Functor<T, "Type2">{
  constructor(public y: T) { }

  map<P>(f: (x: T) => P): Type2<P> {
    return new Type2(f(this.y));
  }
}
```

これはそのままですね。特徴は`implements Functor<T, "Type1">`で型コンストラクタのIDを渡しているくらいです。
他は特に問題なくそのまま読めると思います。

# 注意点など
* ライブラリ化する時はjsとd.tsで配布するのではなくtsのまま配布して下さい
  * d.tsの`keyof HKT<any>`が`never`になることがありバグります
  * 条件などは不明
  * バグか仕様かの確認のissue出したのでまた追記します
* また他パッケージのHKT interfaceを拡張する場合は内部のフォルダ構造を確認する必要があり少し複雑です
  * 例えば`node_modules/package-name/src/hkt.ts`に定義がある場合`declare module "package-name/src/hkt"`となります
  * `node_modules/package-name/src/index.ts`などで`export * from "./hkt"`といったことがされていてもこのように指定する必要があります
