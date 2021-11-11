---
title: Angularで余計なタグを出力せずに再起してMarkdownのASTを表示したい
date: "2017-08-30T15:17:19.000Z"
update: "2017-08-30T15:17:19.000Z"
tags: ["angular"]
name: angular-ast
lang: ja
---
# 余計なタグとは
下記のようなテンプレートがあったとします。

```html
//<my-msg>コンポーネント
<div>{{msg}}</div>
//使う
<my-msg [msg]="'はろー'"></my-msg>
```

reactやvue.jsの場合以下のように出力されます。

```html
<div>はろー</div>
```

しかしAngularの場合は以下のように出力されます。


```html
<my-msg><div>はろー</div></my-msg>
```

つまり余計なタグとは`<my-msg>`など独自コンポーネントのセレクターの事です。

# 一般的な場合の回避方法
selectorを`div[myMsg]`と指定し、テンプレートを以下のようにすることで回避する事が出来ます。

```html
//定義
{{msg}}

//使用
<div myMsg [msg]="'はろー'"></div>
```

しかし、この方法はASTの再起では使えません。
(正確には使えないことはないがNodeの種類^2コピペしないといけないのでしたくない)

# 解決方法
ng-templateとngTemplateOutletを使うことで解決出来ます。

```html
<ng-container *ngTemplateOutlet="tempRef; context: {n:node}"></ng-container>
<ng-template #tempRef let-n="n">
  <ul>
    <li>{{n.msg}}</li>
    <ng-container *ngFor="let c of n.children">
      <ng-container *ngTemplateOutlet="tempRef; context: {n:c}"></ng-container>
    </ng-container>
  </ul>
</ng-template>
```
