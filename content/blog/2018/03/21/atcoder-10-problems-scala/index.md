---
title: AtCoder に登録したら解くべき精選過去問 10 問を Scala で解いてみた
date: "2018-03-21T14:01:38.000Z"
update: "2018-03-21T14:01:38.000Z"
tags: ["procon","scala"]
name: atcoder-10-problems-scala
lang: ja
otherLang: []
---
# 初めに
けんちょんさんの↓の記事の10問をScalaで解いてみました
https://qiita.com/drken/items/fd4e5e3630d0f5859067
せっかくScalaで書くので変数の再代入、破壊的変更とfor/whileを一切使わずにやってみます。

# テンプレート
```scala
object Main{
  def main(args: Array[String]){
    if (sys.env.getOrElse("TEST", "")=="1"){
      println(test());
    }else{
      val input=io.Source.stdin.getLines().mkString("\n");
      println(solve(input).trim());
    }
  }

  def solve(input:String):String={
    input.split(" ").map(_.toInt).sum.toString()
  }

  val tests=List("""3 9""" -> """12""",
    """31 32""" -> """63""",
    """1 2""" -> """3""",
    """-1 2""" -> """1""",
    """10 1""" -> """11""");

  def test():String= {
    return tests.map{case (i,o)=>(i.trim(),o.trim())}
                .zipWithIndex.map{
                  case ((input,outputExpect),i)=>{
                  val output=solve(input).trim();
                    s"test${i+1}:"+(if(output==outputExpect){
                      "Passed"
                    }else{
                      s"Failed\nexpect:\n${outputExpect}\noutput:\n${output}"
                    })
                  }}
                .mkString("\n");
  }
}
```

## 解説
サンプルとして渡された2つの数字を足して出力するコードです。
本番では`solve`関数と`tests`を編集して使います。
以降は`solve`関数のみ貼ります。

### main
環境変数`TEST`に`1`が設定されていれば、テストを実行、そうでなければ標準入力から全て読み込んで`solve`関数に渡し、結果を出力しています。

### solve
入力として文字列を受け取り、結果を文字列で返す純粋関数です。
ここにロジックを書きます。
この関数を純粋にする事でテストを簡単にできます。

### tests
テストケースです。問題の例をここに貼り付けましょう。

### test
テストを実行する関数です。そこまで重要じゃないのでここでは説明しません。

# テストについて
やる/やらないは人によると思いますが、私は最低限のミス防止としてサンプルを貼り付けてテストをしています。
ただしいくつか気をつけないといけないことがあります。
まずサンプルの入出力が全てのコーナーケースをカバーしているとは限りません。またサンプルは値が小さい事が多いのでとても効率の悪い実装でもテストに通ることがよくあります。
次に答えが複数ある問題(ABC085_Cなど)や、小数を出力する問題です。文字列比較のテストだと、このような問題では答えがあっていてもテストに失敗することがあります。その問題用のテストを書けばいいのですが、コンテスト中にそこまでする時間はないので、その場合は手計算で答えがあっているか確認し、もしあっていればテストケースを書き換えましょう。

# 第 1 問:  [ABC 086 A - Product](https://beta.atcoder.jp/contests/abc086/tasks/abc086_a) (100 点)

```scala
def solve(input:String):String={
  if(input.split(" ").map(_.toInt).product%2==0){"Even"}else{"Odd"}
}
```

入力をスペースで分割し、数値に変換→productで積を取り偶奇判定を行います。

# 第 2 問:  [ABC 081 A - Placing Marbles](https://beta.atcoder.jp/contests/abc081/tasks/abc081_a) (100 点)

```scala
def solve(input:String):String={
  input.split("").filter(_=="1").size.toString()
}
```
入力を一文字ずつに分割し(split("")の注意は後記)、"1"のみをフィルタ、最後にサイズを取得します。


# 第 3 問:  [ABC 081 B - Shift Only](https://beta.atcoder.jp/contests/abc081/tasks/abc081_b) (200 点)

```scala
def solve(input:String):String={
  f(input.split("\n")(1).split(" ").map(_.toInt).toList,0).toString()
}

def f(list:List[Int],count:Int):Int={
  if(list.forall(_%2==0)){
    f(list.map(_/2),count+1)
  }else{
    count
  }
}
```
再帰の登場です。
`f`が再帰関数です。listは現在の黒板の文字、countは書き換えた回数です。
`forall`で全て偶数かを確認し、偶数なら全てを2で割り、書き換えた回数に1を足して再帰呼出しを、奇数なら終了します。

# 第 4 問:  [ABC 087 B - Coins](https://beta.atcoder.jp/contests/abc087/tasks/abc087_b) (200 点)

```scala
def solve(input:String):String={
  val List(a,b,c,x)=input.split("\n").map(_.toInt).toList;
  val ay=(0 to a).map(_*500);
  val by=(0 to b).map(_*100);
  val cy=(0 to c).map(_*50);
  ay.flatMap(i=>by.flatMap(j=>cy.map(k=>i+j+k)))
    .filter(_==x)
    .size
    .toString()
}
```
総当りです。全て足してxに一致するもののみをフィルタしてsizeでパターン数を取得しています。


