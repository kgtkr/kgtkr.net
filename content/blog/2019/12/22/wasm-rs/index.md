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

今回はASTをランダムで自動生成→ASTをエンコードしてバイナリに変換→バイナリをデコードして元のASTに戻るかという検証に使いました。再利用したいので`identity_encode_decode`というヘルパー関数を定義します。`Arbitrary`トレイトはランダムに値を自動生成できる型が実装するトレイトです。  

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

これだけで「任意の`ValType`に対してエンコード→デコードすると元に戻るか」ということを確認することが出来てとても楽です。  
ただし問題もあり再帰構造を含むと`Arbitrary`トレイトの自動導出ができません。自分で`Arbitrary`トレイトの実装をするのは大変なので今回は再帰構造を含まないデータ型のみで`proptest`を使った自動テストを行いました。


## 実行
スタックマシンとなっていますがなるべく仕様書通りに実装するためにスタックを以下のように定義しました。コメントに解説を書きました。  

```rs
pub struct Stack {
    // 関数の呼び出しスタック
    // 関数が呼び出されるとpushされ、関数から戻るとpopされる
    pub stack: Vec<FrameStack>,
}


pub struct FrameStack {
    // ローカル変数情報などが入っている
    pub frame: Frame,
    // 制御構文に入るとpushされ、抜けるとpopされる
    pub stack: Vec<LabelStack>,
}

pub struct LabelStack {
    // Label(後記)に関するデータ
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

`Label`というのは命令の継続を持っています。これは制御構文に入ると作られる継続付きブロックのようなものです。通常は本体の命令が実行され、最後まで実行するとその`label`を抜けます。しかし`br`命令で`label`を指定すると現在の命令が中断され、その`label`継続にジャンプし継続が実行されます。前書いた[WebAssemblyのbr命令について
](https://qiita.com/kgtkr/items/2c39bb2cbbbfd0e0e14b)という記事を読むと分かるかもしれません。  
`AdminInstr`というのは仕様書の`Administrative Instructions`に対応しています。これは`Structure`に出てくる`instr`の拡張で実行仕様を書くためにいくつかの命令が加えられています。今回は以下のように定義しました。  

```rs
pub enum AdminInstr {
    Instr(Instr),
    Invoke(FuncAddr),
    Label(Label, Vec<Instr>),
    Br(LabelIdx),
    Return,
}
```

`Stack`、`FrameStack`、`LabelStack`は評価を1ステップ進める`step`関数を持っており、`Stack::step`を呼び出すと、`FrameStack::step`を呼び出し、`FrameStack::step`を呼び出すと`LabelStack::step`を呼び出すようになっています。  
そして、`FrameStack::step`は`Option<ModuleLevelInstr>`を、`LabelStack::step`は`Option<FrameLevelInstr>`を返すようになっています。`ModuleLevelInstr`は個々の`FrameStack`だけでは完結しない命令を表す`enum`で、`FrameLevelInstr`は個々の`LabelStack`だけでは完結しない命令を表す`enum`です。これらを返す事で親に実行できなかった処理を委譲することができます(これらが返された親は自信で処理を実行するか、さらに親に命令を返さなければいけません)
`FrameStack::step`の疑似コードを書くと以下のような感じです。  

```rs
let frame_instr = current_label_stack.step(...);
if let Some(frame_instr) = frame_instr {
    match frame_instr {
        /* frameで完結する処理 */ => {
            …
            None
        }
        /* frameでは完結しない処理 */ => {
            …
            Some(ModuleLevelInstr::...)
        }
    }
}
```

例えば`ModuleLevelInstr`には`Return`などが、`FrameLevelInstr`には`ModuleLevelInstr`に加えて`Br`などが含まれています。これは例えば`Return`は個々の`FrameStack`だけでは完結せず、`FrameStack`のスタックを操作する必要があり、`Br`も`LabelStack`だけでは完結せず、個々の`LabelStack`だけでは完結せず`LabelStack`のスタックを操作する必要があるからです。

例としていくつかの命令評価をあげます。
まず`LabelStack::step`の`i32.add`の評価です。

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

次に`Stack::step`の`return`を見てみましょう。

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


wasmでは可変メモリを複数のモジュールインスタンスが共有することがありますが、Rustでは`&mut`を複数作ることが出来ないのでArenaパターンか、`Rc<RefCell<T>>`を使う必要がありますが今回は後者で行いました。メモリリークを防ぐために`Weak`を大量に使う必要があったりして大変なのでここは綺麗に書き換えせる方法があれば書き直したいです。  
命令の実行はこのような感じですが、他にもモジュールのデータを元にインスタンス化(例えば実際にバイト列を確保して初期化したり)といった処理も必要です。


## 公式のテストケース
公式がテストケースを用意しているのでバグらせたけど原因がわからないと言ったときはとても便利です。  

https://github.com/WebAssembly/spec/tree/master/test/core

wastというwatの拡張フォーマットになっており、これはwabtのwast2jsonを使うことでjsonと複数のwasmに変換することができます。
jsonファイルには「このwasmのこの関数を実行した時結果はこうなる」といったテストケースが書かれているのでwasmファイルを自作インタプリタで動かして、jsonを読み込んでその通りにテストを実行するだけでデバッグにとても役立ちおすすめです。

## 自作言語を自作インタプリタで動かす
一年前にHaskellでwasmにコンパイルする自作言語を作ったので([WebAssemblyにコンパイルする言語を実装する
](https://qiita.com/kgtkr/items/de4c616cdcd89a58df72))、それを実行してみたところ上手く動かすことができました。

### 自作言語のコード
配列を10個用意して、インデックスの値で初期化、各要素をインクリメント、二倍、デクリメントして出力するコードです。  

```
extern fun "memory" "malloc" malloc(x: i32): i32
extern fun "io" "print" print(x: i32)

