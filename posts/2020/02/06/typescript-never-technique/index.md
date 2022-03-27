---
title: TypeScriptで安全にランタイム型チェックを行う〜網羅性チェックとnever型〜
date: "2020-02-06T09:25:23Z"
update: "2020-02-06T09:25:23Z"
tags: ["typescript"]
name: typescript-never-technique
lang: ja
otherLangs: []
---

以下のコードを見てください。

```ts
type HogeUnion = 1 | 2;

function printHogeUnion(x: HogeUnion) {
  console.log(x);
}
```

`HogeUnion`型、つまり`1 | 2`である`x`を受け取って出力するだけの単純な関数`printHogeUnion`を定義しています。何も問題がないコードです。

もしTSの型の健全性が壊されて`x`に`1 | 2`以外の値が入ってきた時にすぐ気付けるようにランタイム型チェックを行いたくなったとしましょう。例えば`printHogeUnion(0 as any)`を実行すると`0`を出力するのではなく例外を投げるといった具合です。この時`unreachable`関数を定義し、`printHogeUnion`にランタイム型チェックのコードを追加して以下のようになります。

```ts
function unreachable(): never {
  throw new Error("unreachable");
}

function printHogeUnion(x: HogeUnion) {
  if (x !== 1 && x !== 2) {
    unreachable();
  }

  console.log(x);
}
```

このコードは確かに正しいです。しかし問題もあります。それは仕様変更にとても弱いという事です。例えば`HogeUnion`の型を`1 | 2 | 3`にし、`printHogeUnion`の修正を行わないとどうなるでしょう。

```ts
type HogeUnion = 1 | 2 | 3;

function printHogeUnion(x: HogeUnion) {
  if (x !== 1 && x !== 2) {
    unreachable();
  }

  console.log(x);
}
```

このコードはコンパイルが通ります。しかし`printHogeUnion`にあるランタイム型チェックの処理の修正を忘れているので`printHogeUnion(3)`を実行すると例外が投げられます。これはバグです。この程度ならすぐに気付けますがもし`HogeUnion`を使っておりランタイム型チェックをこのようにしている関数がたくさんあれば修正漏れが発生しそうです。
このような場合、`never`型を受け取って例外を投げる関数`safeUnreachable`を定義して使うと上手くいきます。

```ts
function safeUnreachable(_x: never): never {
  throw new Error("unreachable");
}

type HogeUnion = 1 | 2 | 3;

function printHogeUnion(x: HogeUnion) {
  if (x !== 1 && x !== 2) {
    safeUnreachable(x); // コンパイルエラー
  }

  console.log(x);
}

```

こうすると`x`は`3`型なのでコンパイルエラーになってランタイム型チェックの修正漏れにすぐ気づくことができます。`printHogeUnion`を以下のように修正するとコンパイルが通ります。

```ts
function printHogeUnion(x: HogeUnion) {
  if (x !== 1 && x !== 2 && x !== 3) {
    safeUnreachable(x);
  }

  console.log(x);
}
```

`never`型の変数は型の健全性が保たれている限り値が存在しません。つまり`never`型の値が出てくるコードには到達しません。これは到達可能なコードであれば`never`型の値を作ることができないということでもあります。
つまり仕様変更などでそのコードに到達可能になればコンパイルエラーが発生しすぐにバグに気づくことができます。これで安全にランタイム型チェックが行えるようになりました。


ちなみにこれは以下のような応用も可能です。


```ts
function foo(x: 1 | 2) {
  if(x === 1) {
    console.log("a");
    return;
  }

  if(x === 2) {
    console.log("b");
    return;
  }

  safeUnreachable(x);
}
```

こうすることでもし`x: 1 | 2 | 3`になったときにすぐ修正漏れに気づくことができます。
