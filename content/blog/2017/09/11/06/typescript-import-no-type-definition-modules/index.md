---
title: TypeScriptで型定義されていないモジュールを読み込む方法
date: "2017-11-06T12:11:53.000Z"
description: ""
tags: ["typescript"]
name: typescript-import-no-type-definition-modules
---
# 普通に
普通に読み込むとエラーになります。

app.ts
```ts
import * as hoge from 'hoge';
```

# 推奨
ソースフォルダに`適当な名前.d.ts`ファイルを作って以下の内容を書きます。

types.d.ts
```ts
declare module 'hoge';
``` 

あとは普通に読みこめばOKです。

app.ts
```ts
import * as hoge from 'hoge';
```

## ワイルドカード
ワイルドカードも使えます。

types.d.ts
```ts
declare module '*';
``` 

# 非推奨
これでも一応出来ますが、あまりおすすめはしません。

app.ts
```ts
declare function require(path: string): any;
const hoge = require('hoge');
```

# 参考
* https://github.com/Microsoft/TypeScript/issues/6615
