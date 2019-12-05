---
title: RustでWebAssemblyインタプリタ作った話
date: "2019-12-02T10:21:22.931Z"
update: "2019-12-02T10:21:22.931Z"
tags: ["webassembly"]
name: wasm-rs
lang: ja
otherLang: []
---

## リポジトリ
https://github.com/kgtkr/wasm-rs

## 仕様書
https://webassembly.github.io/spec/core/index.html

## wasmはどう実行される
1. バイナリをデコード  
   バイナリデータを内部表現にデコードします。  
2. 検証  
   wasmのコードが正しいかの検証を行います。  
   例えば存在しない関数を呼び出していないか、関数の引数に渡す型が正しいのかといった検証です。  
3. 実行  
   wasmの命令を実行します。  
   スタックマシンの形式になっています。

今回は検証フェーズと、小数命令の一部評価が未実装です。  
またバイナリのデコードだけでなく、エンコード処理も実装しました。

## AST定義
仕様書の`Structure`を読んでなるべくその通りにデータ構造を定義しました。
命令は`inter = block [inter] | ...`のように再帰的なツリー構造で定義する方法と、`inter = block | end | ...`のようにフラットに定義する方法がありますが今回は仕様書に合わせてツリー構造で定義しました。

### 例
`valtype`の例です。`valtype`の定義は以下のようになっています。

```
valtype ::= i32 | i64 | f32 | f64
```

これをRustのデータ型にすると以下のようになります。

```rs
pub enum ValType {
    I32,
    I64,
    F32,
    F64,
}
```

そのままですね。

## バイナリのデコード、エンコード
仕様書の`Binary Format`を読みましょう。  
特徴的な点としてバイナリ容量を圧縮するためにleb128という数値の可変長エンコード形式が様々な場所で使われています。また数値はlittle endianです。  
デコードにはRustのnomというパーサーコンビネーターライブラリを使いました。  
proptestというテストツールを使うことでテストツールを使うことでASTをランダムで自動生成してエンコード・デコードで元に戻るかというテストをしてみましたが、再帰データ構造では自動生成出来ないらしく再帰構造を含まないASTのみ行いました。  

### 例
`valtype`のバイナリ仕様は以下のようになっています。

```
valtype ::= 0x7F => i32
        |   0x7E => i64
        |   0x7D => f32
        |   0x7C => f64
```

これをRustコードにすると以下のようになります。


```rs
impl Encoder for ValType {
    fn encode(&self, bytes: &mut Vec<u8>) {
        bytes.push(match self {
            ValType::I32 => 0x7f,
            ValType::I64 => 0x7e,
            ValType::F32 => 0x7d,
            ValType::F64 => 0x7c,
        });
    }
}

impl Decoder for ValType {
    fn decode(input: &[u8]) -> IResult<&[u8], ValType> {
        alt((
            map(parser::token(0x7f), |_| ValType::I32),
            map(parser::token(0x7e), |_| ValType::I64),
            map(parser::token(0x7d), |_| ValType::F32),
            map(parser::token(0x7c), |_| ValType::F64),
        ))(input)
    }
}
```

`Encoder`と`Decoder`は独自のトレイトです。`encode`はデータ型をと可変バイト列を受け取って受け取ったバイト列にエンコード結果を書き込みます。`decode`はバイト列を受け取ってパースし、残りのバイト列と結果型を返します。`decode`は失敗することがあります。  


### proptestを使った自動テスト
`proptest`を使った自動テストについてです。`proptest`は以下のように書く事でランダムにデータが与えられ、それに対する性質を書くことで楽にテストを書くことができるツールです。 

```rs
proptest!(|(x: T)| {
    // xが満たすべき性質(満たさなければpanic)
});
```

今回はエンコードしてデコードすると元に戻る事を検証したいので以下のようになります。再利用したいので`identity_encode_decode`という関数にします。`Arbitrary`トレイトはランダムに自動生成するのに必要なトレイトです。  

```rs
pub fn identity_encode_decode<T: Arbitrary + Encoder + Decoder + PartialEq>() {
    proptest!(|(x: T)| {
        assert_eq!(Decoder::decode_end(&x.encode_to_vec()), Ok(x));
    });
}
```

今回も例として`valtype`を使います。  
まずテスト対象の`ValType`に`#[cfg_attr(test, derive(Arbitrary))]`をつけて`Arbitrary`トレイトを自動導出します。(`cfg_attr`によってテスト時のみ自動導出しています)。  
次にテスト関数に以下の一行を追記します。

```rs
identity_encode_decode::<ValType>();
```

これだけで「任意の`ValType`に対してエンコード→デコードすると元に戻るか」ということを確認することが出来てとても楽です。再帰構造を含むと`Arbitrary`トレイトの自動導出ができないという問題はありますが便利なので使ってみましょう。  



## 実行
スタックマシンとなっていますがなるべく仕様書通りに実装するためにスタックを以下のように定義しました。コメントに解説を書きました。  

