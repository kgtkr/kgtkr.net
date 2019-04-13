---
title: TypeScriptで型定義されていないモジュールを読み込む方法
date: "2017-11-06T12:11:53.000Z"
description: ""
tags: ["typescript"]
---
# 普通に
普通に読み込むとエラーになります。

```ts:app.ts
import * as hoge from 'hoge';
```

# 推奨
ソースフォルダに`適当な名前.d.ts`ファイルを作って以下の内容を書きます。

```ts:types.d.ts
declare module 'hoge';
``` 

あとは普通に読みこめばOKです。

```ts:app.ts
import * as hoge from 'hoge';
```

## ワイルドカード
ワイルドカードも使えます。

```ts:types.d.ts
declare module '*';
``` 

# 非推奨
これでも一応出来ますが、あまりおすすめはしません。

```ts:app.ts
declare function require(path: string): any;
const hoge = require('hoge');
```

# 参考
* https://github.com/Microsoft/TypeScript/issues/6615
