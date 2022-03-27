---
title: immutable.js v4でTypeScriptの型定義が改善された
date: "2017-12-02T15:10:30.000Z"
update: "2017-12-02T15:10:30.000Z"
tags: ["typescript"]
name: immutablejs-v4-typescript-type-definition
lang: ja
otherLang: []
---
# strictNullChecks時の改善
今まではmapやforEach関数に渡すコールバックの第一引数が`T?`でしたが、v4では`T`になりました。
これによってstrictNullChecks時でも`!`が不要になりました。
例:

```ts
//v3以前
x.map(x=>x!+1);

//v4
x.map(x=>x+1);
```

v3以前もxにundefinedやnullが渡されることはなかったのに型定義は`T?`で気持ち悪かったので修正されてよかったです。

# Recordが型安全になった
```ts
const MyRecord = Record({ x:1,y:2 });
const myRecord = new MyRecord({});

//v3以前は以下のコードのコンパイルが通る
//v4では型エラーになる
myRecord.get('a');
```

今までは型安全じゃなかったのでRecordを使うのは避けていたのですが、これによって安心して使えるようになりました。