# 第 5 問:  [ABC 083 B - Some Sums](https://beta.atcoder.jp/contests/abc083/tasks/abc083_b) (200 点)

```scala
def solve(input:String):String={
  val List(n,a,b)=input.split(" ").map(_.toInt).toList;
  (1 to n)
  
  .filter(x=>bitween(x.toString() 
                      .split("")
                      .filter(_.length!=0)
                      .map(_.toInt)
                      .sum
                     ,a
                     ,b))
  .sum
  .toString()
}
 
def bitween(x:Int,min:Int,max:Int)=min<=x&&x<=max;
```
`bitween`は`min<=x<=max`の判定を行うヘルパ関数です。
1からnまでを列挙し、各桁の和が範囲内のもののみをフィルタ、sumでフィルタした数の和を取ります。

## `split("")`について
`split("")`はJVM7以前とJVM8以降で動作が異なります。AtCoderのScalaはJVM7です。
なので動作を合わせるために`split("").filter(_.length!=0)`としましょう。
https://qiita.com/komiya_atsushi/items/7fdca9710578723fa8c7

# 第 6 問:  [ABC 088 B - Card Game for Two](https://beta.atcoder.jp/contests/abc088/tasks/abc088_b) (200 点)

```scala
def solve(input:String):String={
  val (a,b)=input
            .split("\n")(1)
            .split(" ")
            .map(_.toInt)
            .sorted
            .reverse
            .zipWithIndex
            .foldRight((0,0)){
              case ((x,i),(an,bo)) =>
                if(i%2==0){
                  (an+x,bo)
                }else{
                  (an,bo+x)
                }
             };
  (a-b).toString()
}
```
まずリストを降順にソートし、インデックスをつけます。
この時インデックスが偶数ならAliceが、奇数ならBobがカードを取るのでfoldRightでシミュレートします。
最後に二人の差を取って終わりです。


# 第 7 問:  [ABC 085 B - Kagami Mochi](https://beta.atcoder.jp/contests/abc085/tasks/abc085_b) (200 点)

```scala
def solve(input:String):String={
  input.split("\n").drop(1).toSet.size.toString()
}
```
toSetで重複をなくしてsizeでサイズを取得するだけです。

# 第 8 問:  [ABC 085 C - Otoshidama](https://beta.atcoder.jp/contests/abc085/tasks/abc085_c) (300 点)

```scala
def solve(input:String):String={
  val List(n,y)=input.split(" ").map(_.toInt).toList;
  f1(n,y,0) match{
    case Some((a,b,c))=>s"${a} ${b} ${c}"
    case None=>"-1 -1 -1"
  }
}

def f1(n:Int,y:Int,a:Int):Option[(Int,Int,Int)]={
  if(a<=n){
    f2(n,y,a,0) match{
      case Some(v)=>Some(v)
      case None=>f1(n,y,a+1)
    }
  }else{
    None
  }
}

def f2(n:Int,y:Int,a:Int,b:Int):Option[(Int,Int,Int)]={
  if(b<=n-a){
    val c=n-a-b;
    if(a*10000+b*5000+c*1000==y){
      Some((a,b,c))
    }else{
      f2(n,y,a,b+1)
    }
  }else{
    None
  }
}
```
2重ループを再帰で行っています。
f1が外側のループ、f2が内側のループです。
引数`a`は10000円札の枚数、`b`は5000円札の枚数でそれを全探索していきます。

# 第 9 問:  [ABC 049 C - Daydream](https://beta.atcoder.jp/contests/abc049/tasks/arc065_a) (300 点)

```scala
def solve(input:String):String={
  if(f(input.toList.reverse)){
    "YES"
  }else{
    "NO"
  }
}

 def f(s:List[Char]):Boolean={
  s match{
    case List('m','a','e','r','d',x @ _*)=>f(x.toList)
    case List('r','e','m','a','e','r','d',x @ _*)=>f(x.toList)
    case List('e','s','a','r','e',x @ _*)=>f(x.toList)
    case List('r','e','s','a','r','e',x @ _*)=>f(x.toList)
    case List()=>true
    case _=>false
  }
}
```
文字列を反転させてパターンマッチで順に消していっています。リストが空になれば可能、マッチするものがなければ不可能です。

# 第 10 問:  [ABC 086 C - Traveling](https://beta.atcoder.jp/contests/abc086/tasks/arc089_a) (300 点)

```scala
def solve(input:String):String={
  val list=input
           .split("\n")
           .drop(1)
           .map(_.split(" ").map(_.toInt))
           .map{case Array(t,x,y)=>(t,x,y)}
           .toList;
  if(((0,0,0)::list)
     .zip(list)
     .forall{case ((t,x,y),(nextT,nextX,nextY))=>{
    val dt = nextT - t;
    val dist = (nextX-x).abs + (nextY-y).abs;
    dt >= dist&&dist % 2 == dt % 2
  }}){
    "Yes"
  }else{
    "No"
  }
}
```
zipで一つずらして2つのリストを結合して現在の位置時と次の位置時をとっています。
forallの中身はけんちょんさんの記事と全く同じなのでそっちを見て下さい。


# 最後に
もっと綺麗に書けるよとかあったら教えて下さい。
