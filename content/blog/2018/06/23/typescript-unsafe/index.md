---
title: TypeScriptのunsafeな操作まとめ
date: "2018-06-23T08:16:36.000Z"
update: "2019-10-03T05:25:22.937Z"
tags: ["typescript"]
name: typescript-unsafe
lang: ja
otherLang: []
---
# 初めに
TypeScript(以下TS)はJSに静的型システムを取り入れた言語です。
しかしTSの型システムには多くの穴があり、知らないと型の整合性を壊してしまいます。(型システムが健全でないという)
そこで今回はそのような操作をまとめてみました。
間違え、不足等があればコメントで指摘してくださると助かります。

# この記事の目的
この記事は「TSの型システムの穴」を批判することが目的ではありません。
実行時のオーバーヘッドを無くすことや利便性などとのトレードオフであることは理解しています。
TSを書く多くの人が「このような操作をすると型の整合性が壊れることがある」ということを理解した上で使ってほしいというのがこの記事の目的です。

# 型システムの健全性とは
静的言語に限ると、「コンパイルが通ったなら実行時に型情報と値が矛盾しない事が保証されている」事を言います。
例えば「number型の変数に`"hello"`が入っている事は絶対にありえない」といった感じです。Javaなど多くの静的型付け言語の型システムは健全、つまりこのような事が保証されているので「当たり前では？」と思うかもしれませんがTSではこれが保証されていません。

# なぜ型システムが健全になっていないのか
これは実行速度や利便性とのトレードオフです。
「とりあえず型をanyにする」という選択を認める事でJSから移行しやすくしたり、「キャスト時に実行時型チェックを行わない事でJSより遅くなるのを防げる」といったメリットもあります。


# unsafeの定義
`unsafe`は公式の用語ではなく私が勝手にそう呼んでいるだけなので用語を定義します。


* それ以前のコードで型システムの整合性が保たれていても、型システムの整合性を壊す可能性がある操作

## unsafeではない例
### 例外
TSの型システムでは例外を投げるかは保証されていないのでunsafeではありません。

```ts
function throwError(): string {
  throw new Error();
}

const x = throwError(); // stringが返ってくると型は言っているのに例外が飛んできた
```

### 既に整合性が壊れている

```ts
const x: string = {} as any;
const y: string = x; // yはstringのはずなのに{}が代入
```
これは1行目の時点で既に型システムの整合性が壊れているので、2行目の代入操作はunsafeではありません。
1行目のキャストがunsafeです。

# バージョン、設定など
TypeScript:3.6.3を使います。
またstrictを有効にしている事を前提に話を進めます。
string型にnullやundefinedが入るなどといった場合もunsafeと見なします。
またstrictを有効にすることで安全になる操作も扱いません。

# 一覧
コメントの`x: T->X`は`xの型はTだが、Xという値が入っている`という事を表しています。

## 型変換関連
### キャスト
おそらく最も代表的な例ですね。型システムの整合性は保証されません。

```ts
const a: string = 1 as any;
// a: string->1
const b = <string><any>1;
// b: string->1
```

### non-null assertion operator
キャストと似ていますが、null/undefined許容型を非許容型に変換する演算子です。

```ts
const a: string | null = null;
const x: string = a!;
// x: string->null

const b: number | undefined = undefined;
const y: number = b!;
// y: number->undefined
```

### any型の使用
この問題を解決するために`unknown`型があります。

```ts
const x: any = 1;
const y: string = x;
// y: string->1
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
      // this.x: string->null
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
      // this.x: string->null
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
  // s: string->1
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
  // hoge.x: string->null
}
```

### in演算子
`{ x: number }`に`{ x:number, y:number }`を代入することは当然出来ますが…

```ts
function f(x: { x: number } | { a: number, b: number }) {
  if ("a" in x) {
    // x.b: number->undefined
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
    // this: Hoge->undefined
  }
}

const f = new Hoge().f;
f();
```

## declare
これも当然ですが、整合性の保証はされません。型定義ファイルも含みます。

```ts
declare const x: string;
// x: string->undefined
```

## Definite Assignment Assertion
「プロパティは必ず初期化される」ということをコンパイラに教えてあげる文法なので当然初期化されるかはプログラマの責任です。

```ts
class Hoge {
  x!: string;
  f() {
    // x: string->undefined
  }
}

new Hoge().f();
```

## indexアクセス
JSの仕様上、存在しないインデックスを指定しても例外を投げずに`undefined`を返しますが、TSの型システムは`T | undefined`ではなく`T`を返すと見なすので型システムを壊す事があります。
[issue](https://github.com/Microsoft/TypeScript/issues/13778)

```ts
const arr: number[] = [];
const n = arr[0];
// n: number->undefined
const obj: { [key: string]: number } = {};
const s = obj["key"];
// s: number->undefined
```

## ts-ignore
型チェックを無効にする機能です。当然何が起こるか分かりません。

```ts
// @ts-ignore
const x: string = 1;
// x: string->number
```

## 引数に代入
```ts
function f(x: { a: string | null }) {
  x.a = null;
}

const obj = { a: "str" };
f(obj);
// obj.a: string->null
```

## instanceof
TSは構造的部分型を採用しているので`A`型だからといって`A`型を`extends`している、つまり`x instanceof A`が`true`になるとは限りませんがこれで型ガードできるようになっているのが原因で以下のような問題が発生します。

```ts
class A {}
class B {}
function f(x: A | number){
    if(!(x instanceof A)){
        // x: number -> {}
    }
}

f(new B());
```



## 共変
TSはメソッドの引数に型パラメーターが使われていても共変性を持ちます。
共変とは`A extends B`の時`F<A> extends F<B>`となる性質です。引数に型パラメーターが使われている時本来これは健全ではないのですが、利便性などとのトレードオフでこれが許されているので以下のような事がありえます。
`引数に代入`と問題の種類としては似ています。
[なぜ TypeScript の型システムが健全性を諦めているか](https://qiita.com/na-o-ys/items/aa56d678cdf0de2bdd79)という記事に詳しく書いてあるので読んでみて下さい。

```ts
class Hoge<T> {
    constructor(private x: T){}

    getX(): T {
        return this.x;
    }

    setX(x: T){
        this.x = x;
    }
}

const x: Hoge<{ x: number }> = new Hoge({ x: 1 });
const y: Hoge<{}> = x;
y.setX({});
// x.getX(): { x: number } -> {}
```
