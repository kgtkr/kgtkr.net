---
title: TypeScriptでランタイム型チェックを行う「io-ts」の軽い紹介
date: "2019-04-11T12:55:14.000Z"
update: "2019-04-11T12:55:14.000Z"
tags: ["typescript","typelevelprogramming"]
name: io-ts
lang: ja
otherLang: []
---
# TypeScriptのランタイム型チェック
TypeScriptにはランタイム型チェック機能がありません。
次のようなコードも正常にコンパイルされエラーが発生することなく動作します。

```ts
const x: string = JSON.parse("1");
```

これはパフォーマンスなどとのトレードオフなので仕方ないのですが、部分的に動的な型チェックをしたいときもあります。
このような時の解決策として`io-ts`を紹介します。

# io-tsのメリット
`JSON Schema`などは型とスキーマを2つ書く必要があり大変です。
また大変なだけでなく型とスキーマが異なるといったバグを型システムでチェックすることが出来ません。
コードジェネレーターを使うことで解決できますが、TypeScript上で完結しないのでめんどくさいです。
このような問題は`io-ts`を使うことで解決します。
ただし再帰型については型推論の関係で型とスキーマを2回書く必要がありますが、型チェックでスキーマと型が違っていればコンパイルエラーが発生します。

# 基本的な使い方
```ts
import * as t from "io-ts";

const hoge = t.type({
  tag: t.literal("Hoge"),
  x: t.string,
  y: t.union([t.number, t.null]),
});

type Hoge = t.TypeOf<typeof hoge>;
/*
type Hoge = {
  tag: "Hoge",
  x: string,
  y: number | null,
};
*/

hoge.is(JSON.parse(str));
```

もっと詳しい使い方は`io-ts`のREADMEを見ればすぐ分かるのでこっちを見て下さい。
https://github.com/gcanti/io-ts

# どうやって実現しているのか
※ここから先はライブラリを使う分にはあまり知らなくていい情報です。

TSはデコレーターという例外を除いて、型情報から値を生成することは出来ません。
しかし、`typeof`を使うことで値から型を生成することは出来ます。
そこでスキーマ情報をなるべく具象型で(例えば単にSchemeのような型ではなくSchemeの構造を完全に持っている型)持つように型推論を制御して、`typeof`で値から型を作ることでこのような事が可能になります。
ちなみにTS3.4で`as const`が入ったので今までより具象型で持つのが楽になりました。
これはio-tsに限らずTSを使う時に知っておくと役に立つ考え方です。

ちなみに作者のgcanti氏は`fp-ts`の作者でもあり、他にもTSの型システムを最大限活用したライブラリを多数公開しているので見てみると面白いかもしれません。
