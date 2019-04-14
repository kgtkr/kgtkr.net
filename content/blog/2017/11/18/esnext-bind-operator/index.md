---
title: ESNextのbind operatorを使って拡張メソッドみたいな事をする
date: "2017-11-18T06:55:51.000Z"
update: "2017-11-18T06:55:51.000Z"
tags: ["javascript","esnext"]
name: esnext-bind-operator
---
# bind operatorとは
`func.call(obj)`を`obj::func()`と書けるシンタックスシュガーです。
`::obj.func`と書くと`obj.func.bind(obj)`となる構文もありますが今回は不要なのでスルーします

# 今までのJavaScript
ここでは例として引数の文字列を2倍して返す関数twoを作ります

```js
function two(str){
  return str+str;
}
```

呼び出し

```js
two('x');//'xx'
```

# 問題点
この程度なら特に問題はありません。
しかし、文字列加工の処理などで以下のような事になってしまう事ありますよね？

```js
z(y(x(str)));
```

まず括弧の対応が分かりにくいです。
そして関数はx→y→zの順に呼び出されるのに、見た目はz→y→xと逆になってしまいます。
# プロトタイプ拡張は？
名前の衝突などの危険があるので使いたくない。
# bind operator
```js
function two(){
  return this+this;
}
```

呼び出し

```js
"x"::two();
```

この構文なら綺麗に書けます。
名前衝突の心配もありません。
さっきの`z(y(x(str)))`も`str::x()::y()::z()`と書けます。
# 注意
babelが必要です。
あとstage-0なので仕様が変わるかも

# tc39
* 
