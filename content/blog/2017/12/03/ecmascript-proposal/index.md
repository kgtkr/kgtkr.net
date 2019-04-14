---
title: EcmaScriptの個人的に気になる新機能提案
date: "2017-12-02T15:10:49.000Z"
description: ""
tags: ["javascript","esnext"]
name: ecmascript-proposal
---
[tc39のリポジトリ](https://github.com/tc39)を中心に気になる提案をまとめます。

# do expressions(stage-1)
## リポジトリ
https://github.com/tc39/proposal-do-expressions

## 概要
関数型言語のようにifやtry、switchなどを式のように扱えるようにする為にdo式を追加しようという提案です。

## 例
```js
let b = true;
let x = do {
  if (b) {
    'hoge';
  } else {
    'foo';
  }
};
assert(x === 'hoge');
```

## その他
「doいらなくね？普通にifなどを式として扱おうぜ」みたいなissueがあがっています。
https://github.com/tc39/proposal-do-expressions/issues/9
何故これではダメなのかはよく分かりません。後方互換性的な問題があるのでしょうか？

# optional chaining(stage-1)
## リポジトリ
https://github.com/tc39/proposal-optional-chaining

## 概要
kotlinやangularのテンプレートなどで使える`?.`構文の提案です。

## 例
```js
let obj = null;
let a = obj?.x;
assert(a === null);
```

```js
let f = null;
let a = f?.();
assert(a === null);
```

# pipeline operator
## リポジトリ
https://github.com/tc39/proposal-pipeline-operator

## 概要
Elmなどにあるパイプライン演算子です。
これが追加されればプロトタイプ汚染をすることなく拡張メソッドのような事を出来ます。

## 例
```js
function f(str) {
  return str + str;
}
const x = 'x' |> f;
assert(x === 'xx');
```

awaitにも使えます。
async/await使ったことある方なら分かると思うんですが、あれ前置演算子なので括弧だらけになるんですよね。
それが改善されそうなので嬉しいです。

```js
const google = 'https://google.com' |> http.get |> await;
```

# bind operator
## リポジトリ
https://github.com/tc39/proposal-bind-operator

## 拡張メソッド的な使い方
### 概要
pipeline operatorみたいに拡張メソッドのような事のような事をできる機能です。
こっちの方がOOPっぽいですね。あっちはFPっぽいので。
pipeline operatorが追加されるならなくてもいいかなって感じです。await機能もないし…

### 例
上のpipeline operatorの例をbind operatorで書きなおした版。

```js
function f() {
  return this + this;
}
const x = 'x'::f();
assert(x === 'xx');
```

## メソッドにthisをバインド
### 概要
突然ですが、以下のJSを実行したらどうなるか分かりますか？

```js
class Hoge {
  constructor(name) {
    this.name = name;
  }

  log() {
    console.log(`name is ${this.name}`);
  }
}

const hoge = new Hoge();
const log = hoge.log;
log();
```

普段JSを書いている方なら分かると思います。
`Uncaught TypeError: Cannot read property 'name' of undefined`
とエラーが出ますよね？
これReactなどで凄く不便ですよね。それを解決するのがbind operatorです。

### 例
```js
//クラス定義省略
const hoge = new Hoge();
const log = ::hoge.log;
log();
```

### bindじゃ駄目なの？
これでも勿論動きます。

```js
//クラス定義省略
const hoge = new Hoge();
const log = hoge.log.bind(hoge);
log();
```

でもhogeって二回書くの面倒じゃないですか？
しかも、もし`a.b.c.d.e`の`f`を呼びだそうと思ったら

```js
const f = a.b.c.d.e.f.bind(a.b.c.d.e);
f();
```

と大変な事になってしまいます。
でもbind operatorなら

```js
const f = ::a.b.c.d.e.f;
f();
```

と書くだけです。楽ですよね？
# その他
* [パターンマッチ](https://github.com/tc39/proposal-pattern-matching)
* [JSのバイナリフォーマット](https://github.com/syg/ecmascript-binary-ast)
* [ジェネレーター関数でもasync使いたい](https://github.com/tc39/proposal-async-iteration)
* [TypeScriptのようなクラスフィールド](https://github.com/tc39/proposal-class-fields)
* [flatMap](https://github.com/tc39/proposal-flatMap)
* [正規表現でユニコード文字プロパティ(`[\p{Han}]`みたいな事が出来るようになる)](https://github.com/tc39/proposal-regexp-unicode-property-escapes)
* [throw式](https://github.com/tc39/proposal-throw-expressions)