```rs
pub struct Stack {
    // 関数呼び出しのときにpushされる
    pub stack: Vec<FrameStack>,
}


pub struct FrameStack {
    // Frameはローカル変数などを管理する
    pub frame: Frame,
    // 制御構文に入るとpushされる
    pub stack: Vec<LabelStack>,
}

pub struct LabelStack {
    // Label(後記)に関するデータ。継続などを持つ
    pub label: Label,
    // 未実行命令のスタック
    // AdminInstrについては後記
    pub instrs: Vec<AdminInstr>,
    // 一般的なスタックマシンのスタックに対応
    // 計算結果などはここにpushされる
    // Valはi32/i64/f32/f64
    pub stack: Vec<Val>,
}
```

`Label`というのは命令の継続を持っています。これは制御構文に入ると作られる継続付きブロックのようなものです。通常はブロック内部が実行されますが、`br`命令でジャンプされるとブロックの中身の実行が中断され継続が実行されます。前書いた[WebAssemblyのbr命令について
](https://qiita.com/kgtkr/items/2c39bb2cbbbfd0e0e14b)という記事を読むと分かるかもしれません。`AdminInstr`というのは仕様書の`Administrative Instructions`に対応しています。これは`Structure`に出てくる`instr`の拡張で実行仕様を書くためにいくつかの命令が加えられています。今回は以下のように定義しました。  

```rs
pub enum AdminInstr {
    Instr(Instr),
    Invoke(FuncAddr),
    Label(Label, Vec<Instr>),
    Br(LabelIdx),
    Return,
}
```

`Stack`、`FrameStack`、`LabelStack`は評価を1ステップ進める`step`関数を持っています。
`FrameStack#step`は`Option<ModuleLevelInstr>`を、`LabelStack#step`は`Option<FrameLevelInstr>`を返すようになっています。`FrameLevelInstr`は個々の`LabelStack`のデータだけでは完結しない命令を、`ModuleLevelInstr`は個々の`FrameStack`のデータだけでは完結しない命令です。そのように完結しない命令が来た時は返り値として返す事でそのデータを持つ親に処理を委譲しています。例えば`ModuleLevelInstr`には`Return`などが、`FrameLevelInstr`には`ModuleLevelInstr`に加えて`Br`などが含まれています。これは例えば`Return`は個々の`FrameStack`だけでは完結せず、`FrameStack`のスタックを操作する必要があり、`Br`も`LabelStack`だけでは完結せず、個々の`LabelStack`だけでは完結せず`LabelStack`のスタックを操作する必要があるからです。

例としていくつかの命令評価をあげます。
まず`LabelStack#step`の`i32.add`の評価です。

```rs
match ... {
    ︙
        Instr::I32Add => {
            let y = self.stack.pop().unwrap().unwrap_i32();
            let x = self.stack.pop().unwrap().unwrap_i32();
            self.stack.push(Val::I32(x.overflowing_add(y).0));
        }
    ︙
}
```

これはスタックから2つの`i32`値をpopして足した値をスタックにpushしています。オーバーフローに対応するために`+`ではなく`overflowing_add`を使っています。

次に`Stack#step`の`return`を見てみましょう。

```rs
match ... {
    ︙
    ModuleLevelInstr::Return => {
        let ret = cur_label.stack.pop();
        if self.stack.pop().unwrap().frame.n != 0 {
            self.stack
                .last_mut()
                .unwrap()
                .stack
                .last_mut()
                .unwrap()
                .stack
                .push(ret.unwrap());
        }
    }
    ︙
}
```

これは現在の`Frame`をpopして、返り値の数(`frame.n`)を確認しています。それが0個でなければ(つまり1個なら)現在の`Label`のスタックの最後の値を、返り先の`Frame`の`Label`のスタックにpushしています。


wasmでは可変メモリを複数のモジュールインスタンスが共有することがありますが、Rustでは`&mut`を複数作ることが出来ないのでArenaパターンか、`Rc<RefCell<T>>`を使う必要がありますが今回は後者で行いました。メモリリークを防ぐために`Weak`を大量に使う必要があったりして大変なのでここはもう少し考えたいです。


## 公式のテストケース
バグらせたけど原因が分からないときは公式のテストケースを活用しましょう。

https://github.com/WebAssembly/spec/tree/master/test/core

wastというwatの拡張フォーマットになっており、これはwabtのwast2jsonを使うことでjsonと複数のwasmに変換することができます。
jsonファイルには「このwasmのこの関数を実行した時結果はこうなる」といったテストケースが書かれているのでwasmファイルを自作インタプリタで動かして、jsonを読み込んでその通りにテストを実行するだけでデバッグにとても役立ちおすすめです。

## md5の実行
Rustでmd5を計算するコードをwasmにコンパイルし、それを自作インタプリタ上で動かしてみました。
やり取りはCStringを使っています。

## 自作言語を自作インタプリタで動かす
一年前にHaskellでwasmにコンパイルする自作言語を作ったので、それを実行してみたところ上手く動かすことができました。

## 自作インタプリタ上で自作インタプリタを動かす
Rustはwasmにコンパイルすることができるので自作インタプリタ上で自作言語を動かすコードをwasmにコンパイルし、それを自作インタプリタで動かしてみました。
上手く動かすことが出来ましたが、実行に数分かかり、かなり遅いのでパフォーマンスの改善も多少はしたいです。

## これからやること
まだ不完全なのでとりあえず小数命令の実装出来てないやつを実装してしまいたいです。
また検証フェーズの実装を一切行っていないのでそこもして、公式のwastテストケースは全て通る事を目指したいです。
