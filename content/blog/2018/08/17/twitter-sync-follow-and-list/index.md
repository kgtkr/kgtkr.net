---
title: Twitterでフォローとリストを同期するスクリプト(Python)
date: "2018-08-17T08:25:03.000Z"
update: "2018-08-17T08:25:03.000Z"
tags: ["twitter"]
name: twitter-sync-follow-and-list
lang: ja
otherLang: []
---
CK/CS/TK/TSに認証情報を、LIST_NAMEにリスト名を入れて実行すると同期されます

```py
import os
import tweepy


def list_split(n: int, list):
    return [list[i:i+n] for i in range(0, len(list), n)]


# 環境変数取得
ck = os.environ["CK"]
cs = os.environ["CS"]
tk = os.environ["TK"]
ts = os.environ["TS"]
list_name = os.environ["LIST_NAME"]

# 認証
auth = tweepy.OAuthHandler(ck, cs)
auth.set_access_token(tk, ts)
api = tweepy.API(auth)

# リストを検索
list_id = None
for x in api.lists_all():
    if x.name == list_name:
        list_id = x.id

# 存在しない場合は作る
if list_id == None:
    list_id = api.create_list(name=list_name, mode="private").id

# フォローユーザー一覧とリストユーザー一覧取得
friends = set(
    list(tweepy.Cursor(api.friends_ids, user_id=api.me().id).items()))
members = set([x.id for x in tweepy.Cursor(
    api.list_members, list_id=list_id).items()])

# リストに追加
for ids in list_split(100, list(friends-members)):
    api.add_list_members(list_id=list_id, user_id=ids)

# リストから削除
for ids in list_split(100, list(members-friends)):
    api.remove_list_members(list_id=list_id, user_id=ids)


```
