---
title: n^0+n^1+n^2が6a+5の倍数でない事の証明
date: "2018-10-13T09:35:42.000Z"
description: ""
tags: ["math"]
name: proof
---

何かツイート流れてきたので


<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">特に高い物の証明が出来る腕は無いが、<br>n^0+n^1+n^2(n:自然数)は5,11,17,23,29の倍数にはならぬらしい。</p>&mdash; 柏木 (@kasiha_ki) <a href="https://twitter.com/kasiha_ki/status/1051024253900840961?ref_src=twsrc%5Etfw">2018年10月13日</a></blockquote>
<blockquote class="twitter-tweet" data-conversation="none" data-lang="ja"><p lang="ja" dir="ltr">以降41,47,53,59,71,83,89,101,107……。畑違いの身には全く解らぬ。</p>&mdash; 柏木 (@kasiha_ki) <a href="https://twitter.com/kasiha_ki/status/1051025858440228864?ref_src=twsrc%5Etfw">2018年10月13日</a></blockquote>
<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">ゆるぼ<br>n^0+n^1+n^2(n:自然数)が5,11,17,23,29の倍数にならないという証明</p>&mdash; 和差積 商🍀🌈🎵 (@mofmof_hana) <a href="https://twitter.com/mofmof_hana/status/1051028781899571200?ref_src=twsrc%5Etfw">2018年10月13日</a></blockquote>

* 証明
$n,\ a$が整数の時、$n^0+n^1+n^2$、すなわち$n+n^2$が$6a+5$の倍数にならないことを証明する
$6a+5$の倍数は$k$を整数とすると$(6a+5)k$と表す事が出来る
$1+n+n^2$が$6a+5$の倍数だと仮定すると、
$1+n+n^2=(6a+5)k$
$n,\ a$が$5$の倍数の時、$p,\ q$を整数とし$n=5p$、$a=5q$とすると、
$$
\begin{aligned}
\text{(左辺)} &=& 1+5p+(5p)^2 \\
&=& 1+5p+25p^2 \\
&=& 1+5(p+5p^2)
\end{aligned}
$$

$$
\begin{aligned}
\text{(右辺)} &=& (6 \cdot 5q + 5)k \\
&=& 5k(6q+1)
\end{aligned}
$$
よって左辺は$5$の倍数でない、右辺は$5$の倍数となり矛盾する
よって$n^0+n^1+n^2$は$6a+5$の倍数ではない