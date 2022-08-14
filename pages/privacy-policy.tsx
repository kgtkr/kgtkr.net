import React from "react";
import { NextPage } from "next";
import Title from "../components/Title";

const PrivacyPolicy: NextPage = () => {
  return (
    <div>
      <Title title="プライバシーポリシー" />
      <h1>プライバシーポリシー</h1>
      <ul>
        <li>Cookieを使用しています</li>
        <li>Cookieはブラウザの設定から無効化することができます</li>
        <li>アクセス解析のためにGoogle Analyticsを使用しています</li>
      </ul>
    </div>
  );
};

export default PrivacyPolicy;
