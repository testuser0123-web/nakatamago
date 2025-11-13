"use client";

import { useState, useEffect, useRef } from "react";
import { getIdsFromThreadKey } from "./lib/id-parser";
import { calculateDistanceMatrix } from "./lib/distance-calculator";
import { performHAC, performDBSCAN } from "./lib/clustering";
import { calculateJaccardDistanceMatrix } from "./lib/similarity-calculator"; // Import new similarity calculator

// --- タイプ定義 ---
type UserPostsContent = { keys: string[] } | { message: string };

type ProgressContent = {
  current: number;
  total: number;
  message: string;
  logId: string; // To uniquely identify this progress log entry
};

type LogEntry = {
  type:
    | "command"
    | "info"
    | "error"
    | "ids"
    | "matrix"
    | "hac"
    | "dbscan"
    | "boot"
    | "userPosts"
    | "intersectionResult"
    | "progress"
    | "naiveMatrix"; // Add new naiveMatrix type
  content: any | UserPostsContent | string[] | ProgressContent | number[][]; // naiveMatrix will have number[][] content
  logId?: string; // Optional unique ID for updatable log entries
};

// --- 起動シーケンスの定義 ---
const bootSequence: LogEntry[] = [
  { type: "command", content: "./nakatamago.exe" },
  { type: "boot", content: "Booting Nakatamago Checker v1.0..." },
  { type: "boot", content: "Connecting to mainframe... [OK]" },
  { type: "boot", content: "Initializing modules... [OK]" },
  { type: "boot", content: "Ready." },
];

