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

function getLeafIndices(cluster: any): number[] {
  if (cluster.isLeaf) {
    return [cluster.index];
  }
  let indices: number[] = [];
  for (const child of cluster.children) {
    indices = indices.concat(getLeafIndices(child));
  }
  return indices;
}

/**
 * 階層的クラスタリング(HAC)を実行します。
 * @param ids - IDの配列
 * @param distanceMatrix - 距離行列
 * @returns クラスタリングされたIDのグループ
 */
export function performHAC(ids: string[], distanceMatrix: number[][]): string[][] {
  if (ids.length === 0) return [];
  
  // agnesに直接距離行列を渡し、methodでリンケージを指定する
  const tree = agnes(distanceMatrix, {
    method: 'ward',
  });

  let assignments: number[];
  try {
    const rootCluster = tree.group(3); // Get the root Cluster object for 3 clusters
    assignments = new Array(ids.length).fill(-1); // -1は未割り当てまたはノイズ

    if (rootCluster && Array.isArray(rootCluster.children)) {
      rootCluster.children.forEach((topLevelCluster: any, clusterIndex: number) => {
        const clusterIndices = getLeafIndices(topLevelCluster);
        clusterIndices.forEach((dataIndex: number) => {
          if (dataIndex >= 0 && dataIndex < ids.length) {
            assignments[dataIndex] = clusterIndex;
          }
        });
      });
    }
  } catch (e) {
    console.error("HAC clustering failed:", e);
    return [];
  }

  const result = formatClusters(ids, assignments);
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
  // Jaccard距離は0-1の範囲なので、epsilon=0.21を試す。minPtsは2のまま。
  const assignments = dbscan.run(distanceMatrix, 0.21, 2);
  
  const result = formatClusters(ids, assignments);
  return result;
}