fun main() = {
    let n = 10;
    let arr = [i32; n];
    for(let i = 0; i < n; i = i + 1) {
        arr[i] = i;
    };
    map(inc, n, arr);
    map(double, n, arr);
    map(dec, n, arr);
    forEach(print, n, arr);
}

fun double(x: i32): i32 = x * 2

fun inc(x: i32): i32 = x + 1

fun dec(x: i32): i32 = x - 1

fun map(f: (i32) => i32, n:i32, arr: [i32]) = {
    for(let i = 0; i< n; i = i + 1) {
        arr[i] = f(arr[i]);
    };
}

fun forEach(f: (i32) =>, n: i32, arr: [i32]) = {
    for(let i = 0; i < n; i = i + 1) {
        f(arr[i]);
    };
}
```

### rustコード
`cl8w.wasm`は自作言語のコンパイル結果、`memory.wasm`は自作言語の実行に必要なランタイムとなっています。  
バイト列であるファイルを読み込んでパース、インスタンス化して関数を呼び出しています。モジュールのインスタンス化には各モジュールが`import`している値を用意し渡す必要があります。  


```rs
let memory = ExternalVal::Mem(MemAddr(Rc::new(RefCell::new(MemInst::from_min_max(
    10, None,
)))));
let print = ExternalVal::Func(FuncAddr(Rc::new(RefCell::new(FuncInst::HostFunc {
    type_: FuncType(vec![ValType::I32], vec![]),
    host_code: |params| match &params[..] {
        &[Val::I32(x)] => {
            println!("{}", x);
            None
        }
        _ => panic!(),
    },
}))));

let memory_module =
    Module::decode_end(&std::fs::read("./example/memory.wasm").unwrap()).unwrap();
let memory_instance = ModuleInst::new(
    &memory_module,
    map!(
        "resource".to_string() => map!(
            "memory".to_string() => memory.clone()
        )
    ),
);

let main_module =
    Module::decode_end(&std::fs::read("./example/cl8w.wasm").unwrap()).unwrap();
let main_instance = ModuleInst::new(
    &main_module,
    map!(
        "resource".to_string() => map!(
            "memory".to_string() => memory.clone()
        ),
        "memory".to_string() => memory_instance.exports(),
        "io".to_string() => map!(
            "print".to_string() => print.clone()
        )
    ),
);

