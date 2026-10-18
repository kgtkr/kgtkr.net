import React, { Suspense } from "react";
import styles from "./Graphviz.module.scss";
import { Graphviz as GraphvizType } from "@hpcc-js/wasm-graphviz";

let graphvizPromise: Promise<GraphvizType> | null = null;
let graphvizInstance: GraphvizType | null = null;
let graphvizError: unknown = null;

function getGraphvizPromise(): Promise<GraphvizType> {
  if (!graphvizPromise) {
    graphvizPromise = GraphvizType.load()
      .then((g) => {
        graphvizInstance = g;
        return g;
      })
      .catch((err) => {
        graphvizError = err;
        throw err;
      });
  }
  return graphvizPromise;
}

getGraphvizPromise().catch(() => {});

function useGraphviz(): GraphvizType {
  if (graphvizInstance) {
    return graphvizInstance;
  }
  if (graphvizError) {
    throw graphvizError;
  }
  if (typeof (React as any).use === "function") {
    return (React as any).use(getGraphvizPromise());
  }
  throw getGraphvizPromise();
}

function GraphvizInner({ dot }: { dot: string }) {
  const graphviz = useGraphviz();
  const svg = graphviz.dot(dot.trim());

  return (
    <div
      className={styles.container}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function Graphviz({ dot }: { dot: string }) {
  return (
    <Suspense fallback={<pre className="graphviz-loading">{dot}</pre>}>
      <GraphvizInner dot={dot} />
    </Suspense>
  );
}
