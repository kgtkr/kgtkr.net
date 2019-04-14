---
title: TypeScriptのArray#filterでType Guard(Like Smart Cast)する
date: "2017-09-10T09:12:11.000Z"
tags: ["typescript"]
name: typescript-array-filter-type-guard
---
# 普通に書く
```ts
let arr1:(number|string)[]=['a','b','c',1,2,3];
let arr2=arr1.filter(x=>typeof x==='string');
```
arr2にはstringしか入ってないはずなのに型は(number|string)[]になってしまいます。

# 型ガード
```ts
let arr2 = arr1.filter<string>((x): x is string => typeof x === 'string');
```
これでarr2はstring[]になります。

# 注意
```ts
let arr2=arr1.filter<number>((x): x is number => typeof x === 'string');
```
このような事をしてもコンパイルエラーにはなりません。
arr2の実際の型はstring[]なのにTypeScriptはnumber[]と認識します。
キャストと同じように危険な操作なので注意しましょう。

# 他のライブラリ
immutable.jsやrxjsでも似たような事を出来ます。