main_instance.export("main").unwrap_func().call(vec![]);
```

### 実行結果
```
1
3
5
7
9
11
13
15
17
19
```

## 自作インタプリタ上で自作インタプリタを動かす
Rustはwasmにコンパイルすることができるので自作インタプリタ上で自作言語を動かすコードをwasmにコンパイルし、それを自作インタプリタで動かしてみました。つまり自作言語(wasm) on 自作インタプリタ(wasm) on 自作インタプリタです。

### 自作言語のコード
さっきと同じなので省略

### wasmにコンパイルするRustコード

```rs
fn main() {}

extern "C" {
    fn print(x: i32) -> ();
}

#[no_mangle]
pub extern "C" fn run() {
    use std::cell::RefCell;
    use std::rc::Rc;
    use wasm_rs::binary::Decoder;
    use wasm_rs::exec::instance::*;
    use wasm_rs::structure::modules::*;
    use wasm_rs::structure::types::*;

    let memory = ExternalVal::Mem(MemAddr(Rc::new(RefCell::new(MemInst::from_min_max(
        10, None,
    )))));
    let print = ExternalVal::Func(FuncAddr(Rc::new(RefCell::new(FuncInst::HostFunc {
        type_: FuncType(vec![ValType::I32], vec![]),
        host_code: |params| match &params[..] {
            &[Val::I32(x)] => {
                unsafe {
                    print(x);
                }
                None
            }
            _ => panic!(),
        },
    }))));

    let memory_module = Module::decode_end(include_bytes!("../example/memory.wasm")).unwrap();
    let memory_instance = ModuleInst::new(
        &memory_module,
        map!(
            "resource".to_string() => map!(
                "memory".to_string() => memory.clone()
            )
        ),
    );

    let main_module = Module::decode_end(include_bytes!("../example/cl8w.wasm")).unwrap();
    let main_instance = ModuleInst::new(
        &main_module,
        map!(
            "resource".to_string() => map!(
                "memory".to_string() => memory.clone()
            ),
            "memory".to_string() => memory_instance.exports(),
            "io".to_string() => map!(
                "print".to_string() => print.clone()
            )
        ),
    );

    main_instance.export("main").unwrap_func().call(vec![]);
}
```

### wasmにコンパイルしたRustを読み込んで実行するコード
`output.wasm`は自作インタプリタ上で自作言語を動かすRustコードを`wasm32-unknown-unknown`にコンパイルしたもの

```rs
let print = ExternalVal::Func(FuncAddr(Rc::new(RefCell::new(FuncInst::HostFunc {
    type_: FuncType(vec![ValType::I32], vec![]),
    host_code: |params| match &params[..] {
        &[Val::I32(x)] => {
            println!("{}", x);
            None
        }
        _ => panic!(),
    },
}))));

let module =
    Module::decode_end(&std::fs::read("./example/output.wasm").unwrap())
        .unwrap();
let instance = ModuleInst::new(
    &module,
    map!(
        "env".to_string() => map!(
            "print".to_string() => print
        )
    ),
);

instance.export("run").unwrap_func().call(vec![]);
```

### 実行結果
手元環境で実行時間の計測もしてみました。どちらのRustコードもreleaseビルドです。

```
1
3
5
7
9
11
13
15
17
19


real    6m45.596s
user    5m41.276s
sys     0m3.563s
```

遅すぎますね。遅いwasmインタプリタの上で遅いwasmインタプリタを動かしてその上で遅い自作言語(どちらかというと自作メモリアロケーターが遅いが)を動かしているのでめちゃくちゃ遅いのは当然です。パフォーマンス無視で実装したとはいえ流石に遅すぎるので改善したいです。

ちなみに`output.wasm`をnode.js上で実行すると実行時間は以下のようになりました。

```
real    0m0.294s
user    0m0.724s
sys     0m0.068s
```

## これからやること
まだ小数命令の一部と検証フェーズの実装が出来ていないのでそれの実装をしてしまいたいです。  
これを実装できれば公式のテストケースが全て通るはずなのでそこまで出来たら多少のパフォーマンス改善や、そのうちwasmに入るはずの複数の返り値等の実装もしてみようと思っています。
