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

作った成果物のリポジトリです。まだpublishはしていませんがクレートになっています。  
cargoのexample実行に対応しているのでそれを見ればだいたい分かると思います。

今回は`adc-2019-12-22`というタグがついたコミットのソースを元に解説していきます。
https://github.com/kgtkr/wasm-rs/tree/adc-2019-12-22

## 仕様書
この記事では仕様書を読みながら順番に実装を解説していきます。  

https://webassembly.github.io/spec/core/index.html

いくつかの章に分かれていますが、実装に深く関わるのは以下です。

* Structure
* Validation
* Execution
* Binary Format
* Text Format

今回はこのうち`Validation`と`Text Format`を除く部分を実装しました。  
`Validation`は読み込んだモジュールの静的検証についての仕様が書かれています。静的検証は型チェックみたいなものです。今回は間に合わなかったので実装しませんでした。つまり入力されるwasmコードは常に正しいものとして扱います。  
`Text Format`はwatというwasmのテキストフォーマットについての仕様が書かれています。watとはwasmの命令と1対1対応の命令を持っているテキストフォーマットの言語です。wasmはバイナリフォーマットなので人間が読み書きするのは難しいですが、watであれば比較的読み書きしやすいです。wasmを機械語とするならwatはアセンブリ言語みたいなものです。この記事で出てくるwasmのサンプルコードは基本的にwatのコードです。これを実装することでwasmとwatの相互変換ができるようになりますが、今回はwasmバイナリを読み込んで実行できればいいので実装しませんでした。  
wasmインタプリタの実装には直接関係ありませんが、バイナリフォーマットのデコードだけでなくエンコード処理も実装しています。これは元々wasmに出力する自作言語をRustで作ろうと思いバイナリの出力コードを書いていたらインタプリタを作りたくなったから作ったという経緯が理由だったりします。

上記のwasm仕様書はwasmのcore仕様の物です。他にもJSのWebAssembly APIについての仕様などがありますが今回は関係ないので無視します。

