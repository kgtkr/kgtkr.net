import Script from "next/script";
import { useRouter } from "next/router";
import * as React from "react";

export type Props = {};

function GoogleAnalytics({}: Props): JSX.Element {
  const gaid = "UA-160194076-1";
  const router = useRouter();
  React.useEffect(() => {
    const handleRouteChange = (path: string) => {
      window.gtag("config", gaid, {
        page_path: path,
      });
    };

    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      <Script
        defer
        src={`https://www.googletagmanager.com/gtag/js?id=${gaid}`}
        strategy="afterInteractive"
      />
      <Script
        defer
        id="kgtkrnet-ga"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaid}');
    `,
        }}
      />
    </>
  );
}

export default GoogleAnalytics;
