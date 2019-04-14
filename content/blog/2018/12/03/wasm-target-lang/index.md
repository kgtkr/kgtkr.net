---
title: WebAssemblyにコンパイルする言語を実装する
date: "2018-12-02T17:58:42.000Z"
description: ""
tags: ["webassembly","languageprocessor"]
name: wasm-target-lang
---
# はじめに
Haskellでwasmにコンパイルする言語を実装してみたので記事にしました。
LLVMなどには依存せず直接wasmを出力します。
また、現段階ではエラー処理などは未完成なので間違ったコードを入力するとコンパイラがクラッシュするか不正なwasmを出力するかその他色々おかしな事が起きたりします。
メモリアロケータは[この記事](/2018/12/01/wasm-memory-allocator/)で実装したものを使っています。
GCは実装は一応終わっているのですが([記事](/2018/12/02/webassembly-gc/))まだコンパイラ側の対応が終わっていません。
このようにまだかなりひどい状態ですが少しずつ改善していけたらなと思っています。

# リポジトリ
https://github.com/kgtkr/cl8w

# サンプルソース
先にサンプルを見たほうがイメージしやすいと思うので置いておきます。

まず実行の為のJSのソースです。
`main.wasm`はコンパイル結果、`./memory/memory.wasm`はメモリアロケータです。
数値のprintも欲しいので`print`関数をimportしています。
エントリポイントは`main.wasm`の`main`関数となっています。

```js
const fs = require("fs");

const memory = new WebAssembly.Memory({ initial: 10 });

const buf = fs.readFileSync("./main.wasm");
const mod = new WebAssembly.Module(buf);
const instance = new WebAssembly.Instance(mod, {
  resource: {
    memory: memory
  },
  memory: new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync("./memory/memory.wasm")), {
    resource: {
      memory: memory
    }
  },
  ).exports,
  io: {
    print: x => console.log(x)
  }
});
instance.exports.main()
```

次に`1`と出力するだけのソースです。
1行目で`malloc`を使えるようにしています。
これはソースで使って無くてもコンパイラが生成するコードで使うので絶対必要です。
あとは読んだら分かると思います。

```
extern fun "memory" "malloc" malloc(x:i32):i32
extern fun "io" "print" print(x:i32)

fun main()=print(1)
```

次はgcdです。
返り値の存在する関数の書き方などが分かると思います。
また`if`などは式なので`return`は必要ありません。

```
extern fun "memory" "malloc" malloc(x:i32):i32
extern fun "io" "print" print(x:i32)

fun main()=print(gcd(12,16))


fun gcd(a:i32,b:i32):i32=if(a%b==0) b else gcd(b,a%b)
```

構造体の例です。
構造体は全て参照型なのでここでは`30 20`と出力されます。
また複数行の関数はブロック式を使います。
ここらへんはRustやScalaを参考にしました。

```
extern fun "memory" "malloc" malloc(x:i32):i32
extern fun "io" "print" print(x:i32)

struct A{
    x:i32,
    y:i32
}

fun main()={
    let a=A{x:10,y:20};
    f(a);
    print(a.x);
    print(a.y);
}

fun f(a:A)=a.x=a.x+a.y
```

関数ポインタや配列を使った例です。高階関数っぽいことをしています。
まだ配列の長さを取得したり配列を初期化するリテラルは用意してないのでそのうち用意します。
この例では`1 3 5 7 9 11 13 15 17 19`と出力されます。

```
extern fun "memory" "malloc" malloc(x:i32):i32
extern fun "io" "print" print(x:i32)

fun main()={
    let n=10;
    let arr=[i32;n];
    for(let i=0;i<n;i=i+1){
        arr[i]=i;
    };
    map(inc,n,arr);
    map(double,n,arr);
    map(dec,n,arr);
    forEach(print,n,arr);
}

fun double(x:i32):i32=x*2

fun inc(x:i32):i32=x+1

fun dec(x:i32):i32=x-1

fun map(f:(i32)=>i32,n:i32,arr:[i32])={
    for(let i=0;i<n;i=i+1){
        arr[i]=f(arr[i]);
    };
}

fun forEach(f:(i32)=>,n:i32,arr:[i32])={
    for(let i=0;i<n;i=i+1){
        f(arr[i]);
    };
}
```

