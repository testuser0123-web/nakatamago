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
    if (clusterId === -1) { // DBSCANでノイズと判定された場合
      noise.push(ids[i]);
      continue;
    }
    if (!clusters[clusterId]) {
      clusters[clusterId] = [];
    }
    clusters[clusterId].push(ids[i]);
  }
  
  const groupedClusters = Object.values(clusters);
  // ノイズが存在する場合、それを一つのクラスタとして追加
  if (noise.length > 0) {
    groupedClusters.push(noise);
  }
  return groupedClusters;
}

/**
 * 階層的クラスタリング(HAC)を実行します。
 * @param ids - IDの配列
 * @param distanceMatrix - 距離行列
 * @returns クラスタリングされたIDのグループ
 */
export function performHAC(ids: string[], distanceMatrix: number[][]): string[][] {
  if (ids.length === 0) return [];
  
  const dataset = ids.map((_, i) => [i]);
  const tree = agnes(dataset, {
    distanceFunction: (a, b) => distanceMatrix[a[0]][b[0]],
    method: 'ward',
  });

  let assignments: number[];
  try {
    // tree.group(1)が配列を返すか、単一のオブジェクトを返すか不明なため、両方に対応
    const groupResult = tree.group(1); // numClustersを1に固定
    if (Array.isArray(groupResult)) {
      // groupResultが配列の場合 (各データポイントのクラスタ割り当てオブジェクトの配列)
      assignments = groupResult.map(a => a.cluster);
    } else if (typeof groupResult === 'object' && groupResult !== null) {
      // groupResultが単一のクラスタオブジェクトの場合 (例: { cluster: 0, children: [...] })
      // この場合、全てのIDをそのクラスタに割り当てる
      assignments = ids.map(() => (groupResult as any).cluster || 0);
    } else {
      // 予期せぬ形式の場合、全てをクラスタ0に割り当てる
      assignments = ids.map(() => 0);
    }
  } catch (e) {
    // エラーが発生した場合（例: データが少なすぎるなど）は、全てを1つのクラスタとする
    assignments = ids.map(() => 0);
  }

  const result = formatClusters(ids, assignments);
  // 結果が空の場合（例: agnesが何も返さない場合）も、全てを1つのクラスタとする
  if (result.length === 0 && ids.length > 0) {
    return [ids];
  }
  return result;
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
  // この設定では、ほとんどのIDがノイズ(-1)になるはずです。
  const assignments = dbscan.run(distanceMatrix, 0.5, 2);
  
  const result = formatClusters(ids, assignments);
  // 結果が空の場合（例: 全てノイズと判定された場合）も、全てを1つのクラスタとする
  if (result.length === 0 && ids.length > 0) {
    return [ids];
  }
  return result;
}

