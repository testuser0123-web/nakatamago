// app/lib/clustering.ts

import { agnes } from 'ml-hclust';
import { DBSCAN } from 'density-clustering';

/**
 * クラスタリング結果をIDの配列の配列としてフォーマットします。
 * @param ids - 元のIDの配列
 * @param assignments - 各IDのクラスタインデックス
 * @returns クラスタリングされたIDのグループ
 */
function formatClusters(ids: string[], assignments: number[]): string[][] {
  const clusters: { [key: number]: string[] } = {};
  const noise: string[] = [];
  for (let i = 0; i < assignments.length; i++) {
    const clusterId = assignments[i];
    if (clusterId === -1) {
      noise.push(ids[i]);
      continue;
    }
    if (!clusters[clusterId]) {
      clusters[clusterId] = [];
    }
    clusters[clusterId].push(ids[i]);
  }
  
  const groupedClusters = Object.values(clusters);
  // ノイズが存在する場合、別のグループとして追加
  if (noise.length > 0) {
    // groupedClusters.push(noise); // Or handle noise differently
  }
  return groupedClusters;
}

/**
 * 階層的クラスタリング(HAC/AGNES)を実行します。
 * @param ids - IDの配列
 * @param distanceMatrix - 距離行列
 * @returns クラスタリングされたIDのグループ
 */
export function performHAC(ids: string[], distanceMatrix: number[][]): string[][] {
  if (ids.length === 0) return [];
  
  const dataset = ids.map((_, i) => [i]);
  const tree = agnes(dataset, {
    // 距離行列を直接使うためのカスタム距離関数
    distanceFunction: (a, b) => distanceMatrix[a[0]][b[0]],
    method: 'ward',
  });

  // IDが30個未満なら5グループ、それ以上なら10グループに分割する（ダミーの基準）
  const numClusters = ids.length < 30 ? 5 : 10;
  if (tree.children.length < numClusters -1) {
     // データが少なすぎて指定したクラスタ数に分割できない場合
     const assignments = tree.cut(0.1);
     return formatClusters(ids, assignments);
  }

  const assignments = tree.group(numClusters);
  return formatClusters(ids, assignments.map(a => a.cluster));
}

/**
 * DBSCANクラスタリングを実行します。
 * @param ids - IDの配列
 * @param distanceMatrix - 距離行列
 * @returns クラスタリングされたIDのグループ
 */
export function performDBSCAN(ids: string[], distanceMatrix: number[][]): string[][] {
  if (ids.length === 0) return [];

  const dbscan = new DBSCAN();
  // ダミーの距離行列(0か1)なので、epsilon=0.5 (同じ点以外はクラスタ化されない)
  // minPoints=2 (2点以上でクラスタ)
  // 実際の距離では、これらの値を調整する必要があります。
  const assignments = dbscan.run(distanceMatrix, 0.5, 2);
  return formatClusters(ids, assignments);
}
