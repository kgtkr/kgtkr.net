---
title: JavaScriptのアロー関数(ラムダ式)でオブジェクトを返す
date: "2017-09-06T06:52:34.000Z"
update: "2017-09-06T06:52:34.000Z"
tags: ["javascript"]
name: javascript-arrow-function-return-object
lang: ja
---
# 構文エラー
```js
()=>{x:1}
```

# 長い
```js
()=>{return {x:1};}
```

# こうしよう
```js
()=>({x:1})
```
