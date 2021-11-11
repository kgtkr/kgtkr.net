---
title: TypeScriptの型で遊ぶ時、再帰制限を無効化する
date: "2020-09-02T18:22:00.000Z"
update: "2020-09-02T18:22:00.000Z"
tags: ["typescript", "typelevelprogramming"]
name: typescript-disable-recursion-limit
lang: ja
---

## 初めに
TypeScriptの型システムはチューリング完全なので何でも計算できます。
例えば繰り返し。

```ts
type Repeat<T, N extends number, R extends any[] = []> = R["length"] extends N
  ? R
  : Repeat<T, N, [T, ...R]>;

// type A = ["x", "x", "x", "x", "x", "x", "x", "x", "x", "x"]
type A = Repeat<"x", 10>;

```

わーい。ちょっと数増やすか…

```ts
// error TS2589: Type instantiation is excessively deep and possibly infinite.
type A = Repeat<"x", 100>;
```

あれ？(つらい)
再帰制限解除したいですね。しましょう。

## 注意
* 当然ですがプロダクトで使うことは想定していません、やめましょう。

## バージョンなど
* `typescript@4.1.0-dev.20200902`

行番号、コンパイラのコードはこのバージョンの物を引用しています。
`tsc --noEmit --lib esnext app.ts` でコンパイルしています。

## tsc.jsとtsserver.js
npmでTypeScriptをインストールすると `node_modules/typescript/lib/tsc.js` と `node_modules/typescript/lib/tsserver.js` というファイルが作成されます。これがコンパイラと言語サーバーの本体で、バンドラでまとめられたjsファイルです。今回はこれをいじることで再帰制限を無効化します。再帰制限のコードはどちらにも同じものが含まれているので同じ部分を同じように書き換えればいいです。

## 再帰制限のコードを調べて消す
`tsc.js` を `Type instantiation is excessively deep and possibly infinite` というエラーメッセージを元に調べると `Type_instantiation_is_excessively_deep_and_possibly_infinite` という変数が見つかります。この変数を使っているエラー報告は以下の2つです。

```ts
// tsc.js 42795行目
if (constraintDepth >= 50) {
    error(currentNode, ts.Diagnostics.Type_instantiation_is_excessively_deep_and_possibly_infinite);
    nonTerminating = true;
    return t.immediateBaseConstraint = noConstraintType;
}

// tsc.js 46210行目
if (instantiationDepth === 50 || instantiationCount >= 5000000) {
    error(currentNode, ts.Diagnostics.Type_instantiation_is_excessively_deep_and_possibly_infinite);
    return errorType;
}
```

`constraintDepth` はmapped typeとindex access typesを制約に使ったときに発生する無限再帰を防止するためのもののようなので今回は関係なさそうです。[Fix infinite constraints #26558](https://github.com/microsoft/TypeScript/pull/26558)。

`instantiationDepth` は型関数をインスタンス化する時の再帰の深さを制限するための物のようです。試しに `instantiationDepth === 10` に書き換えると `Repeat<"x", 6>` でエラーになります。

`instantiationCount` は深さではなくインスタンス化の回数を制限していますね。例えば上の `Repeat` を以下のように書き換えると `instantiationDepth` は変わりませんが `instantiationCount` は増えます。(`console.log` すれば分かります)

```ts
type Repeat<T, N extends number, R extends any[] = []> = R["length"] extends N
  ? R
  : Repeat<[T, T, T, T, T, T], N, [T, ...R]>;
```


これで再帰制限チェックコードが分かりました。消してしまいましょう。テキストファイルなのでsedで簡単に消せます。

```sh
$ sed -i '' 's/instantiationDepth === 50 || instantiationCount >= 5000000/false/' 'node_modules/typescript/lib/tsc.js'
$ sed -i '' 's/instantiationDepth === 50 || instantiationCount >= 5000000/false/' 'node_modules/typescript/lib/tsserver.js'
```

## 結果など
やったね
![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/169698/4e279ed0-8394-9b21-79b6-af62b05cc7e8.png)

最近話題の[Template string types](https://github.com/microsoft/TypeScript/pull/40336)と組み合わせれば[既存のTSの型レベルbrainfuckインタプリタ](https://github.com/susisu/typefuck)にlexerとコードポイント変換処理を追加するだけでbrainfuckのhello world!も実行できます。

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/169698/513ccec9-4bb4-5090-9b33-99c0585f7a26.png)
