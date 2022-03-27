---
title: 型推論について勉強して実装したメモ
date: "2021-09-22T17:36:41.456Z"
update: "2021-09-22T17:36:41.456Z"
tags: ["languageprocessor", "ocaml", "tklang"]
name: type-inference
lang: ja
otherLangs: []
---

[プログラミング言語の基礎概念](https://www.amazon.co.jp/dp/4781912850)を読んで実装したのでメモ。[OCaml実装](https://github.com/kgtkr/tklang/tree/4c2cd5de84ec872e9366470228580ed16cca5eb1)。間違っているところがあったら指摘して下さると助かります。

## 作ったもの
コードを入力すると型推論結果を返すプログラムです。型チェック失敗時のエラーメッセージは未実装です。

### 例

関数合成する `compose` 関数を例にします。

```ocaml
let compose = fun f -> fun g -> fun x -> f (g x) in compose
↓
(let {3: {'2,'3,'4}(('3 -> '4) -> (('2 -> '3) -> ('2 -> '4)))} = (fun {0: {}('3 -> '4)} -> (fun {1: {}('2 -> '3)} -> (fun {2: {}'2} -> ({0}: ('3 -> '4) ({1}: ('2 -> '3) {2}: '2): '3): '4): ('2 -> '4)): (('2 -> '3) -> ('2 -> '4))): (('3 -> '4) -> (('2 -> '3) -> ('2 -> '4))) in {3}: (('6 -> '7) -> (('5 -> '6) -> ('5 -> '7)))): (('6 -> '7) -> (('5 -> '6) -> ('5 -> '7)))
```

読みにくいですね。識別子は数値のid化され、全ての式に型注釈と括弧がついています。型の前の `{...}` は `forall` です。整理するとこんな感じです。

```ocaml
let
    (compose: {'2,'3,'4}(('3 -> '4) -> ('2 -> '3) -> ('2 -> '4))) = ((fun {f: {}('3 -> '4)} -> fun (g: {}('2 -> '3)) -> fun (x: {}'2) -> f (g x)): (('3 -> '4) -> ('2 -> '3) -> ('2 -> '4)))
in
    (compose: (('6 -> '7) -> ('5 -> '6) -> ('5 -> '7)))
```

## 推論対象の言語
OCaml風の言語で、let多相で、型として `bool`、`int`、`'a -> 'b`、`'a list`を、構文として関数適用、演算子、`let`、`let rec`、`fun`、`if`、`match`を持つ言語です。`'a 'f -> 'b 'f` のような高カインド型、 `(forall 'a . 'a list -> 'a list) -> (int list * bool list) -> (int list * bool list)` のようなランクN多相(現在はタプル型もないがそれは置いておいて)、`type hoge = hoge list` (`hoge=(((...) list) list) list`) のような無限の長さの型は存在しません。


## 用語
### 型
型変数を含むかもしれない型です。`type_var_id` は型変数のユニークなidです。`forall 'a . 'a -> 'a` のように型変数を束縛することはありません。

```ocaml
type type_var_id = int
type typ = TypeVar of type_var_id | Bool | Int | Func of typ * typ | List of typ
```
### 型スキーム
束縛型変数+型です。`type_var_id Set.t` は本当は `module SetInt = Set.Make(Int)` した時の `type_var_id SetInt.t` ですが本質ではないので今回はこの表記を使います。

```ocaml
type type_scheme = type_var_id Set.t * typ
```

### 型環境
変数→型スキームのMapです。例えば `x: int, y: forall a . a -> a` みたいなものです。`var_id` は識別子をユニークなidに変換した値です。同名の異なる識別子も異なるidになっているものとします。以降で処理しやすいように型環境中の型スキームが束縛している型変数のidはユニークであるものとします。例えば型環境中に `forall 'a . 'a` と `forall 'a . 'a list` があった場合は2番目を `forall 'b . 'b list` に変換することでユニークにすることができます。

```ocaml
type var_id = int
type type_env = (var_id, type_scheme) Map.t
```

### 型代入
型変数に型を代入する処理もしくは、置き換え対象の型変数から置き換える型を表すデータです。代入後も型変数になる可能性もあります。例えば `'a -> 'b -> 'c` に `'a='d、'b=int` を代入すると `'d -> int -> 'c` になります。型環境中の型スキームが束縛している型変数のidはユニークであるものとしたので `forall 'a . 'a -> 'a` に `'a=int` を代入するといったことは起こりません。よって `sub_type_scheme` は束縛変数を無視して代入しても問題ありません。

```ocaml
type type_sub = (type_var_id, typ) Map

let rec sub_type (s: type_sub) (t: typ) = match t with
    | TypeVar id -> Map.find_opt id s |> Option.value ~default: t
    | Bool -> t
    | Int -> t
    | Func (t1, t2) -> Func (sub_type s t1, sub_type s t2)
    | List t1 -> List (sub_type s t1)


let sub_type_scheme (s: type_sub) ((vars, t): type_scheme): type_scheme = (vars, sub_type s t)

let sub_env (s: type_sub) (e: type_env): type_env = Map.map (sub_type_scheme s) e
```

## 単一化の実装
型に関する方程式を解く(型代入を返す)処理です。型推論は型に関する方程式を立ててそれを解くことで行うのでこの解く処理が必要です。

まず複数の方程式を表す `type_equs` を定義します。これは `型1=型2` という方程式を表すタプルのリストです。

```ocaml
type type_equs = (typ * typ) list
```

次に補助関数として型の等価判定関数を定義します。単純なデータの一致判定ですね。

```ocaml
let rec type_eq (t1: typ) (t2: typ): bool = match (t1, t2) with
    | (TypeVar id1, TypeVar id2) -> id1 = id2
    | (Bool, Bool) -> true
    | (Int, Int) -> true
    | (Func (t1, t2), Func (t3, t4)) -> type_eq t1 t3 && type_eq t2 t4
    | (List t1, List t2) -> type_eq t1 t2
    | _ -> false
```

もう1つ補助関数として型から自由変数を取り出す関数を定義します。型に束縛変数はないので自由変数=型に含まれる全ての型変数です。

```ocaml
let rec type_ftv (ts: t): type_var_id Set.t = match ts with
    | TypeVar id -> Set.singleton id
    | Bool -> Set.empty
    | Int -> Set.empty
    | Func (t1, t2) -> Set.union (type_ftv t1) (type_ftv t2)
    | List t -> type_ftv t
```

最後に単一化の実装です。`a=a` は情報がないので無視します。`'x=a` もしくは `a='x` の時(`a=a` のパターンが先にあるので `'x!=a`)、`a` に `'x` が含まれていたら型エラーになります。例えば`'x='x list` という方程式があるとき `'x`が有限であるという制約のもとでこれを解くことはできません。`a` に `'x` が含まれていなければそのまま `'x=a` という型代入を返します。`a f=b f` は `a=b` にして解きます(型の長さは有限なので停止する)。それ以外の時は方程式を解くことができません(=型エラー)。例えば `'a='b list, 'b list = 'c list` の結果は `'a='b list, 'b='c` という型代入になります。

```ocaml
let rec unify (equs: type_equs): type_sub = match equs with
    | [] -> Map.empty
    | (t1, t2) :: equs when type_eq t1 t2 -> unify equs
    | ((TypeVar id, t) | (t, TypeVar id)) :: equs -> if Set.mem id (type_ftv t) then raise UnifyError else Map.add id t (unify (sub (Map.singleton id t) equs))
    | (Func(t11, t12), Func(t21, t22)) :: equs -> unify ((t11, t21) :: (t12, t22) :: equs)
    | (List(t1), List(t2)) :: equs -> unify ((t1, t2) :: equs)
    | _ -> raise UnifyError
```

ここが思っていたより簡単で驚きました(連立一次方程式を解くプログラムみたいなものを想像していた)。型に関する方程式であって、型スキームに関する方程式ではないのがポイントだと思います。例えば型スキームに関するものだと`forall 'a . 'a list` と `forall 'b . 'b list` は等しいのでここまで簡単にはできなさそうです。ランクN多相などが入ると大変そうですね。また無限の長さの型(例えばTypeScriptだと`type A = Array<A>` がコンパイル通る)や高カインド型があったりする場合どうなるんだろう(そもそも決定可能なのか？)。

### 型推論の実装
実装したプログラムのように、全ての部分式の型を取得するには式にidを割り振って、推論途中の情報を適当に保存しておく必要がありますが本質ではないのでここでは省きます。

ASTの定義です。

```ocaml
type
    op = Add | Sub | Mul | Lt
    and pat = AnyPat of var_id | EmptyListPat | ConsPat of pat * pat | IgnorePat
    and clause = pat * expr
    and expr =
    | Int of int
    | Bool of bool
    | Var of var_id
    | Op of expr * op * expr
    | If of expr * expr * expr
    | Let of var_id * expr * expr
    | Fun of var_id * expr
    | Ap of expr * expr
    | LetRecFun of var_id * var_id * t * expr
    | EmptyList
    | Cons of expr * expr
    | Match of expr * clause list;;
```

補助関数 `closure` などです。 `type_scheme_ftv` は型スキームの自由変数、すなわち型の自由変数から束縛変数を除いたものを返します。 `type_env_ftv` は型環境中の自由変数、すなわち型環境中の型スキームの自由変数の和集合を返します。`closure` は型をある型環境上で型スキームに変換する関数です。これは、型の自由変数のうち、型環境の自由変数を除いたものを束縛する型スキームを返します。例えば型環境に `forall 'a . 'a -> 'b` がある状態で、 `'b -> 'c` を `closure` で型スキームに変換すると `forall 'c . 'b -> 'c` になります。([uint256さんが説明していたのは](https://qiita.com/uint256_t/items/7d8c8feeffc03b388825)こういうことだったのかやっと理解した)

```ocaml
let type_scheme_ftv ((vars, t): type_scheme): type_var_id Set.t = Set.diff (type_tv t) vars

let type_env_ftv (te: type_env): type_var_id Set.t = Map.fold (fun _  x acc -> Set.union (type_scheme_ftv x) acc) te Set.empty

let closure (typ: typ) (tenv: type_env): type_scheme = (Set.diff (type_ftv typ) (type_env_ftv tenv), typ)
```

補助関数 `pt_pat_helper` です。これはパターンの型と、パターン中の識別子によって新たに追加される型環境と型代入(型代入は返さなくていいかも)を返します。 `counter` はユニークな型変数を割り振るためのものです。例えば `x :: y :: []` というパターンがあった時、型環境に `x, y` という変数が追加されどちらも型は新たに生成した型変数 `'a`
になります。この時パターン全体の型は `'a list` です。

```ocaml
let rec pt_pat_helper (p: pat) (counter: int): (type_sub * typ * type_env * int) = match p with
    | AnyPat id -> (* id *)
        let (t, counter) = (TypeVar counter, counter + 1) in
        (Map.empty, t, Map.singleton id (Set.empty, t), counter)
    | EmptyListPat -> (* [] *)
        let (t, counter) = (TypeVar counter, counter + 1) in
        (Map.empty, List t, Map.empty, counter)
    | ConsPat (p1, p2) -> (* p1 :: p2 *)
        let (s1, t1, tenv1, counter) = pt_pat_helper p1 counter in
        let (s2, t2, tenv2, counter) = pt_pat_helper p2 counter in
        let s3 = unify ((List t1, t2) :: List.concat [from_sub s1; from_sub s2]) in
        (s3, sub_type s3 t2, Map.add_seq (Map.to_seq tenv2) tenv1, counter)
    | IgnorePat -> (* _ *)
        let (t, counter) = (TypeVar counter, counter + 1) in
        (Map.empty, t, Map.empty, counter)

```

最後に型推論の実装です。型環境と式を受け取って、型代入と式の型(型スキームではない)を返します。

例えば数値リテラル`Int` は単純で、型は無条件で `int` になります。返す型代入もありません。

`If` は `e1, e2, e3` を推論し、それぞれ型 `t1, t2, t3` と型代入 `s1, s2, s3` を得ます。その後 `t1=bool`、`t2=t3` という方程式を、型代入 `s1, s2, s3` をそのまま方程式に変換(`'a=int` という型代入をそのまま `'a=int` という方程式として解釈する。`from_sub` 関数を使う)したものと組み合わせて単一化の処理をし、新たな型代入 `s4` を得ます。そして`if` 式全体のの型は `t2` (`t3` でも良い) に `s4` を型代入したものになります。

`Fun` は引数に新たな型変数 `t1` を割り当て、引数を型環境に追加した状態で `e` を推論し、その型を `t2` とすると全体の型は `t1 -> t2` になります。

このように基本は未知の型に新たな型変数を割り当てる→必要に応じて型環境に追加した状態で部分式を推論する→部分式の推論結果+式固有の方程式を使って単一化して、それを型代入して結果の型を作るという処理になります。ただし多相に関わる変数参照、`let`、`let rec fun` は特殊です。

`Var` は変数参照です。まず型環境から型スキームを取り出します。そして型スキームが束縛している全ての型変数を新たな型変数で置き換えます。例えば型環境 `x: forall 'a 'b . 'a -> 'b` で `x` を参照する式があったとき、新たな型変数を `'c, 'd` として `'c -> 'd` を式の型とします(ここ面白い)。なぜこれで上手く行くかは後で解説します。

let多相なので `let` 式である `Let` も重要です。まず `e1` を推論して `t1, s1` を得ます。そして型環境に `s1` を型代入したものと、`t1` を `closure` に渡して型スキーム `t1c` を得ます。ここで自由変数を束縛することで多相を実現しています。そして、`t1c` を型環境に加えた状態で `e2` を推論して `t2, s2` を得て `s1, s2` を単一化して `s3` を得てこれを `t2` に型代入したものを式の型として終了です。

`LetRecFun` は `Let` と似ていますが関数内から束縛した変数を参照できるところが違います。重要なところは `e1` を評価するときに型環境に追加する `id1` は型変数を束縛しない型スキームとなっているところです。`e2` を評価する時は `closure` 関数を使って型変数を束縛していますね。これは `e1` 、つまり再帰関数の中では再帰関数自信は多相にならないということです。例えば `let rec id = fun x -> id(1);x in ...` (`;` はこの言語にはありませんが1つ目の式を無視して2つ目の式の結果を返す演算子とします) とすると `id` は `forall 'a . 'a -> 'a` ではなく `int -> int` になります。`let rec id = fun x -> x in ...` であれば多相関数として使えます。この理由はここを多相にしてしまうと型推論が決定不能になるかららしいです(これ知らなかった。OCamlで試したら本当に多相にならない仕様でした)。

```ocaml
let rec pt (tenv: type_env) (expr: expr) (counter: int): (type_sub * typ * int) = match expr with
    | Int _ -> (Map.empty, Int, counter)
    | Bool _ -> (Map.empty, Bool, counter)
    | Var id -> (* id *)
        let (tvars, typ) = Map.find id tenv in
        let (s, counter) = tvars |> Set.to_seq |> Seq.fold_left (fun (s, counter) tvar -> (Map.add tvar (TypeVar counter) s, counter + 1)) (Map.empty, counter) in
        (Map.empty, sub_type s typ, counter)
    | Op (e1, op, e2) -> (* e1 op e2 *)
        let (s1, t1, counter) = pt tenv e1 counter in
        let (s2, t2, counter) = pt tenv e2 counter in
        let s3 = unify ((t1, Int) :: (t2, Int) :: List.concat [from_sub s1; from_sub s2]) in
        let t3 = (match op with Lt -> Bool | _ -> Int) in
        (s3, sub_type s3 t3, counter)
    | If (e1, e2, e3) -> (* if e1 then e2 else e3 *)
        let (s1, t1, counter) = pt tenv e1 counter in
        let (s2, t2, counter) = pt tenv e2 counter in
        let (s3, t3, counter) = pt tenv e3 counter in
        let s4 = unify ((t1, Bool) :: (t2, t3) :: List.concat [from_sub s1; from_sub s2; from_sub s3]) in
        (s4, sub_type s4 t2, counter)
    | Let (id, e1, e2) -> (* let id = e1 in e2 *)
        let (s1, t1, counter) = pt tenv e1 counter in
        let t1c = closure t1 (sub_env s1 tenv) in
        let (s2, t2, counter) = pt (Map.add id t1c tenv) e2 counter in
        let s3 = unify (List.concat [from_sub s1; from_sub s2]) in
        (s3, sub_type s3 t2, counter)
    | Fun (id, e) -> (* fun id -> e *)
        let (t1, counter) = (TypeVar counter, counter + 1) in
        let (s, t2, counter) = pt (Map.add id (Set.empty, t1) tenv) e counter in
        (s, Func(sub_type s t1, t2), counter)
    | Ap (e1, e2) -> (* e1 e2 *)
        let (s1, t1, counter) = pt tenv e1 counter in
        let (s2, t2, counter) = pt tenv e2 counter in
        let (t3, counter) = (TypeVar counter, counter + 1) in
        let s3 = unify ((t1, Func(t2, t3)) :: List.concat [from_sub s1; from_sub s2]) in
        (s3, sub_type s3 t3, counter)
    | LetRecFun (id1, id2, e1, e2) -> (* let rec id1 = fun id2 -> e1 in e2 *)
        let (t_id1, counter) = (TypeVar counter, counter + 1) in
        let (t_id2, counter) = (TypeVar counter, counter + 1) in
        let (s1, t1, counter) = pt (tenv |> Map.add id1 (Set.empty, t_id1) |> Map.add id2 (Set.empty, t_id2)) e1 counter in
        let s2 = unify ((t_id1, Func(t_id2, t1)) :: (from_sub s1)) in
        let t_id1c = closure (sub_type s2 t_id1) (sub_env s2 tenv) in
        let (s3, t3, counter) = pt (Map.add id1 t_id1c tenv) e2 counter in
        let s4 = unify (List.concat [from_sub s2; from_sub s3]) in
        (s4, sub_type s4 t3, counter)
    | EmptyList -> (* [] *)
        let (t1, counter) = (TypeVar counter, counter + 1) in
        (Map.empty, List t1, counter)
    | Cons(e1, e2) -> (* e1 :: e2 *)
        let (s1, t1, counter) = pt tenv e1 counter in
        let (s2, t2, counter) = pt tenv e2 counter in
        let s3 = unify ((t2, List t1) :: List.concat [from_sub s1; from_sub s2]) in
        (s3, sub_type s3 t2, counter)
    | Match (e1, clauses) -> (* match e1 with clauses (clausesは | pat -> e2 のlist)*)
        let (s1, t1, counter) = pt tenv e1 counter in
        let (t2, counter) = (TypeVar counter, counter + 1) in
        let (s2, counter) = List.fold_left (fun (s2, counter) (pat, e2) ->
            let (pat_s, pat_t, pat_tenv, counter) = pt_pat_helper pat counter in
            let (e2_s, e2_t, counter) = pt (Map.add_seq (Map.to_seq pat_tenv) tenv) e2 counter in
            let s2 = unify ((t1, pat_t) :: (t2, e2_t) :: List.concat [from_sub pat_s; from_sub e2_s; from_sub s2]) in
            (s2, counter)
        ) (Map.empty, counter) clauses in
        let s3 = unify (List.concat [from_sub s1; from_sub s2]) in
        (s3, sub_type s3 t2, counter)
```


### 多相型推論がどう行われるかの説明
変数参照での束縛変数の型変数の置き換えと、letでの自由変数の束縛が多相型推論を行う上で重要です。以下のコードを例に考えてみます。

```ocaml
let id = fun x -> x in
let a = id 1 in
let b = id true in
...
```

まず、変数参照での束縛変数の型変数の置き換えと、letでの自由変数の束縛を行わないとどうなるかを考えてみましょう。

`fun x -> x` は引数 `x` に新たな型変数 `'a` を割り当て、型環境 `x: 'a` で `x` を推論すると `'a` になるので全体は `'a -> 'a` になります。型代入はありません。次に `id 1` の部分で `'a=int` という方程式が作られます。しかしその後に `id true` があります。ここで `'a=bool` という方程式が作られます。これは `'a=int` と矛盾するので型チェック失敗です。`id` が多相になっていませんね。

そこでまず、 `id` に関数を束縛するときに自由な型変数 `'a` を束縛し、型スキームを `forall 'a . 'a -> 'a` とします。 `id 1` で変数 `id` を参照しているので束縛された型変数 `'a` を新たな型変数 `'b` で置き換え(型環境の `id` は `forall 'a . 'a -> 'a` のままです。置き換えられるのは変数参照の式の型) `id` の型は `'b -> 'b` になります。`id 1` となっているので `'b=int` です。次に `id true` の部分です。また `id` を参照しているので`'a`を新たな型変数`'c` で置き換え `id` の型は `'c -> 'c` となります。`id true` より `'c=bool`です。`'b=bool, 'c=int` は矛盾していないので型チェックに通ります。`id` が多相になりました。このように `let` に束縛するときに自由な型変数を束縛し、変数を参照するときに束縛された型変数を新たな型変数で置き換え方程式を立てることで多相になります。

式の型は型スキームではなく型なので多相関数を参照する式も当然型スキームではありませんが、このように束縛された型変数を新たな型変数で置き換えることで上手くいくのは面白いですね。

ところで `closure` 関数は単純に式の型の自由変数を束縛するのではなく、型環境の自由変数を除いて束縛していましたね。これは以下のようなケースで型安全にならなくなるのを防ぐためです。

```ocaml
let f = fun x ->
  let y = x in
    (* ここでy=intかつy=boolを要求する式 *)
```

もし型環境の自由変数を除かない場合、まず引数の `x` に新たな型変数 `'a` が割り当てられます。次に `y` の型スキームは `x` の自由変数 `'a` を束縛し、 `forall 'a . 'a` になります。そして `y=int` を要求する式で `y` を参照するときには `'a` が新たな型変数 `'b` に置き換えられ、`y=bool` を要求する式で `y` を参照するときには `'a` が新たな型変数 `'c` に置き換えられ、`'b=int, 'c=bool` という方程式が立てられますが矛盾は起きません。これは明らかにおかしいですね。型環境に含まれる型環境は `closure` で束縛する型変数から外してしまえば `y` の型スキームは `'a` (束縛型変数なし)になるので `y` を参照する式ではどこも型が `'a` となり、`'a=int, 'a=bool` という方程式が立てられ矛盾するので型チェックに通りません(ﾔｯﾀｰ)。これは `forall 'a` な関数を使う側は `'a` には何を代入してもいいが、定義する側は `'a` に何が来るか分からないので存在型のようになることと対応しているんですかね？(本当に？)
