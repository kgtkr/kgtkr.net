import Script from "next/script";
import * as React from "react";

export type Props = {};

function GoogleAdsense({}: Props): JSX.Element {
  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6442863011143176"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </>
  );
}

export default GoogleAdsense;