## Structure
[実装](https://github.com/kgtkr/wasm-rs/tree/adc-2019-12-22/src/structure)

wasmモジュールの構造についての仕様が書かれています。ここを読んでRustのデータ構造に落とし込んでいきます。  
例えば`valtype`は以下のように定義されています。

```
valtype ::= i32 | i64 | f32 | f64
```

これをRustのデータ構造にすると以下のようになります。
```rs
pub enum ValType {
    I32,
    I64,
    F32,
    F64,
}
```

このように順番に定義していって最終的には以下のようなwasmモジュールを表す構造体が定義出来れば完成です。

```rs
pub struct Module {
    pub types: Vec<FuncType>,
    pub funcs: Vec<Func>,
    pub tables: Vec<Table>,
    pub mems: Vec<Mem>,
    pub globals: Vec<Global>,
    pub elem: Vec<Elem>,
    pub data: Vec<Data>,
    pub start: Option<Start>,
    pub imports: Vec<Import>,
    pub exports: Vec<Export>,
}
```


## Binary Format
[実装](https://github.com/kgtkr/wasm-rs/tree/adc-2019-12-22/src/binary)

`Execution`は長くなるので先にこっちの解説をします。この章はwasmのバイナリフォーマットについての仕様が書かれています。これを読み実装することで先ほど定義したデータ構造とバイナリデータの相互変換ができるようになります。今回はパーサーコンビネーターライブラリに`nom`を使いました。Rustには他にも`combine`というパーサーコンビネーターライブラリがあります。`combine`は使ったことがありましたが、`nom`は使ったことがなかったからという理由で`nom`を採用しただけで深い理由はありません。昔の`nom`はマクロをかなり多用したライブラリでしたがマクロを使わずに書けるようになっており使いやすかったです。他にもバイト列と数値型のデコード/エンコードなどを行うのに`byteorder`を、leb128という整数の可変長フォーマットのデコード/エンコードを行うのに`leb128`というライブラリを使っています。

### DecoderとEncoderの定義
まずバイト列からデコードできるデータ型を表すトレイトとして`Decoder`トレイトを定義します

```rs
use nom::{sequence::tuple, IResult};

pub trait Decoder
where
    Self: std::marker::Sized,
{
    fn decode(input: &[u8]) -> IResult<&[u8], Self>;

    fn decode_to_end(input: &[u8]) -> Result<Self, nom::Err<(&[u8], nom::error::ErrorKind)>> {
        let (_, (x, _)) = tuple((Self::decode, eof()))(input)?;
        Ok(x)
    }
```

`decode`関数はバイト列を受け取って、未処理のバイト列と結果を返します。デコードは失敗する可能性があるので`nom`の`IResult`を使っています。  
`decode_to_end`関数はバイト列を受けとって結果を返します。`eof`は空の入力を受け取ったら成功し、そうでなければ失敗する独自コンビネーターです。

次にバイト列にエンコードできるデータ型を表すトレイトとして`Encoder`トレイトを定義します。

```rs
pub trait Encoder {
    fn encode(&self, bytes: &mut Vec<u8>);

    fn encode_to_vec(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        self.encode(&mut bytes);
        bytes
    }
}
```

`encode`関数は可変のバイト列を受け取ってエンコード結果をそこに書き込んでいきます。`encode_to_vec`はエンコードしてバイト列を返します。 

この2つのトレイトを先ほど`Structure`を見ながら定義したデータ構造に実装していくことでデコードとエンコードを行います。例えば`valtype`の仕様は以下のようになっています。

```
valtype ::= 0x7F => i32
        |   0x7E => i64
        |   0x7D => f32
        |   0x7C => f64
```

これに`Decoder`と`Encoder`を実装すると以下のようになります。`token`は指定されたトークンを読む独自コンビネーターです。

```rs
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
```

### leb128のデコード、エンコード
Rustではバイナリ容量を節約するために`leb128`という可変長の整数エンコード形式を使っています。このエンコード形式は小さな数値であれば1バイトにエンコードでき、また任意の大きな数値を扱うことができます。ただしwasmでは大きさの上限が仕様で決まっています。また符号付きと符号なしがありますが両方使われています。  
例えば`u32`に対する実装は以下のようになっています。

```rs
impl Decoder for u32 {
    fn decode(input: &[u8]) -> IResult<&[u8], u32> {
        parser::io_read(|rb| {
            leb128::read::unsigned(rb)
                .ok()
                .and_then(|x| u32::try_from(x).ok())
        })(input)
    }
}

impl Encoder for u32 {
    fn encode(&self, bytes: &mut Vec<u8>) {
        leb128::write::unsigned(bytes, *self as u64).unwrap();
    }
}
```

`io_read`は`io::Reader`を受け取ってデコードするライブラリの関数を`nom`のコンビネーターに変換する独自コンビネーターです([ソース](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/binary/parser.rs#L58))。ここでは`leb128`というライブラリを使うことで簡単に実装しています。

### Sectionについて
バイナリ仕様には`Section`というものが出てきます。`Section`は`Type Section`、`Import Section`などがあり、さっき定義した`Module`構造体の各フィールドと大体対応しています。ただし`funcs`フィールドは関数のシグネチャのみの`Function Section`と、関数の本体である`Code Section`に分かれています。これはシグネチャだけを先に定義することでバイト列のストリームを受け取ってデコードしたり、検証したりするためです。また、メタデータとして自由に使える`Custom Section`というものもあります。
各セクションは`セクションID,本体のバイト数,本体`のようにエンコードされます。

### モジュールのデコード/エンコード
各セクションのデコーダー/エンコーダーや、セクションのコンビネーターをいい感じに定義して最終的に以下のようにデコーダーとエンコーダーを`Module`に実装します。  


```rs
impl Decoder for Module {
    fn decode(input: &[u8]) -> IResult<&[u8], Module> {
        map(
            tuple((
                tuple((
                    parser::token(0x00),
                    parser::token(0x61),
                    parser::token(0x73),
                    parser::token(0x6d),
                    parser::token(0x01),
                    parser::token(0x00),
                    parser::token(0x00),
                    parser::token(0x00),
                )),
                tuple((p_costoms, p_section(Byte(1), Vec::<FuncType>::decode))),
                tuple((p_costoms, p_section(Byte(2), Vec::<Import>::decode))),
                tuple((p_costoms, p_section(Byte(3), Vec::<TypeIdx>::decode))),
                tuple((p_costoms, p_section(Byte(4), Vec::<Table>::decode))),
                tuple((p_costoms, p_section(Byte(5), Vec::<Mem>::decode))),
                tuple((p_costoms, p_section(Byte(6), Vec::<Global>::decode))),
                tuple((p_costoms, p_section(Byte(7), Vec::<Export>::decode))),
                tuple((p_costoms, p_section(Byte(8), Start::decode))),
                tuple((p_costoms, p_section(Byte(9), Vec::<Elem>::decode))),
                tuple((p_costoms, p_section(Byte(10), super::values::p_vec(p_code)))),
                tuple((p_costoms, p_section(Byte(11), Vec::<Data>::decode))),
                p_costoms,
            )),
            |(
                _,
                (_, types),
                (_, imports),
                (_, funcs),
                (_, tables),
                (_, mems),
                (_, globals),
                (_, exports),
                (_, start),
                (_, elem),
                (_, code),
                (_, data),
                _,
            )| Module {
                types: types.unwrap_or_else(Vec::new),
                funcs: funcs
                    .unwrap_or_else(Vec::new)
                    .into_iter()
                    .zip(code.unwrap_or_else(Vec::new))
                    .map(|(type_, (locals, body))| Func {
                        type_,
                        locals,
                        body,
                    })
                    .collect::<Vec<_>>(),
                imports: imports.unwrap_or_else(Vec::new),
                tables: tables.unwrap_or_else(Vec::new),
                mems: mems.unwrap_or_else(Vec::new),
                globals: globals.unwrap_or_else(Vec::new),
                exports: exports.unwrap_or_else(Vec::new),
                start,
                elem: elem.unwrap_or_else(Vec::new),
                data: data.unwrap_or_else(Vec::new),
            },
        )(input)
    }
}

impl Encoder for Module {
    fn encode(&self, bytes: &mut Vec<u8>) {
        bytes.push(0x00);
        bytes.push(0x61);
        bytes.push(0x73);
        bytes.push(0x6d);

        bytes.push(0x01);
        bytes.push(0x00);
        bytes.push(0x00);
        bytes.push(0x00);

        encode_section(Byte(1), &self.types, bytes);
        encode_section(Byte(2), &self.imports, bytes);
        encode_section(
            Byte(3),
            self.funcs.iter().map(|x| &x.type_).collect::<Vec<_>>(),
            bytes,
        );
        encode_section(Byte(4), &self.tables, bytes);
        encode_section(Byte(5), &self.mems, bytes);
        encode_section(Byte(6), &self.globals, bytes);
        encode_section(Byte(7), &self.exports, bytes);
        encode_section(Byte(8), &self.start, bytes);
        encode_section(Byte(9), &self.elem, bytes);
        encode_section(
            Byte(10),
            self.funcs.iter().map(|x| Code(x)).collect::<Vec<_>>(),
            bytes,
        );
        encode_section(Byte(11), &self.data, bytes);
    }
}
```

`p_costoms`は任意個のカスタムセクションをパースするパーサー([ソース](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/binary/modules.rs#L493))、`p_section`はセクションIDと本体のデコーダーを受け取ってセクションのパーサーを作るコンビネーター([ソース](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/binary/modules.rs#L442))です。セクションは省略することができるのでそこらへんの処理もいい感じにしています。`encode_section`はセクションをエンコードする関数で、セクションが空ならセクションごと省略してしまうみたいな処理が中に入っています([ソース](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/binary/modules.rs#L430))。このような「空であれば省略」といった処理を抽象化するのに空かの判定や、空でない値を取り出す機能を持つ`Zero`という名前のトレイトを定義していて、`Option<T>`と`Vec<T>`に実装しています。([ソース](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/binary/modules.rs#L20))

### バイナリを読んでみよう
せっかくなのでwasmの簡単なバイナリを読んでみましょう。例にするwatは以下です。

```
(module
  (func $add (param $a i32) (param $b i32) (result i32)
    get_local $a
    get_local $b
    i32.add
  )
  (export "add" (func $add))
)
```

2つの`i32`値を受け取って足した値を返す関数を定義して`"add"`という名前でexportしているだけの簡単なモジュールです。  
wasmには変数名がないのでwatの変数名は数値のインデックス値に変換されたり、関数を宣言すると自動で`type`が宣言されたりします。上記のwatにそのような変換を手動でしてなるべくwasmに近づけたwatが以下です。

```
(module
  (type (func (param i32) (param i32) (result i32)))
  (func (type 0)
    get_local 0
    get_local 1
    i32.add
  )
  (export "add" (func 0))
)
```

この上記2つのwatは同等で、wasmに変換すると同じwasmを出力します。このwatをwasmに変換して16進数で表現したものが以下です。

```
0000000    00  61  73  6d  01  00  00  00  01  07  01  60  02  7f  7f  01
0000010    7f  03  02  01  00  07  07  01  03  61  64  64  00  00  0a  09
0000020    01  07  00  20  00  20  01  6a  0b
```

意味ごとに区切ってインデントと解説を入れたのが以下です。


```
00 61 73 6d // "\0asm"という文字列。これは固定
01 00 00 00 // wasmのバージョンは1。リトルエンディアン

/* Type Section */
01 // Section IDは1(Type Section)
07 // セクション本体のサイズは7。ここより下は本体
  01 // typeの宣言数は1
    60 // 関数の型であることを表す。バージョン1では関数の型しかないので固定
    02 // 引数の数を表す。引数は2つ
      7f // i32型を表す
      7f // i32
    01 // 返り値の数を表す。バージョン1では0か1
      7f // i32

/* Function Section */
03 // Section IDは3
02 // セクション本体のサイズは2
  01 // 関数の宣言数
    00 // 関数の型は0番目に定義されたtype

/* Export Section */
07 // Section IDは7
07 //セクション本体のサイズは7
  01 // exportの数
    03 // export名のバイト数
      61 64 64 // addという文字列
    00 // 関数のexportであることを表す
    00 // 0番目に定義された関数をexportする

/* Code Section */
0a // Section IDは10
09 // セクション本体のサイズは9
  01 // 関数本体の宣言数(Function Sectionの関数の宣言数と一致する)
    07 // 関数本体のサイズ
      00 // ローカル変数の宣言数。今回は0
      20 00 // get_local 0
      20 01 // get_local 1
      6a // i32.add
      0b // end
```


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


## Execution
[実装](https://github.com/kgtkr/wasm-rs/tree/adc-2019-12-22/src/exec)

wasmのランタイム構造、実行仕様などについて書かれています。実装には`num`、`frunk`、`generic-array`、`typenum`を使っています。`num`は数値に関するトレイトなどが定義されているライブラリです。`frunk`はGenericプログラミングをするためのライブラリで`HList`などが定義されています。`generic-array`は長さを型パラメーターで渡せる固定長配列を提供しているライブラリで、`typenum`は`generic-array`が依存している型レベル整数のライブラリです。

### Genericプログラミングについて
実装に`frunk`というライブラリのGenericとHListを使っています(CoproductやLabelledGenericもありますが今回は使いません)。
HListは再帰的な構造を持つタプルのようなものです。例えば`(A, B, C, D)`をHListにすると`HCons<A, HCons<B, HCons<C, HCons<D, HNill>>>>`となります。そしてGenericは`Repr`という関連型を持つトレイトで、`HList`や`Coproduct`と相互変換できるデータ型を表します。`Repr`は変換先の型を表します。これの何が嬉しいかというと`Generic`トレイトさえマクロなどで自動導出してしまえばマクロを使わずに一般的にデータ型に様々なトレイトを実装することができるようになります。例えば、`impl PartialEq for HNil`、`impl<H: PartialEq, T: PartialEq + HList> PartialEq for HCons<H, T>`を実装してしまえば全てのフィールドが`PartialEq`を実装している任意の構造体で`PartialEq`が使えるようになります。再帰的な構造になっているので`()`、`(A,)`、`(A, B)`、`(A, B, C)`、`(A, B, C, D)`…の全てに実装するみたいな事をする必要はありません。とても便利ですね。

### ランタイム構造の定義
#### スタックの値の定義
[実装](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/exec/val.rs)

`val`は`i32`/`i64`/`f32`/`f64`のいずれかであると書かれているので以下のように定義します。

```rs
pub enum Val {
    I32(i32),
    I64(i64),
    F32(f32),
    F64(f64),
}
```

`Val`の関連関数に、`val_type`という`Val`を受け取って`ValType`を返す関数、`unwrap_i32`のような`Val`を受け取って`i32`を返す関数(`Val::I32(x)`でなければパニック)も定義します。  
そして次にいくつかのトレイトを定義します。

まず`PrimitiveVal`です。

```rs
pub trait PrimitiveVal: Sized {
    fn try_from_val(val: Val) -> Option<Self>;
    fn wrap_val(self) -> Val;
    fn type_() -> ValType;
}
```

`i32`型などに実装するトレイトでスタックに入っているプリミティブ型であることを表します。

次に`InterpretPrimitive`です。これは`PrimitiveVal`から解釈可能な型に実装するトレイトで、`PrimitiveVal`に加えて、`bool`、`u32`、`u64`に実装しています。

```rs
pub trait InterpretPrimitive {
    type Primitive: PrimitiveVal;

    fn to_primitive(self) -> Self::Primitive;
    fn reinterpret(primitive: Self::Primitive) -> Self;
}
```

最後に`InterpretVal`で、`Val`から解釈可能な型に実装します。`InterpretPrimitive`に加えて`Val`自身も実装しています。

```rs
pub trait InterpretVal: Sized {
    fn try_interpret_val(val: Val) -> Option<Self>;
    fn to_val(self) -> Val;
}
```

#### 各インスタンスとアドレスの定義
メモリーやテーブルのインスタンスやアドレスを定義します。`FooInst`と`FooAddr`を定義していき、`FooAddr`は`Rc<RefCell<FooInst>>`のnewtypeになります。外部に公開するのは`FooAddr`だけで、所有権の競合でパニックにならないように気をつけてインターフェイスを作っていきます。

例えばメモリであれば以下のような構造体になります。

```rs
struct MemInst {
    max: Option<usize>,
    data: Vec<u8>,
}

pub struct MemAddr(Rc<RefCell<MemInst>>);
```

関数は色々工夫しているので詳細に解説します。仕様書を読むと`funcinst`はwasmの関数とホスト関数があります。そしてwasmの関数は`moduleinst`を持っています。しかし`moduleinst`は`funcaddr`を持っており循環参照になってしまいます。循環参照になると`Rc`ではメモリリークしてしまうので`funcinst`が持つ`moduleinst`は`Weak`を使っています。

```rs
pub(super) enum FuncInst {
    RuntimeFunc {
        type_: FuncType,
        code: Func,
        module: Weak<ModuleInst>,
    },
    HostFunc {
        type_: FuncType,
        host_code: Rc<dyn Fn(Vec<Val>) -> Result<Option<Val>, WasmError>>,
    },
}
```

`Weak`を使うと`FuncAddr`を呼び出す時点で`ModuleInst`が長く生存していることをプログラマが保証する必要がありますが、今回はこれで妥協しました。もう少しいい方法がありそうなので改善したいです。

次にホスト関数の`FuncAddr`を簡単に作るするための工夫です。例えば`i32`を出力する関数は何もしないと以下のように書く必要があります。

```rs
FuncAddr(Rc::new(RefCell::new(FuncInst::HostFunc {
    type_: FuncType(vec![ValType::I32], vec![]),
    host_code: Rc::new(|params| {
        match &params[..] {
            [Val::I32(x)] => {
              println("{}", x);
              Ok(None)
            },
            _ => panic!()
        }
    })
})))
```

これが以下のように書けたら便利ですね。

```rs
FuncAddr::alloc_host(|(x,): (i32,)| {
  println("{}", x);
  Ok(())
})
```

これに`frunk`を使います。
まず`ValTypeable`というトレイトを定義します。これはある型を`Vec<ValType>`に変換する機能を持ったトレイトです。`write_valtype`を実装するようになっているのは計算量を抑えるためで`State`モナドみたいな物です。

```rs
pub trait ValTypeable {
    fn write_valtype(types: &mut Vec<ValType>);
    fn to_valtype() -> Vec<ValType> {
        let mut types = Vec::new();
        Self::write_valtype(&mut types);
        types
    }
}
```

これを各型に実装していきます。まず`InterpretPrimitive`を実装している型であればその型の解釈元のプリミティブ型になります。例えば`i32::to_valtype() == vec![ValType::I32]`です。

```rs
impl<T: InterpretPrimitive> ValTypeable for T {
    fn write_valtype(types: &mut Vec<ValType>) {
        types.push(T::Primitive::type_());
    }
}
```

次に`HNil`、つまり`()`のようなものに実装します。これは`vec![]`を返します。

```rs
impl ValTypeable for HNil {
    fn write_valtype(_: &mut Vec<ValType>) {}
}
```

最後に`HCons<H, T>`に実装します。これは順番に呼び出すだけです。

```rs
impl<H: ValTypeable, T: HList + ValTypeable> ValTypeable for HCons<H, T> {
    fn write_valtype(types: &mut Vec<ValType>) {
        H::write_valtype(types);
        T::write_valtype(types);
    }
}
```

これによって各要素が`InterpretPrimitive`を実装している`HList`全てで使えるようになりました。タプルは`Generic`を実装しているので、例えば`(i32, i64, bool)::Repr::to_valtype() == vec![ValType::I32, ValType::I64, ValType::I32]`です。(`T::Repr`は`HList`に変換した時の結果型)

同じような感じである型の値を`Option<Val>`に変換する`ToOptionVal`と、`Vec<Val>`からある型の値に変換する`FromVecVal`を定義します。
`ToOptionVal`は返り値を`Option<Val>`に変換するのに、`FromVecVal`は引数の`Vec<Val>`から変換するのに使います。

```rs
pub trait ToOptionVal {
    fn to_option_val(self) -> Option<Val>;
}

pub trait FromVecVal: Sized {
    fn from_vec_val_pop_tail(vals: &mut Vec<Val>) -> Self;

    fn from_vec_val(mut vals: Vec<Val>) -> Self {
        let res = Self::from_vec_val_pop_tail(&mut vals);
        assert_eq!(vals.len(), 0);
        res
    }
}
```

現在のwasmは複数の返り値をサポートしていないので、`ToOptionVal`は`HCons<T, H>`ではなく`HCons<T, HNil>`に実装しています。(これによって`()`や`(x,)`を返すことはできるが、`(x, y)`を返すとコンパイルエラーになる)。`from_vec_val`は解釈に失敗したらパニックになります。これは検証済みのwasmモジュールでは解釈に失敗することはないからという理由です。


これらを使って`alloc_host`を実装すると以下のようになります。

```rs
pub fn alloc_host<P: Generic, R: Generic>(
    f: impl Fn(P) -> Result<R, WasmError> + 'static,
) -> FuncAddr
where
    P::Repr: ValTypeable + FromVecVal,
    R::Repr: ValTypeable + ToOptionVal,
{
    let type_ = FuncType(P::Repr::to_valtype(), R::Repr::to_valtype());
    FuncAddr(Rc::new(RefCell::new(FuncInst::HostFunc {
        type_,
        host_code: Rc::new(move |params| {
            let p = P::Repr::from_vec_val(params);
            let r = into_generic(f(from_generic(p))?);
            Ok(r.to_option_val())
        }),
    })))
}
```

`Generic`を実装した引数の型`P`と返り値の型`R`を受け取って(これらは普通タプル型になる)、`ValTypeable`制約によって関数の型を生成し、`FromVecVal`と`ToOptionVal`制約によって引数と返り値を解釈したり変換したりしています。

各インスタンスやアドレスの定義はこれ以上解説しないので詳しく知りたい方はソースを読んでください。

* [func](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/exec/func.rs)
* [global](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/exec/global.rs)
* [mem](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/exec/mem.rs)
* [table](https://github.com/kgtkr/wasm-rs/blob/adc-2019-12-22/src/exec/table.rs)

ランタイム構造を定義します。  
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


real    1m25.723s
user    1m18.621s
sys     0m1.318s
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