# wasm関連
[公式ドキュメント](https://github.com/WebAssembly/design/blob/master/BinaryEncoding.md)を見ながらwasmのASTを定義して、wasmのASTをバイト列に変換する関数を定義していきました。
wasmのAST定義は[ここ](https://github.com/kgtkr/cl8w/blob/9ff503c9441367ca637568a498bd13f3c46d3680/src/Wasm/AST.hs)、バイナリ生成は[ここ](https://github.com/kgtkr/cl8w/blob/9ff503c9441367ca637568a498bd13f3c46d3680/src/Wasm/Binary.hs)です。
バイナリ操作のためのライブラリとして以下のようなものを使用しました。

* cereal
* bytestring
* bytes
* utf8-string

基本的には公式ドキュメントで仕様を調べるのですが、よく分からない部分は[wasm-reference-manual](https://github.com/sunfishcode/wasm-reference-manual/blob/master/WebAssembly.md)を見てみたり、[wabt](https://github.com/WebAssembly/wabt)というツールキットのwat2wasmで実際にwatからwasmに変換してみてバイナリエディタで見てみる、また出力結果がおかしい場合はwasm-objdumpでどこがおかしいか調べてみるといった方法で調べていきました。

LEB128はライブラリを使っても上手く出来なかったので実装してしまいました。

```haskell
putSleb128 :: Putter Int
putSleb128 x
    | (v == 0 && b .&. 0x40 == 0) || (v == -1 && b .&. 0x40 /= 0)
    = (putWord8 . fromIntegral) b
    | otherwise
    = do
        (putWord8 . fromIntegral) (b .|. 0x80)
        putSleb128 v
  where
    b = x .&. 0x7f
    v = x `shiftR` 7
```

# パーサー
文字列→言語のASTに変換します。
parsecを使って実装しました。
LanguageDef使ってmakeTokenParserしてbuildExpressionParserしてという普通の方法で実装しているので特に解説する点はないと思います。



# コードジェネレーター
[src/Gen](https://github.com/kgtkr/cl8w/tree/9ff503c9441367ca637568a498bd13f3c46d3680/src/Gen)

言語のASTをwasmのASTに変換する関数です。
lens、mtl、dlistあたりを使いました。

コードジェネレーターは現在定義されている変数などといった状態を扱うのでここらへんはStateモナドで解決するととても便利です。
例えば関数生成ではローカル変数情報、メンバ情報、生成中の命令列などを状態として持っています。

主な関数としては式のコード生成を行う`exprGen`があります。

例えばブロック式のexprGenは以下のような感じです。
ブロック式は`{式;式;式?}`のような形で書いていき最後の式が結果値になります。つまり`EBlock [Expr] (Maybe Expr)`のような型コンストラクタです。
まず`makeScope`で変数のスコープを作成します。
その後`[Expr]`を順番に結果値を捨てながらコード生成をし、最後の結果値が`Just`ならそれのコード生成を行っています。

```haskell
exprGen (PE.EBlock ss e) = makeScope $ do
    mapM_ dropExprGen ss
    case e of
        Just e  -> exprGen e
        Nothing -> return ()
```

`makeScope`と`dropExprGen`も見てみましょう。

makeScopeは現在のシンボルマップ、つまり変数データなどのマップを一旦保存し、モナドを実行、そのあとシンボルマップを復元しています。HaskellのMapは不変なのでこれだけでちゃんと動きます。

```haskell
makeScope m = do
    lm <- use GF.symbolMap
    m
    GF.symbolMap .= lm
    return ()
```

dropExprGenは式の値を捨てるコードを生成します。
まず式の型を調べ結果値が何もなければ普通にコード生成をします。
もし結果値があればコード生成の後にwasmのdrop命令を挿入します。

```haskell
dropExprGen e = do
    t <- exprType e
    case t of
        Just _ -> do
            exprGen e
            addOpCode WA.OpDrop
        Nothing -> exprGen e
```

このような実装を構文ごとに行っています。

# 感想
初めての言語実装で(BrainFuckははい)難しい所もかなりありましたが、とりあえず動く物が作れたのでよかったです。
実際にwasmのASTやバイナリ出力を実装することでwasmの仕様もある程度分かったのでこういうのを理解したいなら実装するのが一番だなと感じました。
