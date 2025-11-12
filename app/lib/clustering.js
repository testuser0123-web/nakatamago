"use strict";
// app/lib/clustering.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.performHAC = performHAC;
exports.performDBSCAN = performDBSCAN;
var ml_hclust_1 = require("ml-hclust");
var density_clustering_1 = require("density-clustering");
/**
 * クラスタリング結果をIDの配列の配列としてフォーマットします。
 * @param ids - 元のIDの配列
 * @param assignments - 各IDのクラスタインデックス
 * @returns クラスタリングされたIDのグループ
 */
function formatClusters(ids, assignments) {
    var clusters = {};
    var noise = [];
    for (var i = 0; i < assignments.length; i++) {
        var clusterId = assignments[i];
        if (clusterId === -1) { // DBSCANでノイズと判定された場合
            noise.push(ids[i]);
            continue;
        }
        if (!clusters[clusterId]) {
            clusters[clusterId] = [];
        }
        clusters[clusterId].push(ids[i]);
    }
    var groupedClusters = Object.values(clusters);
    // ノイズが存在する場合、それを一つのクラスタとして追加
    if (noise.length > 0) {
        groupedClusters.push(noise);
    }
    return groupedClusters;
}
function getLeafIndices(cluster) {
    if (cluster.isLeaf) {
        return [cluster.index];
    }
    var indices = [];
    for (var _i = 0, _a = cluster.children; _i < _a.length; _i++) {
        var child = _a[_i];
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
function performHAC(ids, distanceMatrix) {
    if (ids.length === 0)
        return [];
    // agnesに直接距離行列を渡し、methodでリンケージを指定する
    var tree = (0, ml_hclust_1.agnes)(distanceMatrix, {
        method: 'ward',
    });
    var assignments;
    try {
        var rootCluster = tree.group(3); // Get the root Cluster object for 3 clusters
        assignments = new Array(ids.length).fill(-1); // -1は未割り当てまたはノイズ
        if (rootCluster && Array.isArray(rootCluster.children)) {
            rootCluster.children.forEach(function (topLevelCluster, clusterIndex) {
                var clusterIndices = getLeafIndices(topLevelCluster);
                clusterIndices.forEach(function (dataIndex) {
                    if (dataIndex >= 0 && dataIndex < ids.length) {
                        assignments[dataIndex] = clusterIndex;
                    }
                });
            });
        }
    }
    catch (e) {
        console.error("HAC clustering failed:", e);
        return [];
    }
    var result = formatClusters(ids, assignments);
    return result;
}
/**
 * DBSCANクラスタリングを実行します。
 * @param ids - IDの配列
 * @param distanceMatrix - 距離行列
 * @returns クラスタリングされたIDのグループ
 */
function performDBSCAN(ids, distanceMatrix) {
    if (ids.length === 0)
        return [];
    var dbscan = new density_clustering_1.DBSCAN();
    // Jaccard距離は0-1の範囲なので、epsilon=0.25を試す。minPtsは2のまま。
    var assignments = dbscan.run(distanceMatrix, 0.25, 2);
    var result = formatClusters(ids, assignments);
    return result;
}
