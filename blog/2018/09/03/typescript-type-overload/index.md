---
title: TypeScriptで型のオーバーライドをしたい
date: "2018-09-03T09:46:03.000Z"
update: "2018-09-03T09:46:03.000Z"
tags: ["typescript"]
name: typescript-type-overload
lang: ja
---
# spread operator
```ts
interface Tweet{
  id:string;
  user:string;
  body:string;
}

//tweetはTweet型、userはUser型とする
let tw={...tweet,...{user:user}};
```
この時の変数twの型を定義したい時どうしますか？
素直に書いてみましょう

```ts
interface Tweet2{
  id:string;
  user:User;
  body:string;
}
```

面倒ですね。プロパティが増えるともっと大変です。

# typelevel-ts
typelevel-tsという便利なライブラリがあります。
このライブラリを使うとこう書けます。

```ts
import {ObjectOverwrite} from 'typelevel-ts';
type Tweet2=ObjectOverwrite<Tweet,{user:User}>;
```
これだけです。

# 他のライブラリ
* type-zoo
* typical

というライブラリもあります。

# 中身を読んでみる
Conditional Types追加以前のこのライブラリは内部でかなり複雑な事をしていてそんな簡単に読めるものじゃなかったのですが、今はかなり読みやすくなりました。
Conditional Typesの勉強にもおすすめです。
https://github.com/gcanti/typelevel-ts/blob/master/src/index.ts