// --- ヘルパー関数 ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- メインコンポーネント ---
export default function Home() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clusteringPerformed, setClusteringPerformed] = useState(false);

  const [ids, setIds] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [clusteredIds, setClusteredIds] = useState<string[]>([]); // New state for IDs to be clustered

  const endOfHistoryRef = useRef<HTMLDivElement>(null);

  // --- 起動シーケンス ---
  useEffect(() => {
    const runBootSequence = async () => {
      for (const entry of bootSequence) {
        setHistory((prev) => [...prev, entry]);
        await sleep(300);
      }
      setHistory((prev) => [
        ...prev,
        { type: "info", content: "スレッドのURLを入力してください。" },
      ]);
      setIsLoading(false);
    };
    runBootSequence();
  }, []);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const addLog = (entry: LogEntry) => {
    setHistory((prev) => {
      if (entry.logId) {
        // If logId is provided, try to update an existing entry
        const existingIndex = prev.findIndex(
          (log) => log.logId === entry.logId
        );
        if (existingIndex > -1) {
          const newHistory = [...prev];
          newHistory[existingIndex] = entry;
          return newHistory;
        }
      }
      // Otherwise, append a new entry
      return [...prev, entry];
    });
  };

  const extractKeyFromUrl = (url: string): string | null => {
    try {
      const sanitizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;
      const urlObject = new URL(sanitizedUrl);
      const parts = urlObject.pathname.split("/");
      const keyCandidate = parts.pop(); // keyCandidate can be string | undefined

      if (typeof keyCandidate === "string" && /^\d+$/.test(keyCandidate)) {
        return keyCandidate;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const handleCommand = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setClusteringPerformed(false);
    setIds([]);
    setMatrix([]);
    setClusteredIds([]); // Reset clusteredIds
    addLog({ type: "command", content: input });
    await sleep(100);

    const key = extractKeyFromUrl(input);
    if (!key) {
      addLog({
        type: "error",
        content: "無効なURLです。キーを抽出できませんでした。",
      });
      setIsLoading(false);
      setInput("");
      return;
    }

    addLog({ type: "info", content: `[OK] スレッドキーを抽出: ${key}` });
    await sleep(300);
    addLog({ type: "info", content: "[API] IDリストを取得中..." });

    try {
      const response = await fetch(`/api/get-ids/${key}`);
      if (!response.ok) throw new Error("APIリクエストに失敗しました。");

      const data = await response.json();
      const fetchedIds = data.ids || [];
      setIds(fetchedIds);
      await sleep(300);
      addLog({ type: "ids", content: fetchedIds });

      if (fetchedIds.length > 0) {
        await sleep(300);
        // addLog({ type: 'info', content: '[OK] 距離行列を計算中 (ダミー)...' }); // 距離行列の計算ログは非表示
        const distMatrix = calculateDistanceMatrix(fetchedIds);
        setMatrix(distMatrix);
        await sleep(300);
        // addLog({ type: 'matrix', content: distMatrix }); // 距離行列の表示は集合演算の後に行うため、一時的に非表示

        // 新機能: 最初のIDの書き込み情報を取得
        const firstId = fetchedIds[0];
        addLog({
          type: "info",
          content: `[API] ID:${firstId} の書き込み情報を取得中...`,
        });
        await sleep(300);
        try {
          const userPostsResponse = await fetch(
            `/api/get-user-posts/${encodeURIComponent(firstId)}`
          );
          if (!userPostsResponse.ok)
            throw new Error("ユーザー書き込み情報の取得に失敗しました。");
          const userPostsContent: UserPostsContent =
            await userPostsResponse.json();
          addLog({ type: "userPosts", content: userPostsContent });

          // 集合演算の開始
          if (
            "keys" in userPostsContent &&
            Array.isArray(userPostsContent.keys) &&
            userPostsContent.keys.length > 0
          ) {
            addLog({ type: "info", content: "[CMD] 集合演算を実行中..." });
            await sleep(300);

            const originSet = new Set(fetchedIds); // fetchedIdsはinput_thread_keyのID集合
            const inputThreadKey = key; // input_thread_keyはhandleCommandのkey変数

            const filteredKyodemoKeys = userPostsContent.keys.filter(
              (k) => k !== inputThreadKey
            );

            const anotherSet = new Set<string>();
            for (const threadKey of filteredKyodemoKeys) {
              try {
                const response = await fetch(`/api/get-ids/${threadKey}`);
                if (!response.ok) {
                  addLog({
                    type: "error",
                    content: `スレッドキー ${threadKey} のID取得に失敗しました。`,
                  });
                  continue;
                }
                const data = await response.json();
                data.ids.forEach((id: string) => anotherSet.add(id));
              } catch (e: any) {
                addLog({
                  type: "error",
                  content: `スレッドキー ${threadKey} のID取得中にエラー: ${e.message}`,
                });
              }
              await sleep(200); // リクエスト集中を避けるための遅延
            }

            const intersectionResult: string[] = [];
            for (const id of originSet) {
              if (anotherSet.has(id)) {
                intersectionResult.push(id);
              }
            }
            setClusteredIds(intersectionResult); // Set clusteredIds state
            addLog({ type: "intersectionResult", content: intersectionResult });

            // 共通IDの集合に対して、kyodemoサイトから書き込みスレのキー一覧を取得
            if (intersectionResult.length > 0) {
              addLog({
                type: "info",
                content: "[CMD] 共通IDの書き込みスレキーを取得中...",
              });
              await sleep(300);

              const idToKeysMap: { [id: string]: string[] } = {};
              const totalIdsToProcess = intersectionResult.length;
              const progressLogId = `fetch-keys-progress-${Date.now()}`; // Unique ID for this progress log

              addLog({
                type: "progress",
                content: {
                  current: 0,
                  total: totalIdsToProcess,
                  message: "スレキー取得中...",
                  logId: progressLogId,
                },
                logId: progressLogId,
              });

              let processedCount = 0;
              for (const id of intersectionResult) {
                try {
                  const userPostsResponse = await fetch(
                    `/api/get-user-posts/${encodeURIComponent(id)}`
                  );
                  if (!userPostsResponse.ok) {
                    addLog({
                      type: "error",
                      content: `ID:${id} の書き込みスレキー取得に失敗しました。`,
                    });
                    // エラーでも進捗は進める
                  } else {
                    const userPostsContent: UserPostsContent =
                      await userPostsResponse.json();
                    if (
                      "keys" in userPostsContent &&
                      Array.isArray(userPostsContent.keys)
                    ) {
                      idToKeysMap[id] = userPostsContent.keys;
                    } else {
                      idToKeysMap[id] = []; // キーが見つからない場合は空の配列
                    }
                  }
                } catch (e: any) {
                  addLog({
                    type: "error",
                    content: `ID:${id} の書き込みスレキー取得中にエラー: ${e.message}`,
                  });
                }
                processedCount++;
                addLog({
                  type: "progress",
                  content: {
                    current: processedCount,
                    total: totalIdsToProcess,
                    message: `スレキー取得中... (${processedCount}/${totalIdsToProcess})`,
                    logId: progressLogId,
                  },
                  logId: progressLogId,
                });
                await sleep(200); // リクエスト集中を避けるための遅延
              }
              console.log("IDごとの書き込みスレキー:", idToKeysMap);
              // addLog({ type: "info", content: "[OK] IDごとの書き込みスレキーをコンソールに出力しました。" });
              addLog({
                // Final progress update to show completion
                type: "progress",
                content: {
                  current: totalIdsToProcess,
                  total: totalIdsToProcess,
                  message: "スレキー取得完了。",
                  logId: progressLogId,
                },
                logId: progressLogId,
              });

              // Jaccard距離行列の計算と表示
              addLog({
                type: "info",
                content: "[CMD] Jaccard距離行列を計算中...",
              });
              await sleep(300);
              const naiveDistMatrix =
                calculateJaccardDistanceMatrix(idToKeysMap);
              setMatrix(naiveDistMatrix); // matrix stateを更新
              addLog({ type: "naiveMatrix", content: naiveDistMatrix });
            }
          } else if ("message" in userPostsContent) {
            addLog({
              type: "info",
              content: `[INFO] 集合演算スキップ: ${userPostsContent.message}`,
            });
          }
        } catch (userPostsError: any) {
          addLog({
            type: "error",
            content: `ユーザー書き込み情報の取得エラー: ${userPostsError.message}`,
          });
        }
      }
    } catch (e: any) {
      addLog({ type: "error", content: e.message });
    }

    setIsLoading(false);
    setInput("");
  };

  const handleClustering = async () => {
    if (isLoading || clusteredIds.length === 0) return;
    setIsLoading(true);

    addLog({ type: "command", content: "./run_clustering --all" });
    await sleep(300);

    addLog({
      type: "info",
      content: "[CMD] 階層的クラスタリング(HAC)を実行中...",
    });
    await sleep(500);
    const hacResult = performHAC(clusteredIds, matrix);
    console.log("HAC Result (before addLog):", hacResult); // DEBUG LOG
    addLog({ type: "hac", content: hacResult });

    // await sleep(500);
    // addLog({
    //   type: "info",
    //   content: "[CMD] DBSCANクラスタリングを実行中... [工事中（不具合あり）]",
    // });
    // await sleep(500);
    // const dbscanResult = performDBSCAN(clusteredIds, matrix);
    // console.log("DBSCAN Result (before addLog):", dbscanResult); // DEBUG LOG
    // addLog({ type: "dbscan", content: dbscanResult });

    setClusteringPerformed(true);
    setIsLoading(false);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="w-full max-w-4xl mx-auto">
        {history.map((entry, index) => (
          <div key={index} className="mb-2">
            {entry.type === "command" && (
              <div>
                <span className="text-cyan-400">[user@nakatamago ~]$</span>{" "}
                {entry.content}
              </div>
            )}
            {(entry.type === "info" || entry.type === "boot") && (
              <div className="text-gray-400">{entry.content}</div>
            )}
            {entry.type === "error" && (
              <div className="text-red-500">Error: {entry.content}</div>
            )}
            {entry.type === "ids" && (
              <div>
                <p>[OK] {entry.content.length}個のユニークIDを検出:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm p-2">
                  {entry.content.slice(0, 20).map((id: string) => (
                    <span key={id}>ID:{id}&nbsp;</span>
                  ))}
                </div>
                {entry.content.length > 20 && (
                  <p className="text-xs text-gray-500 mt-1">
                    (最初の20個のIDのみ表示しています)
                  </p>
                )}
              </div>
            )}
            {entry.type === "matrix" && (
              <div>
                <p>[OK] 距離行列 (先頭5x5):</p>
                <div className="text-xs p-2">
                  {entry.content
                    .slice(0, 5)
                    .map((row: number[], rIdx: number) => (
                      <div key={rIdx} className="flex gap-2">
                        {row.slice(0, 5).map((cell: number, cIdx: number) => (
                          <span key={cIdx} className="w-8 text-center">
                            {cell.toFixed(1)}
                          </span>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            )}
            {entry.type === "hac" && (
              <RenderClusters
                title="HAC クラスタリング結果"
                clusters={entry.content}
              />
            )}
            {entry.type === "dbscan" && (
              <RenderClusters
                title="DBSCAN クラスタリング結果"
                clusters={entry.content}
              />
            )}
            {entry.type === "userPosts" && (
              <div>
                <p>[OK] ユーザー書き込み情報:</p>
                {"keys" in entry.content &&
                Array.isArray(entry.content.keys) ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm p-2 border-l-2 border-gray-700">
                    {entry.content.keys.map((key: string) => (
                      <span key={key}>Key:{key}</span>
                    ))}
                  </div>
                ) : "message" in entry.content ? (
                  <p className="text-xs p-2 border-l-2 border-gray-700">
                    {entry.content.message}
                  </p>
                ) : (
                  <p className="text-xs p-2 border-l-2 border-gray-700">
                    不明な形式のユーザー書き込み情報です。
                  </p>
                )}
              </div>
            )}
            {entry.type === "intersectionResult" && (
              <div>
                <p>[OK] 共通IDの集合 (疑わしいID):</p>
                {Array.isArray(entry.content) && entry.content.length > 0 ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm p-2 border-l-2 border-gray-700">
                    {entry.content.map((id: string) => (
                      <span key={id}>ID:{id}&nbsp;</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs p-2 border-l-2 border-gray-700">
                    共通するIDは見つかりませんでした。
                  </p>
                )}
              </div>
            )}
            {entry.type === "progress" && (
              <div className="text-gray-400">
                <p>{entry.content.message}</p>
                <div className="w-full bg-gray-700 h-2 mt-1">
                  <div
                    className="bg-green-500 h-2"
                    style={{
                      width: `${
                        (entry.content.current / entry.content.total) * 100
                      }%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1">
                  {Math.round(
                    (entry.content.current / entry.content.total) * 100
                  )}
                  % 完了
                </p>
              </div>
            )}
            {entry.type === "naiveMatrix" && (
              <div>
                <p>[OK] 距離行列 (先頭5x5):</p>
                <div className="text-xs p-2">
                  {entry.content
                    .slice(0, 5)
                    .map((row: number[], rIdx: number) => (
                      <div key={rIdx} className="flex gap-2">
                        {row.slice(0, 5).map((cell: number, cIdx: number) => (
                          <span key={cIdx} className="w-8 text-center">
                            {cell.toFixed(1)}
                          </span>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {!isLoading && (
          <div className="flex items-center">
            <span className="text-cyan-400">[user@nakatamago ~]$</span>
            <input
              id="terminal-input"
              type="text"
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none ml-2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCommand()}
              autoFocus
              placeholder="Enter thread URL..."
            />
          </div>
        )}

        {ids.length > 0 && !isLoading && !clusteringPerformed && (
          <div className="mt-4">
            <button
              onClick={handleClustering}
              className="border border-green-500 text-green-500 px-4 py-1 hover:bg-green-500 hover:text-black transition-colors"
            >
              クラスタリング実行
            </button>
          </div>
        )}

        <div ref={endOfHistoryRef} />
      </div>
    </div>
  );
}

// --- 結果表示用サブコンポーネント ---
const RenderClusters = ({
  title,
  clusters,
}: {
  title: string;
  clusters: string[][];
}) => {
  const [visibleClusters, setVisibleClusters] = useState<string[][]>([]);

  useEffect(() => {
    setVisibleClusters([]); // clustersプロパティが変更されたらリセット
    if (clusters.length === 0) return;

    let timeoutId: NodeJS.Timeout;
    const animateClusters = (index: number) => {
      if (index < clusters.length) {
        setVisibleClusters((prev) => [...prev, clusters[index]]);
        timeoutId = setTimeout(() => animateClusters(index + 1), 200); // 次のクラスタを表示
      }
    };

    // 最初のクラスタ表示を開始
    timeoutId = setTimeout(() => animateClusters(0), 200);

    return () => clearTimeout(timeoutId); // コンポーネントのアンマウント時やclusters変更時にタイマーをクリア
  }, [clusters]);

  return (
    <div>
      <p>
        [OK] {title}: {clusters.length}個のクラスタを検出
      </p>
      <div className="p-2 space-y-2">
        {visibleClusters.filter(Boolean).map((cluster, cIdx) => (
          <div key={cIdx}>
            <p className="text-sm text-gray-400">
              Cluster #{cIdx + 1} ({cluster.length} items)
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs border-l-2 border-gray-700 pl-2">
              {cluster.map((id) => (
                <span key={id}>ID:{id}&nbsp;</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
