---
title: ABC167 C - Skill UpをHaskellで解く
date: "2020-05-11T00:28:59.803Z"
update: "2020-05-11T00:28:59.803Z"
tags: ["procon", Haskell]
name: abc167-c-haskell
lang: ja
otherLangs: []
---

## 問題
https://atcoder.jp/contests/abc167/tasks/abc167_c

## 解法
解法としては各本を買う/買わないで全探索すると`O(M2^N)`で解けます。
`C_n A_n_m`は型としては`[(Int, [Int])]`になります。各要素の`(Int, [Int])`は単位元を`(0, 要素が0の無限リスト)`、演算をfstは足す、sndはzipして各要素を足すとするとモノイドになりそうですし問題を解くのに使えそうです。このようになる`(Int, [Int])`のnewtypeは`(Sum Int, Ap ZipList (Sum Int))`になります。`Ap`は`Applicative f`と`Monoid a`から`Monoid (f a)`を作るnewtypeです。`ZipList`は`pure`を`repeat x`、`liftA2`を`zip`して関数適用という`Applicative`実装を持つ`List`のnewtypeなので`Ap`と組み合わせると欲しい`Monoid`が得られます。
ところで`newtype`の変換には`coerce`という関数が便利です。安全に変換できる2つの型同士をオーバーヘッドなしで変換してくれる便利関数です。ある型から`A`型に変換したい時は`TypeApplications`拡張と組み合わせて`id @A . coerce`と書くと型注釈が楽です。
次に非決定性計算です。Haskellのリストモナドは非決定性計算なので全探索に便利です。

```hs
do
  x <- [1, 2, 3]
  y <- [10, 20, 30]
  pure $ x + y
```

とすると、`[1, 2, 3]`と`[10, 20, 30]`を足した時の全パターンのリストを得ることができます。
今回は買う/買わないの全列挙で、買わない場合はさっきのモノイドの単位元になるので疑似コードは以下のようになりそうです。

```hs
do
  x_1 <- [x_1, mempty]
  x_2 <- [x_2, mempty]
  ︙
  x_n <- [x_n, mempty]

  pure $ x_1 <> x_2 <> … <> x_n
```

こうすることで、全購入パターンの金額と各アルゴリズムの理解度を得ることができます。
これは`fmap mconcat . traverse (: [mempty])`で実現できます。`(: [mempty])`は`\x -> [x, mempty]`です。`traverse`は与えられた関数で`fmap`したあとに`sequence`する関数です。`sequence`はここではリストで与えられたモナドを「実行」して結果のリストを得る関数を考えることができます。こうすることで全購入パターンを得ることができるので、各購入パターンで金額と各アルゴリズムの理解度を得るために`fmap mconcat`しています。

この後は`filter (all (>= x) . snd)`で各アルゴリズムの理解度が`x`以上の物のみをフィルタリングし(入力`x`は1以上で、各アルゴリズムの理解度が無限リストの時、つまり全て変わらないパターンの時全要素は0になるので無限ループにはなりません)、`map fst`で金額のみを取り出して`fromMaybe (-1) . foldl1May min`で金額の最小値を得る、存在しなければ`-1`を返すだけです。
`foldl1May`は`safe`パッケージにあるやつの特殊版でないので自分で定義しています。

## 全コード

```hs
{-# LANGUAGE TypeApplications #-}

import Data.Maybe
import Data.List
import Control.Monad
import Data.Bifunctor
import Control.Applicative
import Data.Monoid
import Data.Coerce

main :: IO ()
main = do
    [n, m, x] <- fmap (read @Int) . words <$> getLine
    list <- replicateM n $ fromJust . uncons . fmap (read @Int) . words <$> getLine
    print $ solve x list

solve :: Int -> [(Int, [Int])] -> Int
solve x = fromMaybe (-1)
        . foldl1May min
        . map fst
        . filter (all (>= x) . snd)
        . id @[(Int, [Int])]
        . coerce
        . fmap mconcat
        . traverse (: [mempty])
        . id @[(Sum Int, Ap ZipList (Sum Int))]
        . coerce

foldl1May :: (a -> a -> a) -> [a] -> Maybe a
foldl1May f (x:xs) = Just $ foldl f x xs
foldl1May _ _ = Nothing
```
