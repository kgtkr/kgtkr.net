---
title: TypeScriptのunsafeな操作まとめ
date: "2018-06-23T08:16:36.000Z"
description: ""
tags: ["typescript"]
name: typescript-unsafe
---
# 初めに
TypeScript(以下TS)はJSに型を付けた静的型付け言語です。
しかし型システムにはかなりの罠があり、知らないと型システム整合性を壊してしまいます。
そこで今回はそのような操作をまとめてみました。
間違え、不足等があればコメントで指摘してくれると嬉しいです。
ソースコードは[GitHub](https://github.com/kgtkr/ts-unsafe)においています。

# なぜ型システムが壊れるのか
TSはコンパイルすると型に関する情報を全て消去したJSを出力するからです。
当然実行時の型チェックは行われません。
これが型システムが壊れる原因です。
これは実行速度とのトレードオフです。


## この記事の目的
この記事は「TSはすぐ型システムが壊れるのでひどい」と批判することが目的ではありません。
実行時のオーバーヘッドを無くすことや便利さなどとのトレードオフであることは理解しています。
「このような操作をすると壊れるかもしれない」ということを知ってもらう事が目的です。

# unsafeの定義
`unsafe`は公式の用語ではなく私が勝手にそう呼んでいるだけなので用語を定義します。

* 型システムが整合性を取れている状態で行うと型システムの整合性を壊す事がある操作

## unsafeで無い例
### 例外
TSの型システムでは例外を投げるかは保証されていないのでunsafeではありません。

```ts
function throwError(): string {
  throw new Error();
}

const x = throwError();//stringが返ってくると型は言っているのに例外を投げられた
```

### 既に整合性が壊れている

```ts
const x: string = {} as any;
const y: string = x;//yはstringのはずなのに{}が代入
```
これは1行目の時点で既に型システムの整合性が壊れているので、2行目の代入操作はunsafeではありません。
1行目のキャストがunsafeです。

# バージョン、設定など
TypeScript:2.9.2を使います。
またstrictを有効にしている事を前提に話を進めます。
string型にnullやundefinedが入るなどといった場合もunsafeと見なします。
またstrictを有効にすることで安全になる操作も扱いません。

# 一覧
コメントの`x:T1→T2`は`xは型システムではT1であるが、実際はT2`という事を示します。

## 型変換関連
### キャスト
おそらく最も代表的な例ですね。型システムの整合性は保証されません。

```ts
const a: string = 1 as any;
//a:string→number
const b = <string><any>1;
//b:string→number
```

### non-null assertion operator
キャストと似ていますが、null/undefined許容型を非許容型に変換する演算子です。

```ts
const a: string | null = null;
const x: string = a!;
//x:string→null

const b: number | undefined = undefined;
const y: number = b!;
//y:number→unefined
```

### anyから他の型への変換
この問題を解決するためにTS3.0で`unknown`型が導入される予定です。

```ts
const x: string = JSON.parse("1");
//x:string→number
```

## Type Guard関連
とても便利な機能ですが再代入可能な変数であっても型ガードされるため、よく整合性を壊します。

### 他の関数からの代入
```ts
class Hoge {
  x: string | null = "str";
  setXNull() {
    this.x = null;
  }

  f() {
    if (this.x !== null) {
      this.setXNull();
      //this.x:string→null
    }
  }
}
```

### async
ちなみにPromiseを使うと起こりません。

```ts
async function sleep(ms: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

class Hoge {
  x: string | null = "str";
  async f() {
    if (this.x !== null) {
      await sleep(1000);
      //this.x:string→null
    }
  }
}

const hoge = new Hoge();
hoge.f();
hoge.x = null;
```

### x is T
関数の戻り値で使う「戻り値がtrueならxはTである」という事を示す型です。
isArrayなどで使われています。

```ts
function xIsString(x: any): x is string {
  return true;
}

const s: any = 1;
if (xIsString(s)) {
  //s:string→number
}
```

### 純粋でないgetter
こんな事する人はいないと思いますが

```ts
class Hoge {
  isGet = false;
  get x(): string | null {
    if (!this.isGet) {
      this.isGet = true;
      return "str";
    } else {
      return null;
    }
  }
}

const hoge = new Hoge();
if (hoge.x !== null) {
  //hoge.x:string→実際
}
```

### in演算子
`{x:number}`に`{x:number,y:number}`を代入することは当然出来ますが…

```ts
function f(x: { x: number } | { a: number, b: number }) {
  if ("a" in x) {
    //x.b:number→undefined
  }
}

const obj = { x: 1, a: 1 };
f(obj);
```

## this
JSのコンテキスト関連です。
TSの型システムではメソッドと関数の区別は行われず、メソッドを変数等に代入することが出来るため型システムを壊す事があります。

```ts
class Hoge {
  f() {
    //this:Hoge→undefined
  }
}

const f = new Hoge().f;
f();
```

## declare
これも当然ですが、整合性の保証はされません。型定義ファイルも含みます。

```ts
declare const x: string;
//x:string→undefined
```

## Definite Assignment Assertion
「プロパティは必ず初期化される」ということをコンパイラに教えてあげる文法なので当然初期化されるかはプログラマの責任です。

```ts
class Hoge {
  x!: string;
  f() {
    //x:string→undefined
  }
}

new Hoge().f();
```

## Indexアクセス
JSの仕様上、存在しないインデックスを指定しても例外を投げずにundefinedを返しますが、TSの型システムは`T|undefined`ではなく`T`を返すと見なすので型システムを壊す事があります。
[issue](https://github.com/Microsoft/TypeScript/issues/13778)

```ts
const arr: number[] = [];
const n = arr[0];
//n:number→undefined
const obj: { [key: string]: number } = {};
const s = obj["key"];
//s:number→undefined
```

## ts-ignore
型チェックを無効にする機能です。当然何が起こるか分かりません。

```ts
//@ts-ignore
const x: string = 1;
//x:string→number
```

## 引数に代入
```ts
function f(x: { a: string | null }) {
  x.a = null;
}

const obj = { a: "str" };
f(obj);
//obj.a:string→null
```
