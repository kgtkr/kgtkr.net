import React from "react";
import { NextPage } from "next";
import Title from "../components/Title";

const PrivacyPolicy: NextPage = () => {
  return (
    <div>
      <Title title="プライバシーポリシー" />
      <h1>プライバシーポリシー</h1>
      <ul>
        <li>
          当サイトではCookieを使用しています.
          Cookieはブラウザの設定から無効化することができます
        </li>
        <li>CookieはGoogle Analyticsに使用されます.</li>
      </ul>
    </div>
  );
};

export default PrivacyPolicy;
