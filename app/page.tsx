"use client";

import { useState, useEffect, useRef } from 'react';
import { getIdsFromThreadKey } from './lib/id-parser';
import { calculateDistanceMatrix } from './lib/distance-calculator';
import { performHAC, performDBSCAN } from './lib/clustering';

// --- タイプ定義 ---
type LogEntry = {
  type: 'command' | 'info' | 'error' | 'ids' | 'matrix' | 'hac' | 'dbscan' | 'boot';
  content: any;
};

// --- 起動シーケンスの定義 ---
const bootSequence: LogEntry[] = [
  { type: 'command', content: './nakatamago.exe' },
  { type: 'boot', content: 'Booting Nakatamago Checker v1.0...' },
  { type: 'boot', content: 'Connecting to mainframe... [OK]' },
  { type: 'boot', content: 'Initializing modules... [OK]' },
  { type: 'boot', content: 'Ready.' },
];

// --- ヘルパー関数 ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- メインコンポーネント ---
export default function Home() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clusteringPerformed, setClusteringPerformed] = useState(false);
  
  const [ids, setIds] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<number[][]>([]);

  const endOfHistoryRef = useRef<HTMLDivElement>(null);

  // --- 起動シーケンス ---
  useEffect(() => {
    const runBootSequence = async () => {
      for (const entry of bootSequence) {
        setHistory(prev => [...prev, entry]);
        await sleep(300);
      }
      setHistory(prev => [...prev, { type: 'info', content: 'スレッドのURLを入力してください。' }]);
      setIsLoading(false);
    };
    runBootSequence();
  }, []);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const addLog = (entry: LogEntry) => {
    setHistory(prev => [...prev, entry]);
  };

  const extractKeyFromUrl = (url: string): string | null => {
    try {
      const sanitizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      const urlObject = new URL(sanitizedUrl);
      const parts = urlObject.pathname.split('/');
      const keyCandidate = parts.pop(); // keyCandidate can be string | undefined

      if (typeof keyCandidate === 'string' && /^\d+$/.test(keyCandidate)) {
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
    addLog({ type: 'command', content: input });
    await sleep(100);

    const key = extractKeyFromUrl(input);
    if (!key) {
      addLog({ type: 'error', content: '無効なURLです。キーを抽出できませんでした。' });
      setIsLoading(false);
      setInput('');
      return;
    }

    addLog({ type: 'info', content: `[OK] スレッドキーを抽出: ${key}` });
    await sleep(300);
    addLog({ type: 'info', content: '[API] IDリストを取得中...' });

    try {
      const response = await fetch(`/api/get-ids/${key}`);
      if (!response.ok) throw new Error('APIリクエストに失敗しました。');
      
      const data = await response.json();
      const fetchedIds = data.ids || [];
      setIds(fetchedIds);
      await sleep(300);
      addLog({ type: 'ids', content: fetchedIds });

      if (fetchedIds.length > 0) {
        await sleep(300);
        addLog({ type: 'info', content: '[OK] 距離行列を計算中 (ダミー)...' });
        const distMatrix = calculateDistanceMatrix(fetchedIds);
        setMatrix(distMatrix);
        await sleep(300);
        addLog({ type: 'matrix', content: distMatrix });
      }

    } catch (e: any) {
      addLog({ type: 'error', content: e.message });
    }

    setIsLoading(false);
    setInput('');
  };
  
  const handleClustering = async () => {
    if (isLoading || ids.length === 0) return;
    setIsLoading(true);
    
    addLog({ type: 'command', content: './run_clustering --all' });
    await sleep(300);
    
    addLog({ type: 'info', content: '[CMD] 階層的クラスタリング(HAC)を実行中...'});
    await sleep(500);
    const hacResult = performHAC(ids, matrix);
    console.log('HAC Result (before addLog):', hacResult); // DEBUG LOG
    addLog({ type: 'hac', content: hacResult });
    
    await sleep(500);
    addLog({ type: 'info', content: '[CMD] DBSCANクラスタリングを実行中...'});
    await sleep(500);
    const dbscanResult = performDBSCAN(ids, matrix);
    console.log('DBSCAN Result (before addLog):', dbscanResult); // DEBUG LOG
    addLog({ type: 'dbscan', content: dbscanResult });

    setClusteringPerformed(true);
    setIsLoading(false);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="w-full max-w-4xl mx-auto">
        {history.map((entry, index) => (
          <div key={index} className="mb-2">
            {entry.type === 'command' && (
              <div><span className="text-cyan-400">[user@nakatamago ~]$</span> {entry.content}</div>
            )}
            {(entry.type === 'info' || entry.type === 'boot') && <div className="text-gray-400">{entry.content}</div>}
            {entry.type === 'error' && <div className="text-red-500">Error: {entry.content}</div>}
            {entry.type === 'ids' && (
              <div>
                <p>[OK] {entry.content.length}個のユニークIDを検出:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm p-2">
                  {entry.content.map((id: string) => <span key={id}>ID:{id}</span>)}
                </div>
              </div>
            )}
            {entry.type === 'matrix' && (
               <div>
                <p>[OK] 距離行列 (先頭5x5):</p>
                <div className="text-xs p-2">
                  {entry.content.slice(0, 5).map((row: number[], rIdx: number) => (
                    <div key={rIdx} className="flex gap-2">
                      {row.slice(0, 5).map((cell: number, cIdx: number) => (
                        <span key={cIdx} className="w-8 text-center">{cell.toFixed(1)}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {entry.type === 'hac' && <RenderClusters title="HAC クラスタリング結果" clusters={entry.content} />}
            {entry.type === 'dbscan' && <RenderClusters title="DBSCAN クラスタリング結果" clusters={entry.content} />}
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
              onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
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
const RenderClusters = ({ title, clusters }: { title: string; clusters: string[][] }) => {
  const [visibleClusters, setVisibleClusters] = useState<string[][]>([]);

  useEffect(() => {
    setVisibleClusters([]); // clustersプロパティが変更されたらリセット
    if (clusters.length === 0) return;

    let timeoutId: NodeJS.Timeout;
    const animateClusters = (index: number) => {
      if (index < clusters.length) {
        setVisibleClusters(prev => [...prev, clusters[index]]);
        timeoutId = setTimeout(() => animateClusters(index + 1), 200); // 次のクラスタを表示
      }
    };

    // 最初のクラスタ表示を開始
    timeoutId = setTimeout(() => animateClusters(0), 200); 

    return () => clearTimeout(timeoutId); // コンポーネントのアンマウント時やclusters変更時にタイマーをクリア
  }, [clusters]);

  return (
    <div>
      <p>[OK] {title}: {clusters.length}個のクラスタを検出</p>
      <div className="p-2 space-y-2">
        {visibleClusters.filter(Boolean).map((cluster, cIdx) => (
          <div key={cIdx}>
            <p className="text-sm text-gray-400">Cluster #{cIdx + 1} ({cluster.length} items)</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs border-l-2 border-gray-700 pl-2">
              {cluster.map((id) => <span key={id}>ID:{id}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
