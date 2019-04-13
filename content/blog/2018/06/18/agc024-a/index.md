---
title: AGC024-A Fairnessの考察
date: "2018-06-18T12:51:11.000Z"
description: ""
tags: []
---

[AGC024-A Fairness](https://beta.atcoder.jp/contests/agc024/tasks/agc024_a)の考察を頑張って書いたので残したいなと。  
解説の解き方とは全く違う解き方をしたけど答えは同じになったので数学って凄いなと思いました(こなみ)

あと[wolframalpha](http://www.wolframalpha.com/)ってのが凄い。  
複雑な式変形とか漸化式も自動で解いてくれる。競プロでDPしたい時とか使えそう。

って事で考察です。


```
k回操作後のa,b,cの値をそれぞれ
fa(k),fb(k),fc(k)
とする
a,b,cはfa(0),fb(0),fc(0)
を表す事とする

操作を行っていくとa,b,cはそれぞれ
fa(0),fb(0),fc(0)=a,b,c
fa(1),fb(1),fc(1)=b+c,a+c,b+c
fa(2),fb(2),fc(2)=2a+b+c,a+2b+c,a+b+2c
fa(3),fb(3),fc(3)=2a+3b+3c,3a+2b+3c,3a+3b+2c
fa(4),fb(4),fc(4)=6a+5b+5c,5a+6b+5c,5a+5b+6c
となっていく

fa(k),fb(k),fc(k)のa,b,cの係数を
(fa(k)のaの係数,fa(k)のbの係数,fa(k)のcの係数)(fb(k)のaの係数,fb(k)のbの係数,fb(k)のcの係数)(fc(k)のaの係数,fc(k)のbの係数,fc(k)のcの係数)
とすると

k=0: (1,0,0)(0,1,0)(0,0,1)
k=1: (0,1,1)(1,0,1)(1,1,0)
k=2: (2,1,1)(1,2,1)(1,1,2)
k=3: (2,3,3)(3,2,3)(3,3,2)
k=4: (6,5,5)(5,6,5)(5,5,6)
となる

k回操作後の係数を
(f(k),g(k),g(k))(g(k),f(k),g(k))(g(k),g(k),f(k))
とすると

f(0)=1
g(0)=0
f(k+1)=g(k)*2
g(k+1)=f(k)+g(k)
という連立漸化式を得られる

これを解くと
f(k)=1/3(2(-1)^k+2^k)
g(k)=1/3((-1)^(1+k)+2^k)

また、fa(k),fb(k),fc(k)の値は
fa(k)=f(k)a+g(k)b+g(k)c
fb(k)=g(k)a+f(k)b+g(k)c
fc(k)=g(k)a+g(k)b+f(k)c
である

求める値は
fa(k)-fb(k)
=(f(k)a+g(k)b+g(k)c)-(g(k)a+f(k)b+g(k)c)
=f(k)a+g(k)b-g(k)a-f(k)b
=f(k)(a-b)+g(k)(b-a)
=1/3(2(-1)^k+2^k)(a-b)+1/3((-1)^(1+k)+2^k)(b-a))
=(-1)^k(a-b)

よって
kが偶数の時:a-b
kが奇数の時:b-a
```